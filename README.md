# X Control Center

A small, original X/Twitter account analyzer + unfollow dashboard using X OAuth 2.0 with PKCE, Express, and zero-setup JSON storage for development.

## Features
- Connect X via OAuth 2.0 PKCE
- Detect authenticated account automatically
- Show followers, following, total posts
- Load following + followers from X API
- Calculate "Not Following Back"
- Screenshot-style table: Name, Tweets, Joined, Friends, Followers, View, Unfollow
- Search and basic sorting
- Individual unfollow
- Bulk unfollow (max 50/request batch)
- Profile preview
- Secure encrypted token storage (AES-256-GCM)
- Local JSON database (`data/app_db.json`)
- Automatic token refresh when a refresh token is available

## Setup

1. Install Node.js 20+.
2. Create an X Developer App and enable OAuth 2.0.
3. Set the callback URL to exactly:
   `http://localhost:3000/api/auth/x/callback`
4. Copy `.env.example` to `.env` and fill:
   - `X_CLIENT_ID`
   - `X_CLIENT_SECRET`
   - `X_REDIRECT_URI`
   - `ENCRYPTION_KEY`
   - `SESSION_SECRET`
5. Generate a 32-byte encryption key:

   PowerShell:
   `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`

6. Run:
   `npm install`
   `npm start`
7. Open `http://localhost:3000`

## Important X API notes

- The app does not ask for an X password.
- The app does not fabricate follower/following data.
- Total likes is intentionally shown as unavailable because the authenticated user public metrics do not expose a total-likes count in this implementation.
- X API access, permissions, rate limits, and pay-per-use costs depend on the current X Developer access configured for your app.
- The local JSON store is intended for development. For production, move tokens/sessions/snapshots to persistent secure storage.

## Security
Never commit `.env` or real credentials to GitHub. Rotate credentials if they are exposed.
