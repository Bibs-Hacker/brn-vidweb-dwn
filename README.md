# Dev Brian Video Downloader
**TEAM NASA project** — dark premium full-stack starter.

## What works now
- Responsive dark premium interface.
- Validates supported TikTok, Instagram, Facebook, and direct video URLs.
- Direct HTTPS media URLs ending in `.mp4`, `.webm`, `.mov`, or `.m4v` are returned as downloadable links.
- API input validation, request rate limiting, security headers, safe error messages, and provider timeouts.
- Optional adapter for an authorized media provider.

## Important platform limitation
This project does **not** scrape social platforms, bypass private/restricted posts, use login cookies, or circumvent DRM. There is no universal official endpoint that lets an unaffiliated website download arbitrary videos from all three platforms. A TikTok/Instagram/Facebook post URL will be recognized, but actual media retrieval requires a provider you are authorized to use and that complies with the relevant platform terms. Without one configured, the app explains this and directs users to the platform's built-in download/save options when available.

TikTok's official developer APIs are authorization- and scope-based; review the [TikTok developer documentation](https://developers.tiktok.com/) and [TikTok download settings](https://support.tiktok.com/en/account-and-privacy/account-privacy-settings/video-downloads). Do not advertise platform-link downloading as working until you have tested an approved integration.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:3000

Windows PowerShell alternative for the environment file:
```powershell
Copy-Item .env.example .env
```

## Authorized provider adapter
Set these environment variables only if you have a provider you are authorized to use:

```env
MEDIA_PROVIDER_URL=https://your-authorized-provider.example/api/resolve
MEDIA_PROVIDER_TOKEN=your_secret_token
```

The server sends:
```json
{"url":"https://www.tiktok.com/@creator/video/123"}
```

Expected provider response:
```json
{
  "title": "Video title",
  "thumbnail": "https://cdn.example.com/thumb.jpg",
  "formats": [
    {"url":"https://cdn.example.com/video.mp4","quality":"720p","ext":"mp4"}
  ]
}
```

Provider requirements:
- HTTPS endpoint.
- Require authentication and rate limits.
- Only return media URLs the user is authorized to download.
- Use short-lived URLs where possible.
- Do not return private content or bypass access controls.
- Returned format URLs must be HTTPS and use an allowed video extension.
- Keep `MEDIA_PROVIDER_TOKEN` on the server. Never put secrets in frontend JavaScript.

## Deploy free-tier on Render
1. Push this folder to a GitHub repository.
2. Sign in at https://render.com and create a **Web Service** from the repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Choose a free instance if available for your account and region.
6. Add environment variables from `.env.example` in the Render dashboard if you have an authorized provider. Do not upload `.env`.
7. Deploy, then open the `onrender.com` URL and test `/api/health`.

Free-tier details and availability can change; check Render's current plan terms. Free services may sleep when idle, so the first request can be slow.

## Before public launch
- Add a privacy policy and terms of use.
- Add abuse reporting and a contact email.
- Review platform terms, copyright rules, and your provider contract.
- Add stronger per-IP/user quotas and monitoring.
- Test large files and provider timeouts.
- Consider a custom domain and HTTPS (Render supplies HTTPS for its service URL).

## API
- `GET /api/health` — health check.
- `POST /api/resolve` — body `{ "url": "https://...", "rightsConfirmed": true }`.
