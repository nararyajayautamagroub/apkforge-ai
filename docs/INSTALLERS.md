# Desktop and Android builds

APKForge AI has a Windows desktop shell and a Capacitor Android shell.

## Windows

Run `npm install`, then `npm run desktop:win` on Windows. Electron Builder produces a Windows installer executable (`.exe`) and a Windows Installer package (`.msi`) under `release/`.

The desktop shell starts the local Node/Express API. Android tooling such as Java and Apktool must still be installed separately for APK decode/rebuild features.

## Android

The GitHub Actions workflow creates a **debug APK** at `android/app/build/outputs/apk/debug/app-debug.apk`. Download it from the workflow's Artifacts section. This is not a Play Store-signed release.

The APK bundles the dashboard UI, while the processing API remains a server component. Host the API on a reachable HTTPS server, open APKForge AI's API connection settings, enter the server base URL (without a trailing slash), save it, and test the connection. Configure CORS on the server to allow the app origin when required. Do not put AI keys or signing secrets in the Android client.

## Automated builds

- Run the “Build APKForge AI installers” workflow manually from Actions, or push a version tag such as `v0.2.0`.
- Download `apkforge-ai-windows-installers` for `.exe` and `.msi`.
- Download `apkforge-ai-android-debug-apk` for `.apk`.

The workflow has been committed as configuration; artifacts are only available after the workflow successfully runs. A successful package build does not replace real-device and Windows installation tests.