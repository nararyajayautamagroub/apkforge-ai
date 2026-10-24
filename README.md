# APKForge AI

A modular Android package inspection and modding workbench for **apps and games you own or are authorized to modify**. The project is designed around a web UI, a local processing API, optional AI-assisted patch planning, and reproducible build jobs.

## Planned capabilities

- Import APK, split APK sets, OBB, ZIP, and project bundles.
- Inspect package ID, app version, manifest permissions, resources, assets, and file inventory.
- Decode/rebuild Android resources with Android build tools such as Apktool; inspect code with JADX.
- Edit manifest metadata and text/resource files through a guarded workspace.
- Asset workspace for authorized game assets such as vehicle models, textures, sounds, and UI images.
- AI prompt-to-patch workflow: describe the desired change, receive a proposed patch and explanation, review a diff, then explicitly apply it.
- Build, sign with a user-owned signing key, and run validation checks.
- Export an Android APK or a portable `.apfproj` project bundle.
- Windows export is a **separate wrapper/porting project**, not a conversion of Android bytecode into a native Windows EXE. A wrapper only works when the app's functionality can be reimplemented or hosted appropriately.
- OBB support is for listing, extracting, replacing, and repacking compatible asset containers. OBB files are not executable packages.
- `.mau` is not a universally recognized Android/Windows package format. APKForge AI treats it as a configurable custom export extension only if a format specification is supplied.

## Architecture

- `web/`: browser UI.
- `server/`: API and job orchestration.
- `server/src/services/archive.js`: archive inventory and safe extraction.
- `server/src/services/ai.js`: AI provider adapter; API keys stay on the server.
- `server/src/services/android-tools.js`: isolated command runner for installed Android tools.
- `worker/`: long-running build jobs, separated from web requests.

## Requirements

- Node.js 20+
- Java 17+
- Android SDK build-tools / `apksigner`
- Apktool and JADX installed separately for local use
- Optional AI provider API key

## Quick start

1. Copy `.env.example` to `.env` and configure values.
2. Install dependencies with `npm install`.
3. Start the API using `npm run dev`.
4. Run the worker in a separate terminal with `npm run worker`.

This repository is a starter implementation. Tool integrations and signing/build jobs must be configured and tested on the host machine before production use.

## Upload limits

There is no hard-coded product-level file-size cap in the design. Real limits still depend on available disk space, reverse-proxy settings, server memory, storage quotas, and abuse protection. Large files are streamed to disk; they must not be buffered entirely in RAM.

## Security and legal boundaries

- Only modify packages and assets you own or have permission to modify.
- Do not use this tool to bypass licensing, payment, DRM, anti-cheat, account protections, or security controls.
- AI-generated patches are untrusted until reviewed and tested.
- Never execute uploaded binaries. Process jobs in isolated containers with CPU, memory, disk, and time limits.
- Do not upload signing keys or secrets to GitHub.
- APKForge AI cannot guarantee that arbitrary modifications will work; obfuscation, native libraries, signatures, integrity checks, and game-specific asset formats can prevent rebuilding or runtime compatibility.

## License

No license has been selected yet. Add a license before distributing the project.
