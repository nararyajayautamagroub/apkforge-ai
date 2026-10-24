# Android APK packaging

The GitHub Actions workflow generates a debug APK from the Capacitor shell. This APK packages the dashboard UI; the processing API still needs to be hosted on a reachable server. Set the API base URL in the app's connection settings before using upload, decode, AI, or build operations.

For local development:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

A debug APK is for testing. A public release should use a private signing key stored as protected CI secrets and should use HTTPS for the API. Do not commit signing keys, passwords, or AI provider credentials.
