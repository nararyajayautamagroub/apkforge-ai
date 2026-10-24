# Desktop and Android builds

APKForge AI has a Windows desktop shell and a Capacitor Android shell.

## Windows

Run `npm install`, then `npm run desktop:win` on Windows. Electron Builder produces a Windows installer executable (`.exe`) and an MSI-wrapped NSIS installer (`.msi`) under `release/`. The MSI wraps the normal Windows installer rather than using a separate native WiX installer; this avoids a reproducible missing-icon failure in the native MSI build.

The desktop shell starts the local Node/Express API. Android tooling such as Java and Apktool must still be installed separately for APK decode/rebuild features.

## Android

The GitHub Actions workflow creates a **debug APK** at `android/app/build/outputs/apk/debug/app-debug.apk`. Download it from the workflow's Artifacts section. This is not a Play Store-signed release.

The APK bundles the dashboard UI, while the processing API remains a server component. Host the API on a reachable HTTPS server, open APKForge AI's API connection settings, enter the server base URL (without a trailing slash), save it, and test the connection. Configure CORS on the server to allow the app origin when required. Do not put AI keys or signing secrets in the Android client.

## Automated builds

- Run the “Build APKForge AI installers” workflow manually from Actions, or push a version tag such as `v0.2.0`.
- Download `apkforge-ai-windows-installers` for `.exe` and `.msi`.
- Download `apkforge-ai-android-debug-apk` for `.apk`.

The workflow has been committed as configuration; artifacts are only available after the workflow successfully runs. A successful package build does not replace real-device and Windows installation tests.
## APK signing for projects edited in the workbench

To enable the **Sign & verify APK** button, install Android Build Tools containing `apksigner` on the server and set these values in the server's private `.env`:

- `APKFORGE_KEYSTORE_PATH`: path to a keystore file stored securely on the server.
- `APKFORGE_KEY_ALIAS`: alias of the signing key.
- `APKFORGE_KEYSTORE_PASSWORD`: keystore password.
- `APKFORGE_KEY_PASSWORD`: private-key password.

Never commit the keystore or these values. Signing keys must remain under your control. The app verifies the signature after signing, but you must still test the resulting APK on a device.
