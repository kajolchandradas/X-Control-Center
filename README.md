# X Control Center

A modern, production-ready X/Twitter account management and analytics dashboard built with official X API v2 data and client-side X Data Archive fallback.

**Zero Fake Data Guarantee**: This application never generates synthetic, demo, placeholder, or mock accounts. If the live X API is unavailable, credit-exhausted, or rate-limited, it clearly states the exact API error and enables offline analysis via personal X Data Archive import.

---

## Features

- **Real X OAuth 2.0 with PKCE**: Connect your X account securely without exposing secrets to client-side code.
- **Following vs. Followers Intelligence**: Instantly calculates and isolates accounts you follow who do not follow you back (`Not Following Back = Following - Followers`).
- **Mutual Followers Discovery**: Identifies reciprocal connections.
- **Advanced Multi-Criteria Filtering**:
  - Category: All Following, Not Following Back, Mutuals, Followers Only
  - Account Type: Verified, Unverified
  - Activity Level: Inactive (<50 posts), Active (50–2K posts), Highly Active (2K+ posts)
  - Follower Range: 0+, 100+, 1K+, 10K+, 100K+
  - Account Age: New (<1 year), 1+ years, 3+ years, 5+ years
  - Search: Debounced search across display names, handles, and bios
  - Sorting: Followers, Following, Total Posts, Joined Date (Newest/Oldest), Alphabetical
- **Safe Profile Management**:
  - Modal confirmation prior to unfollowing accounts
  - Instant direct profile inspection modal with recent post preview
  - Direct "Open on X" links
- **X Data Archive Fallback Mode**:
  - Import your official X data export (`following.js`, `follower.js` or `.json`)
  - 100% local in-browser parsing with zero server transmission
  - Clearly labeled with `DATA SOURCE: X DATA ARCHIVE`
- **Zero-Database Architecture (v1)**:
  - Ephemeral, encrypted session management via AES-256-GCM
  - Works out-of-the-box on serverless (Vercel, Netlify) or standard Node.js

---

## Project Structure

```
x-control-center/
├── api/
│   ├── auth/
│   │   ├── login.js          # PKCE OAuth authorization entry point
│   │   ├── callback.js       # Authorization code exchange & session setup
│   │   ├── logout.js         # Session destruction & cookie cleanup
│   │   └── me.js             # Session verification & current user profile
│   ├── x/
│   │   ├── profile.js        # User profile query (v2 /users/me or /users/:id)
│   │   ├── following.js      # Following list retrieval with pagination
│   │   ├── followers.js      # Followers list retrieval with pagination
│   │   ├── posts.js          # Recent user tweets/posts
│   │   ├── unfollow.js       # DELETE following relationship
│   │   ├── follow.js         # POST following relationship
│   │   └── analysis.js       # Live computation of following vs followers
│   └── utils/
│       └── x-client.js       # AES-256-GCM crypto, PKCE utils, X API client
├── public/
│   ├── index.html            # Static application entry point
│   ├── favicon.svg           # High-resolution vector favicon
│   └── assets/               # Static icons and assets
├── src/
│   ├── css/
│   │   ├── main.css          # Design system, Web3 dark tokens, base styling
│   │   ├── dashboard.css     # Stats cards, user rows, toolbar, modals, toasts
│   │   └── responsive.css    # Tablet & mobile responsive breakpoints
│   ├── js/
│   │   ├── app.js            # Main browser initialization script
│   │   ├── auth.js           # Auth state manager
│   │   ├── api.js            # API fetch layer & error categorizer (402, 403, 429)
│   │   ├── dashboard.js      # Dashboard coordinator & archive parser
│   │   ├── filters.js        # Multi-criteria filter engine
│   │   ├── following.js      # Follow/unfollow management with confirmation
│   │   ├── followers.js      # Followers list operations
│   │   └── storage.js        # localStorage for UI prefs (no tokens stored)
│   └── components/
│       ├── navbar.js         # Top navigation & status indicators
│       ├── sidebar.js        # Left navigation & badge counters
│       ├── stats.js          # Metric overview cards
│       ├── user-card.js      # Responsive user card/row component
│       └── modal.js          # Confirmation dialogues & toast system
├── server/
│   └── index.js              # Node.js Express server with serverless adapter
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── LICENSE                   # MIT License
├── metadata.json             # Applet descriptor
└── package.json              # Project scripts and dependencies
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `PORT` | Local dev server port (default: 3000) | `3000` |
| `APP_BASE_URL` | Root URL of your application backend | `http://localhost:3000` or `https://your-app.vercel.app` |
| `X_CLIENT_ID` | OAuth 2.0 Client ID from X Developer Portal | `YOUR_CLIENT_ID` |
| `X_CLIENT_SECRET` | OAuth 2.0 Client Secret (if confidential client) | `YOUR_CLIENT_SECRET` |
| `X_REDIRECT_URI` | Exact OAuth 2.0 Callback URL configured in X Portal | `http://localhost:3000/api/auth/callback` |
| `ENCRYPTION_KEY` | 32-byte key for AES-256-GCM token encryption | `generate with: openssl rand -base64 32` |
| `SESSION_SECRET` | HMAC secret for session signature | `random string or hash` |

---

## X Developer Portal Setup

1. Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard) and create a Project & App.
2. Under your app settings, click **Set up** under **User authentication settings**.
3. Choose **OAuth 2.0**.
4. Set **Type of App**: **Web App** (Confidential client) or **Single page App** (Public client).
5. Set **App permissions**: **Read and Write** (required for follows.read, follows.write, and users.read).
6. Under **Callback URI / Redirect URL**, add:
   - For local development: `http://localhost:3000/api/auth/callback`
   - For production (e.g. Vercel): `https://your-domain.vercel.app/api/auth/callback`
7. Under **Website URL**, add your application domain or repository URL.
8. Save and copy your **Client ID** and **Client Secret** into your `.env` file.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start local server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

---

## Deployment Options

### Option A: Turnkey Serverless on Vercel (Recommended)
1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. The serverless functions in `/api` will be detected automatically.
4. Set the Environment Variables (`X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `APP_BASE_URL`) in Vercel Project Settings.
5. Deploy.

### Option B: GitHub Pages (Frontend) + Vercel (Backend)
1. Deploy the backend to Vercel (steps above).
2. For GitHub Pages, deploy the `public/` directory and `src/` directory.
3. In `src/js/storage.js` or via the in-app **Settings** tab, configure `PUBLIC_API_BASE_URL` to point to your Vercel backend (`https://your-app.vercel.app`).
4. Ensure CORS on your backend allows your GitHub Pages domain.

### Option C: Container / Docker / Self-Hosted Node.js
```bash
npm run build
npm start
```
The Express server in `server/index.js` will bind to port 3000 and serve both static assets and API endpoints.

---

## Production Security Checklist

- [x] **No secrets in frontend code**: All OAuth exchanges, token decryption, and secret keys reside exclusively on the server.
- [x] **HTTP-only cookies**: Session tokens are held in signed, HTTP-only, SameSite cookies.
- [x] **No tokens in localStorage**: Only non-sensitive preferences and user-uploaded archive caches reside in client storage.
- [x] **AES-256-GCM encryption**: Stored access tokens and refresh tokens are encrypted at rest.
- [x] **PKCE verification**: Protects against authorization code interception attacks.
- [x] **Confirmation modals**: Irreversible unfollow actions always require explicit user confirmation.

---

## Troubleshooting

- **`X API credits are unavailable for this request`**:
  Official X API v2 requires an active developer subscription tier (Basic, Pro, or Enterprise) with remaining credits. You can immediately use the **Archive Import** tab to inspect your accounts offline using your downloaded X Data Archive.
- **`Invalid or expired OAuth state`**:
  Ensure cookies are allowed in your browser and that your `X_REDIRECT_URI` matches the X Developer Portal configuration character-for-character.
- **`Rate limit exceeded (429)`**:
  X API v2 enforces rate limits (typically 15-minute windows). Wait for the reset period or switch to the Archive Import tab.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
