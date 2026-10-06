import crypto from 'crypto';

// In-memory session and OAuth state store (no database required for V1)
const sessions = new Map();
const oauthStates = new Map();

// Configuration
export const CLIENT_ID = process.env.X_CLIENT_ID || '';
export const CLIENT_SECRET = process.env.X_CLIENT_SECRET || '';
export const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VERCEL_URL ? (process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : 'http://localhost:3000';
export const REDIRECT_URI = process.env.X_REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'x-control-center-dev-session-secret-key-32b';
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'x-control-center-encryption-key-32-bytes!';

// Required scopes for X OAuth 2.0 PKCE
export const SCOPES = ['users.read', 'tweet.read', 'follows.read', 'follows.write', 'offline.access'];

// Helper to derive 32-byte key for AES-256-GCM
function getEncryptionKey() {
  try {
    const b = Buffer.from(ENCRYPTION_KEY, 'base64');
    if (b.length === 32) return b;
  } catch {}
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

const ENC_KEY = getEncryptionKey();

export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decrypt(payload) {
  if (!payload) return '';
  const [ivStr, tagStr, dataStr] = payload.split('.');
  if (!ivStr || !tagStr || !dataStr) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivStr, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagStr, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataStr, 'base64url')), decipher.final()]).toString('utf8');
}

export function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(24));
  return { verifier, challenge, state };
}

export function saveOAuthState(state, verifier) {
  // Clean expired states older than 15 mins
  const now = Date.now();
  for (const [k, v] of oauthStates.entries()) {
    if (now - v.createdAt > 15 * 60 * 1000) oauthStates.delete(k);
  }
  oauthStates.set(state, { verifier, createdAt: now });
}

export function consumeOAuthState(state) {
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  if (Date.now() - entry.createdAt > 15 * 60 * 1000) return null;
  return entry.verifier;
}

export function signSessionId(id) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('base64url');
}

export function verifySessionCookie(cookieValue) {
  if (!cookieValue) return null;
  const [id, sig] = cookieValue.split('.');
  if (!id || !sig) return null;
  const expected = signSessionId(id);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    return null;
  }
  return { id, session };
}

export function createSession(userData, tokens) {
  const sessionId = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const session = {
    userId: userData.id,
    user: userData,
    accessTokenEncrypted: encrypt(tokens.access_token),
    refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    tokenExpiresAt: now + (tokens.expires_in || 7200) * 1000,
    createdAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  sessions.set(sessionId, session);
  return {
    sessionId,
    cookieValue: `${sessionId}.${signSessionId(sessionId)}`
  };
}

export function deleteSession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

// Token refresh
export async function getValidAccessToken(session) {
  if (!session) throw new Error('No session provided');
  const now = Date.now();
  // If access token valid for at least another 60 seconds
  if (session.tokenExpiresAt && now < session.tokenExpiresAt - 60000) {
    return decrypt(session.accessTokenEncrypted);
  }

  // Refresh token required
  if (!session.refreshTokenEncrypted) {
    return decrypt(session.accessTokenEncrypted);
  }

  const refreshToken = decrypt(session.refreshTokenEncrypted);
  if (!refreshToken) throw new Error('No refresh token available');

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: CLIENT_ID
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (CLIENT_SECRET) {
    headers['Authorization'] = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
  }

  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error_description || data?.error || 'Token refresh failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }

  session.accessTokenEncrypted = encrypt(data.access_token);
  if (data.refresh_token) {
    session.refreshTokenEncrypted = encrypt(data.refresh_token);
  }
  session.tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
  return data.access_token;
}

// Standardized X API fetcher with detailed status categorization
export async function callXApi(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  // Extract rate-limit headers
  const rateLimit = {
    limit: res.headers.get('x-rate-limit-limit'),
    remaining: res.headers.get('x-rate-limit-remaining'),
    reset: res.headers.get('x-rate-limit-reset')
  };

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    let errorType = 'API_ERROR';
    let userMessage = 'X API request failed.';

    if (res.status === 401) {
      errorType = 'UNAUTHORIZED';
      userMessage = 'X authorization has expired or is invalid. Please reconnect your X account.';
    } else if (res.status === 402) {
      errorType = 'CREDITS_UNAVAILABLE';
      userMessage = 'X API credits are unavailable for this request. Official X API requires an active Developer subscription. No fake accounts will be displayed. You can import your X Data Archive below.';
    } else if (res.status === 403) {
      // Check for credit / tier issues often reported as 403 by X
      const detail = (body?.detail || body?.title || '').toLowerCase();
      if (detail.includes('credit') || detail.includes('tier') || detail.includes('subscription') || detail.includes('usage cap')) {
        errorType = 'CREDITS_UNAVAILABLE';
        userMessage = 'X API credits or usage tier unavailable for this request. No fake accounts will be displayed. You can import your official X Data Archive below.';
      } else {
        errorType = 'FORBIDDEN';
        userMessage = body?.detail || 'X API access is forbidden for this endpoint. Please verify X Developer App permissions (Read and Write).';
      }
    } else if (res.status === 429) {
      errorType = 'RATE_LIMITED';
      userMessage = 'X API rate limit reached. Please wait before refreshing.';
    } else if (res.status >= 500) {
      errorType = 'SERVER_ERROR';
      userMessage = 'X servers temporarily unavailable. Please try again shortly.';
    }

    const err = new Error(userMessage);
    err.status = res.status;
    err.errorType = errorType;
    err.raw = body;
    err.rateLimit = rateLimit;
    throw err;
  }

  return { data: body, rateLimit };
}

// User object formatter
export function formatUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name || '',
    username: u.username || '',
    description: u.description || '',
    profile_image_url: u.profile_image_url || '',
    created_at: u.created_at || null,
    verified: Boolean(u.verified || u.is_blue_verified || u.verified_type),
    verified_type: u.verified_type || (u.verified ? 'blue' : null),
    protected: Boolean(u.protected),
    location: u.location || '',
    url: u.url || '',
    followers_count: u.public_metrics?.followers_count ?? null,
    following_count: u.public_metrics?.following_count ?? null,
    tweet_count: u.public_metrics?.tweet_count ?? null,
    listed_count: u.public_metrics?.listed_count ?? null,
    like_count: u.public_metrics?.like_count ?? null
  };
}
