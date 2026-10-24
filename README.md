# APKForge AI

APKForge AI is a browser-based workbench starter for inspecting Android package archives and planning authorized modifications to apps and game assets you own or have permission to edit.

## Implemented in this repository

- Responsive Indonesian dashboard served by the Node.js API.
- Upload endpoint for `.apk`, `.apks`, `.aab`, `.obb`, `.zip`, and `.apfproj`.
- ZIP-compatible archive listing for uploaded files, including APK/AAB and OBB files that are standard ZIP containers.
- Archive preview caps: 5,000 entries and 2 GiB total declared uncompressed size. Preview does not extract or alter the uploaded file.
- AI change-plan endpoint compatible with chat-completions style providers.
- Allowlisted Android tool process helper for Apktool, JADX, and apksigner.
- Configurable app-level upload size cap. `MAX_UPLOAD_BYTES=0` removes the app-level cap only; host, reverse proxy, storage, memory and disk limits still apply.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run check
npm run dev
```

Open `http://127.0.0.1:8787`.

On Windows, use `copy .env.example .env` in Command Prompt if `cp` is unavailable.

## AI configuration

Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in `.env` for an OpenAI-compatible provider. Never commit API keys. Without a provider, the API returns a local planning response rather than performing model-powered code changes.

## API

- `GET /api/health` — service status and configured upload limit.
- `GET /api/formats` — supported input/output notes.
- `POST /api/uploads` — upload one file using multipart field `file`.
- `GET /api/uploads/:id/inspect` — list entries in ZIP-compatible uploads.
- `POST /api/ai/plan` — generate a change plan from JSON `{ "request": "..." }`.

## Important: what is not complete yet

This repository is **not a finished universal APK modder**. It currently uploads and previews archive contents and can produce AI change plans. It does not yet apply arbitrary AI-generated patches, edit Android manifests/resources through a full UI, replace vehicle models/textures in a game-specific format, rebuild and sign modified APKs end-to-end, or generate native Windows EXE/MAU outputs.

An APK cannot be converted directly into a native Windows EXE by renaming or repackaging it. A Windows version generally requires a compatible runtime/wrapper or a separate port. OBB files may use proprietary formats, encryption, or game-specific structures that cannot be edited generically. Those features need the target game's format, suitable toolchain, test fixtures, and runtime verification before they can honestly be marked complete.

Use only files and assets you are authorized to modify. Do not use this project to bypass DRM, licensing, anti-cheat, or access controls. Uploaded files are treated as data and are not executed by the server.
