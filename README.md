# APKForge AI

AI-assisted APK and OBB inspection workspace for software and game assets you own or are authorized to modify.

## Current starter implementation
- FastAPI backend and browser dashboard.
- Streamed APK, OBB, ZIP, model and texture uploads. There is no application-level upload-size cap; host, proxy, storage and disk limits still apply.
- ZIP-compatible archive inspection.
- Optional Apktool APK decode endpoint.
- Natural-language AI change-plan endpoint using an OpenAI-compatible API.
- Planned extensions for vehicle asset editing, UI/button editing, rebuild/signing and Windows porting.

## Important limitations
An APK cannot simply be renamed or directly converted to EXE. Android applications rely on Android runtime and APIs; a Windows release usually requires porting or rebuilding a source project. OBB formats may be proprietary, encrypted or game-specific. AI plans are suggestions and do not guarantee arbitrary features can be inserted into compiled apps.

Use only software and assets you have permission to modify. Do not use this project to bypass DRM, licensing, anti-cheat or access controls. Uploaded files are treated as data and are never launched by the server.

## Requirements
- Python 3.11+
- Optional Java and Apktool for APK decoding
- Optional OpenAI-compatible AI API endpoint and key

## Run locally
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    uvicorn app.main:app --reload

On Windows, activate with .venv\Scripts\activate instead of the source command. Open http://127.0.0.1:8000.

Set AI_BASE_URL, AI_API_KEY and AI_MODEL in .env to enable AI planning. Never commit real API keys.

## API
- GET /api/health
- POST /api/files
- GET /api/files
- POST /api/inspect/{file_id}
- POST /api/decompile/{file_id}
- POST /api/ai/plan

This is a functional starter, not a promise of automatic universal APK modding. Build, signing, runtime validation, direct asset replacement and native Windows export remain future modules.
