import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Import our serverless handlers
import authLoginHandler from '../api/auth/login.js';
import authCallbackHandler from '../api/auth/callback.js';
import authLogoutHandler from '../api/auth/logout.js';
import authMeHandler from '../api/auth/me.js';
import profileHandler from '../api/x/profile.js';
import followingHandler from '../api/x/following.js';
import followersHandler from '../api/x/followers.js';
import postsHandler from '../api/x/posts.js';
import unfollowHandler from '../api/x/unfollow.js';
import followHandler from '../api/x/follow.js';
import analysisHandler from '../api/x/analysis.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3000;

const app = express();

// Disable frameguard so app can render in AI Studio preview iframe
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Enable CORS with credentials for GitHub Pages frontend support
app.use(cors({
  origin: true,
  credentials: true
}));

// Adapter helper to run Vercel-style (req, res) handlers on Express
const adapt = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

// Auth routes
app.get('/api/auth/login', adapt(authLoginHandler));
app.get('/api/auth/x/start', adapt(authLoginHandler)); // Alias for compatibility
app.get('/api/auth/callback', adapt(authCallbackHandler));
app.get('/api/auth/x/callback', adapt(authCallbackHandler)); // Alias for compatibility
app.all('/api/auth/logout', adapt(authLogoutHandler));
app.get('/api/auth/me', adapt(authMeHandler));

// X API routes
app.get('/api/x/profile', adapt(profileHandler));
app.get('/api/x/following', adapt(followingHandler));
app.get('/api/x/followers', adapt(followersHandler));
app.get('/api/x/posts', adapt(postsHandler));
app.all('/api/x/unfollow', adapt(unfollowHandler));
app.all('/api/x/follow', adapt(followHandler));
app.get('/api/x/analysis', adapt(analysisHandler));

// Backwards-compatible aliases
app.get('/api/analysis/not-following-back', adapt(analysisHandler));
app.post('/api/unfollow/:id', (req, res, next) => {
  req.body = req.body || {};
  req.body.target_user_id = req.params.id;
  return adapt(unfollowHandler)(req, res, next);
});

// Serve static assets from src/ and public/
app.use('/src', express.static(path.join(ROOT, 'src')));
app.use(express.static(path.join(ROOT, 'public')));

// Catch-all route for SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      errorType: err.errorType || 'SERVER_ERROR'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`X Control Center running at http://0.0.0.0:${PORT}`);
});
