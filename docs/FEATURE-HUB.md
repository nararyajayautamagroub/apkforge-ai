# Feature Hub

The responsive Feature Hub is available at `/feature-hub.html` when the FastAPI static app is running.

## Available now
- Quran.com shortcut for reading the Qur'an.
- YouTube search shortcut for shalawat audio.
- WEBTOON and Crunchyroll shortcuts for comics and anime.
- Google Play Games shortcut.
- Local phone-number format validation for Indonesian mobile numbers. It does not query WhatsApp or reveal account/identity information.
- Broadcast-message draft builder for recipients who opted in. It only creates/copies text; it does not send messages automatically.
- Security learning shortcuts for OWASP, Android support, and connection testing.
- Search/filter cards by keyword.

## Not implemented intentionally
The hub does not provide DDoS, Wi-Fi disruption, phone spying, WhatsApp crash/freeze/blank payloads, spam, group takeover, or explicit sexual content. These can harm people, compromise privacy, or disrupt services. The app does not claim to verify whether a phone number is registered on WhatsApp.

## Run
Follow the repository README to install dependencies and start the app, then open `http://127.0.0.1:8787/feature-hub.html`.

External services have their own terms, availability, and regional restrictions. Review external links before deployment.
