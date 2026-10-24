# APKForge AI

APKForge AI is a browser-based workbench for inspecting Android package archives and planning authorized modifications to apps and game assets you own or have permission to edit.

## Implemented workflow

- Responsive Indonesian web dashboard.
- Upload `.apk`, `.apks`, `.aab`, `.obb`, `.zip`, `.apfproj`, `.exe`, and `.msi` for safe storage. EXE/MSI files are never executed by the server.
- ZIP-compatible archive listing without extracting the archive. Preview safety caps: 5,000 entries and 2 GiB total declared uncompressed size.
- APK decode into a workspace using Apktool, when Apktool and Java are installed on the host.
- Project file listing and editing for selected text formats (XML, JSON, text, properties, Smali, HTML, JS, CSS, Java/Kotlin, YAML and config files), limited to 2 MiB per file.
- Rebuild decoded projects into an **unsigned APK** using Apktool.
- Optional APK signing and signature verification using a keystore configured on the server.
- AI change-plan endpoint compatible with chat-completions style providers.
- AI patch proposals for a selected editable file, with path/content validation and a review step before the user explicitly applies the proposal.
- Allowlisted process helper for Apktool, JADX, and apksigner.
- Asset Manager for replacing supported image, texture, model, audio and data assets, with backup/undo.
- Backup/undo for text file edits and binary asset replacement.
- Windows desktop packaging configured for `.exe` and `.msi` installers through Electron Builder.
- Capacitor Android shell and GitHub Actions workflow configured to build a debug `.apk`.
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
- `POST /api/projects/:id/sign` — sign the generated APK using server-configured keystore credentials and verify the signature.
- `GET /api/projects/:id/signed-artifact` — download the signed APK.
- `POST /api/ai/plan` — generate a change plan from JSON `{ "request": "..." }`.
- `POST /api/projects/:id/undo` — restore the latest backup of a text file.
- `PUT /api/projects/:id/asset` — replace a supported binary asset with multipart fields `path` and `file`.
- `POST /api/projects/:id/asset/undo` — restore the latest asset backup.
- `POST /api/projects/:id/ai/patch-plan` — propose a reviewable text-file edit from JSON `{ "request": "...", "paths": ["res/values/strings.xml"] }`. The AI can only propose edits to the selected editable files; the proposal is not applied until the user reviews it and explicitly confirms.

## Current limitations (read before production)

This is a functional development workflow, **not a completed universal APK modder**. Decode/build depends on the host having Apktool and Java installed. Rebuilt output is unsigned until the optional signing workflow is configured with a keystore you control. Never commit keystores or passwords. The project editor edits text files only; it does not automatically replace 3D models, textures, vehicle assets, or arbitrary binary resources. The AI planner creates plans, and the patch endpoint proposes edits to selected text files. A proposal requires manual review and explicit confirmation before it is saved; this is not an autonomous feature generator. Asset replacement is format-agnostic at the file level and cannot guarantee game-specific model/texture compatibility.

The project can be packaged as its own Windows `.exe` installer and `.msi` installer, and as an Android debug `.apk`. These are APKForge AI app builds, not automatic conversion of an uploaded APK into Windows binaries. An APK cannot be directly converted into a native Windows EXE. The Android APK bundles the dashboard UI; the processing API must be hosted on a reachable HTTPS server and configured in the app. OBB files may be proprietary, encrypted, or game-specific; generic archive preview cannot interpret all OBB data.

Before exposing the service to the internet, add authentication, per-user project isolation, rate limits, quotas, malware scanning, background job queue, and a hardened container/sandbox for Android tooling. Set an explicit upload cap for public deployments. `MAX_UPLOAD_BYTES=0` disables only the app-level cap; disk, proxy and host limits remain.

Use only software and assets you are authorized to modify. Do not use this project to bypass DRM, licensing, anti-cheat, or access controls. Never execute uploaded binaries on the server.

## Desktop and Android packages

See [`docs/INSTALLERS.md`](docs/INSTALLERS.md). Run the `Build APKForge AI installers` workflow from GitHub Actions to generate Windows `.exe`/`.msi` installers and an Android debug `.apk`. The workflow has been configured in the repository, but build artifacts exist only after a successful workflow run. The Android package requires a separately hosted HTTPS API for processing features.
