# APKForge AI

APKForge AI is a browser-based workbench for inspecting Android package archives and planning authorized modifications to apps and game assets you own or have permission to edit.

## Implemented workflow

- Responsive Indonesian web dashboard.
- Upload `.apk`, `.apks`, `.aab`, `.obb`, `.zip`, and `.apfproj`.
- ZIP-compatible archive listing without extracting the archive. Preview safety caps: 5,000 entries and 2 GiB total declared uncompressed size.
- APK decode into a workspace using Apktool, when Apktool and Java are installed on the host.
- Project file listing and editing for selected text formats (XML, JSON, text, properties, Smali, HTML, JS, CSS, Java/Kotlin, YAML and config files), limited to 2 MiB per file.
- Rebuild decoded projects into an **unsigned APK** using Apktool.
- AI change-plan endpoint compatible with chat-completions style providers.
- Allowlisted process helper for Apktool, JADX, and apksigner.
- GitHub Actions syntax validation.

## Run locally

Requirements: Node.js 20+, Java runtime, and Apktool for decode/build features.

```bash
npm install
cp .env.example .env
npm run check
npm run dev
```

Open `http://127.0.0.1:8787`. On Windows, use `copy .env.example .env` if `cp` is unavailable.

Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in `.env` for an OpenAI-compatible provider. Never commit API keys.

## API

- `GET /api/health` — service status.
- `GET /api/formats` — supported formats and limitations.
- `POST /api/uploads` — upload one file as multipart field `file`.
- `GET /api/uploads/:id/inspect` — preview entries of ZIP-compatible uploads.
- `POST /api/uploads/:id/decode` — decode an uploaded APK with Apktool.
- `GET /api/projects/:id/files` — list decoded project files.
- `GET /api/projects/:id/file?path=...` — read an editable text file.
- `PUT /api/projects/:id/file` — JSON body: `{ "path": "res/values/strings.xml", "content": "..." }`.
- `POST /api/projects/:id/build` — build unsigned APK.
- `GET /api/projects/:id/artifact` — download generated unsigned APK.
- `POST /api/ai/plan` — generate a change plan from JSON `{ "request": "..." }`.

## Current limitations (read before production)

This is a functional development workflow, **not a completed universal APK modder**. Decode/build depends on the host having Apktool and Java installed. Rebuilt output is unsigned. The project editor edits text files only; it does not automatically replace 3D models, textures, vehicle assets, or arbitrary binary resources. The AI endpoint currently plans changes; it does not apply AI-generated patches automatically. JADX and apksigner helpers are not wired into a complete GUI workflow.

An APK cannot be directly converted into a native Windows EXE. A Windows release generally requires porting or rebuilding for Windows or a compatible wrapper/runtime. OBB files may be proprietary, encrypted, or game-specific; generic archive preview cannot interpret all OBB data.

Before exposing the service to the internet, add authentication, per-user project isolation, rate limits, quotas, malware scanning, background job queue, and a hardened container/sandbox for Android tooling. Set an explicit upload cap for public deployments. `MAX_UPLOAD_BYTES=0` disables only the app-level cap; disk, proxy and host limits remain.

Use only software and assets you are authorized to modify. Do not use this project to bypass DRM, licensing, anti-cheat, or access controls. Never execute uploaded binaries on the server.
