from __future__ import annotations
import json, os, re, shutil, subprocess, uuid, zipfile
from pathlib import Path
from typing import Any
import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

APP_NAME = os.getenv("APP_NAME", "APKForge AI")
DATA_DIR = Path(os.getenv("DATA_DIR", "./workspace")).resolve()
UPLOAD_DIR, JOB_DIR, PROJECT_DIR = DATA_DIR / "uploads", DATA_DIR / "jobs", DATA_DIR / "projects"
for directory in (UPLOAD_DIR, JOB_DIR, PROJECT_DIR): directory.mkdir(parents=True, exist_ok=True)
ALLOWED = {".apk", ".obb", ".zip", ".apks", ".xapk", ".aab", ".jar", ".png", ".jpg", ".jpeg", ".webp", ".json", ".txt", ".glb", ".gltf", ".obj", ".mtl", ".fbx"}
app = FastAPI(title=APP_NAME, version="0.1.0", description="AI-assisted APK and OBB analysis")

class PlanRequest(BaseModel):
    prompt: str = Field(min_length=5, max_length=6000)
    target_file_id: str | None = None
    project_type: str = "android-or-game-mod"
    constraints: list[str] = Field(default_factory=list, max_length=30)

def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._ -]", "_", Path(name or "upload.bin").name)[:160] or "upload.bin"

def get_upload(file_id: str) -> Path:
    if not re.fullmatch(r"[a-f0-9]{32}", file_id): raise HTTPException(400, "Invalid file ID")
    paths = list(UPLOAD_DIR.glob(file_id + "__*"))
    if not paths or not paths[0].is_file(): raise HTTPException(404, "File not found")
    return paths[0]

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "name": APP_NAME, "version": app.version,
            "apktool_available": bool(shutil.which(os.getenv("APKTOOL_BIN", "apktool"))),
            "ai_configured": bool(os.getenv("AI_BASE_URL") and os.getenv("AI_API_KEY") and os.getenv("AI_MODEL"))}

@app.post("/api/files")
async def upload_asset(file: UploadFile = File(...)) -> dict[str, Any]:
    name = safe_name(file.filename or "upload.bin")
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED: raise HTTPException(415, "Unsupported file type: " + ext)
    file_id = uuid.uuid4().hex
    target = UPLOAD_DIR / (file_id + "__" + name)
    # Stream to disk: no app-level upload-size cap and no full-file RAM buffering.
    try:
        with target.open("wb") as out:
            while chunk := await file.read(1024 * 1024): out.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally: await file.close()
    return {"id": file_id, "filename": name, "size_bytes": target.stat().st_size, "extension": ext}

@app.get("/api/files")
def list_files() -> list[dict[str, Any]]:
    result = []
    for path in UPLOAD_DIR.iterdir():
        if path.is_file() and "__" in path.name:
            fid, name = path.name.split("__", 1)
            result.append({"id": fid, "filename": name, "size_bytes": path.stat().st_size})
    return sorted(result, key=lambda item: item["filename"].lower())

@app.get("/api/files/{file_id}/download")
def download_file(file_id: str):
    path = get_upload(file_id)
    return FileResponse(path, filename=path.name.split("__", 1)[-1])

@app.post("/api/inspect/{file_id}")
def inspect_file(file_id: str) -> dict[str, Any]:
    path = get_upload(file_id)
    result: dict[str, Any] = {"filename": path.name.split("__", 1)[-1], "size_bytes": path.stat().st_size,
        "extension": path.suffix.lower(), "archive": False, "entries": [], "notes": []}
    if not zipfile.is_zipfile(path):
        result["notes"].append("Not a ZIP-compatible archive; a game-specific parser may be needed.")
        return result
    result["archive"] = True
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            result["entry_count"] = len(entries)
            result["entries"] = [{"name": e.filename, "size_bytes": e.file_size,
                "compressed_bytes": e.compress_size, "is_directory": e.is_dir()} for e in entries[:3000]]
            if len(entries) > 3000: result["notes"].append("Only first 3000 entries shown.")
            if "AndroidManifest.xml" in {e.filename for e in entries}:
                result["notes"].append("AndroidManifest.xml found; Apktool can decode binary XML.")
            if path.suffix.lower() == ".obb":
                result["notes"].append("ZIP-compatible OBB detected. Contents may still use proprietary or encrypted formats.")
    except (zipfile.BadZipFile, OSError) as exc: raise HTTPException(422, "Archive inspection failed: " + str(exc))
    return result

@app.post("/api/decompile/{file_id}")
def decompile_apk(file_id: str) -> dict[str, Any]:
    source = get_upload(file_id)
    if source.suffix.lower() != ".apk": raise HTTPException(400, "Apktool decode currently supports APK files only.")
    tool = shutil.which(os.getenv("APKTOOL_BIN", "apktool"))
    if not tool: raise HTTPException(503, "Apktool is not installed or not available on PATH.")
    output = PROJECT_DIR / file_id
    if output.exists(): raise HTTPException(409, "Decoded project already exists.")
    try:
        proc = subprocess.run([tool, "d", str(source), "-o", str(output), "-f"], capture_output=True, text=True, timeout=300, check=False)
    except subprocess.TimeoutExpired: 
        shutil.rmtree(output, ignore_errors=True)
        raise HTTPException(504, "Apktool timed out after 300 seconds.")
    if proc.returncode:
        shutil.rmtree(output, ignore_errors=True)
        raise HTTPException(422, {"message": "Apktool could not decode this APK.", "details": proc.stderr[-3000:]})
    return {"ok": True, "project_id": file_id, "project_path": str(output), "log": proc.stdout[-1500:]}

@app.post("/api/ai/plan")
async def ai_plan(request: PlanRequest) -> dict[str, Any]:
    base, key, model = os.getenv("AI_BASE_URL", "").rstrip("/"), os.getenv("AI_API_KEY", ""), os.getenv("AI_MODEL", "")
    if not (base and key and model):
        return {"configured": False, "status": "configuration_required", "message": "Set AI_BASE_URL, AI_API_KEY and AI_MODEL.",
          "plan": {"summary": request.prompt, "assumptions": ["Inspect target formats and dependencies first."],
          "steps": [{"title": "Analyze", "detail": "Inspect manifest, resources, code and asset formats."},
                    {"title": "Patch", "detail": "Prepare a minimal, reviewable patch for the decoded project."},
                    {"title": "Validate", "detail": "Rebuild, sign with a test key, install in an emulator and review logs."}],
          "files_to_review": [], "risks": ["Compiled apps may not support the feature without source-level changes."]}}
    system = ("You are APKForge AI, a cautious Android and game-modding engineer. Return valid JSON only with keys summary, assumptions, steps, files_to_review, risks. Steps are reviewable suggestions, not shell commands. Never claim to have edited files. Do not help bypass DRM, licensing, anti-cheat or access controls.")
    payload = {"model": model, "temperature": 0.2, "messages": [
      {"role": "system", "content": system},
      {"role": "user", "content": json.dumps(request.model_dump(), ensure_ascii=False)}]}
    url = base if base.endswith("/chat/completions") else base + "/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers={"Authorization": "Bearer " + key}, json=payload)
            response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"].strip()
        raw = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", raw)
        return {"configured": True, "status": "plan_ready", "plan": json.loads(raw)}
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(502, "AI provider request failed or returned invalid JSON: " + str(exc))

from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")
