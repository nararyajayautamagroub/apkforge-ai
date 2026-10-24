# APKForge AI — Remaining Work and Release Checklist

This checklist separates features that currently work in the development workflow from work that must not be treated as complete merely because CI produced installers.

## Verified in CI
- Source syntax checks and automated unit tests run before Windows and Android packaging.
- Windows NSIS `.exe` and `.msi` installers are produced as workflow artifacts.
- A debug Android `.apk` is produced as a workflow artifact.
- Desktop and mobile dashboard screenshots are captured in CI.
- Windows packaging uses `--publish never`; artifacts are uploaded by Actions instead of requiring a GitHub release token.

## Priority 0 — Before exposing the API publicly
- [ ] Add authentication and authorization to every project, upload, build, signing, AI, and undo endpoint.
- [ ] Enforce per-user workspace isolation; never let one user access another user's upload, project, backups, or artifacts.
- [x] Enforce a default 100 MiB upload-size cap in the API; operators can override it with `MAX_UPLOAD_BYTES`.
- [x] Add configurable per-process API rate limiting (default 120 requests per 60 seconds per IP; `/api/health` excluded) and apply the configured upload cap to asset uploads.
- [ ] Configure a shared/distributed limiter and request rate limits at the reverse proxy before multi-instance/public deployment.
- [ ] Run Android tooling in a disposable, resource-limited sandbox with network access disabled where possible.
- [ ] Keep API keys and keystore credentials in a secret manager/environment, never in source control or client-side code.
- [ ] Add malware scanning, retention/cleanup policies, audit logs, and quotas before accepting untrusted public uploads.

## Priority 1 — Editing and build reliability
- [ ] Add integration tests using a small, redistributable sample APK and verify decode → edit → rebuild behavior on a host with Java and Apktool.
- [ ] Test signing and signature verification with a temporary test keystore in CI; do not ship that key.
- [ ] Validate output APK installation and launch on an emulator or physical device.
- [ ] Add background jobs, progress reporting, cancellation, and safe cleanup for long-running decode/build tasks.
- [ ] Add fixture-based tests for archive bombs, malformed ZIPs, symlinks, path traversal, oversized assets, and invalid project identifiers.
- [ ] Add dependency audit and license review as a separate release gate; triage findings rather than blindly applying breaking upgrades.

## Priority 2 — Feature completeness
- [ ] Add format-specific adapters for supported texture/model/audio formats and validate each with known fixtures. A generic file replacement is not proof of game-engine compatibility.
- [ ] Improve APK/OBB inspection with clear per-format support and explicit encrypted/proprietary-format errors.
- [ ] Add diff preview, staged patch validation, transactional multi-file apply, and rollback tests for AI proposals.
- [ ] Add configurable provider timeouts, response-size limits, structured-output validation, and user-visible AI error states.
- [ ] Add platform-specific testing for Windows installers and the Android shell on real devices.

## Rate-limit configuration
- `API_RATE_MAX` sets the allowed requests per IP per window (default `120`).
- `API_RATE_WINDOW_MS` sets the window length in milliseconds (default `60000`).
- The in-memory limiter is per process and is not a substitute for a shared store or reverse-proxy protection on a public, multi-instance deployment. Avoid enabling `trust proxy` unless the proxy chain is explicitly configured.

## Important limitations
- The generated Android package is a dashboard shell. Processing features require a separately hosted, reachable HTTPS API.
- Rebuilt APKs are unsigned unless signing is configured with a keystore controlled by the operator.
- APKs are not converted directly into native Windows executables. A Windows build requires a compatible runtime or a separate port/rebuild.
- AI suggestions are proposals, not proof that code or assets are correct. Review diffs and run tests before accepting them.
- CI success confirms the configured checks and packaging steps passed; it does not prove universal compatibility or production security.

## Release acceptance
A release should be called production-ready only after the relevant unchecked security, integration, device, and compatibility checks have been completed and their results recorded. Do not mark unchecked items complete based only on successful packaging.
