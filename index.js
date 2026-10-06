import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'app_db.json');
await fs.mkdir(DATA_DIR, { recursive: true });

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const REDIRECT_URI = process.env.X_REDIRECT_URI || `${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/api/auth/x/callback`;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-me';
const SCOPES = ['users.read','tweet.read','follows.read','follows.write','offline.access'];

function requireEnv() {
  const missing = [];
  if (!CLIENT_ID) missing.push('X_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('X_CLIENT_SECRET');
  if (!ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (missing.length) console.warn(`Missing environment variables: ${missing.join(', ')}`);
}
requireEnv();

function keyFromEnv() {
  if (!ENCRYPTION_KEY) return null;
  try {
    const b = Buffer.from(ENCRYPTION_KEY, 'base64');
    if (b.length === 32) return b;
  } catch {}
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}
const ENC_KEY = keyFromEnv();

function encrypt(value) {
  if (!ENC_KEY) throw new Error('ENCRYPTION_KEY is not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(b => b.toString('base64url')).join('.');
}
function decrypt(payload) {
  if (!ENC_KEY) throw new Error('ENCRYPTION_KEY is not configured');
  const [ivB, tagB, dataB] = payload.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]).toString('utf8');
}

async function readDb() {
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); }
  catch { return { users: [], sessions: [], oauthStates: [], snapshots: [] }; }
}
async function writeDb(db) {
  const tmp = DB_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

function base64url(buf) { return Buffer.from(buf).toString('base64url'); }
function pkceVerifier() { return base64url(crypto.randomBytes(32)); }
function pkceChallenge(verifier) { return base64url(crypto.createHash('sha256').update(verifier).digest()); }
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}
function setSession(res, sessionId) {
  const value = `${sessionId}.${sign(sessionId)}`;
  res.cookie('x_session', value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 30 });
}
function getSessionId(req) {
  const raw = req.cookies.x_session;
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(id)))) return null;
  return id;
}
async function authContext(req) {
  const sid = getSessionId(req);
  if (!sid) return null;
  const db = await readDb();
  const session = db.sessions.find(s => s.id === sid && new Date(s.expiresAt) > new Date());
  if (!session) return null;
  const user = db.users.find(u => u.id === session.userId);
  if (!user) return null;
  return { db, session, user };
}
function requireAuth(req,res,next) { authContext(req).then(ctx => ctx ? (req.auth=ctx,next()) : res.status(401).json({error:'Not authenticated'})).catch(next); }

async function xFetch(url, token, options={}) {
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const err = new Error(body?.detail || body?.title || `X API error ${response.status}`);
    err.status = response.status; err.body = body; throw err;
  }
  return body;
}

async function getToken(user) {
  const token = decrypt(user.refreshTokenEncrypted);
  // Refresh proactively when close to expiry.
  if (user.tokenExpiresAt && Date.now() < new Date(user.tokenExpiresAt).getTime() - 60_000) return decrypt(user.accessTokenEncrypted);
  const body = new URLSearchParams({ refresh_token: token, grant_type: 'refresh_token', client_id: CLIENT_ID });
  const r = await fetch('https://api.x.com/2/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  const data = await r.json();
  if (!r.ok) { const e = new Error(data?.error_description || 'Token refresh failed'); e.status=r.status; throw e; }
  user.accessTokenEncrypted = encrypt(data.access_token);
  if (data.refresh_token) user.refreshTokenEncrypted = encrypt(data.refresh_token);
  user.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 7200)*1000).toISOString();
  const db = await readDb();
  const idx = db.users.findIndex(u=>u.id===user.id); if(idx>=0) db.users[idx]=user; await writeDb(db);
  return data.access_token;
}

async function apiMe(token) {
  return xFetch('https://api.x.com/2/users/me?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics', token);
}
async function apiAllFollowing(token, userId) {
  return apiAllUsers(token, `https://api.x.com/2/users/${userId}/following`, 'following');
}
async function apiAllFollowers(token, userId) {
  return apiAllUsers(token, `https://api.x.com/2/users/${userId}/followers`, 'followers');
}
async function apiAllUsers(token, baseUrl, type) {
  const all=[]; let paginationToken;
  do {
    const url = new URL(baseUrl);
    url.searchParams.set('max_results','1000');
    url.searchParams.set('user.fields','id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics');
    if (paginationToken) url.searchParams.set('pagination_token', paginationToken);
    const data = await xFetch(url, token);
    all.push(...(data.data || []));
    paginationToken = data.meta?.next_token;
  } while (paginationToken);
  return all;
}
function accountView(u) {
  return { id:u.id, name:u.name, username:u.username, description:u.description||'', profile_image_url:u.profile_image_url||'', created_at:u.created_at||null, verified:!!u.verified, protected:!!u.protected, followers_count:u.public_metrics?.followers_count ?? null, following_count:u.public_metrics?.following_count ?? null, tweet_count:u.public_metrics?.tweet_count ?? null, listed_count:u.public_metrics?.listed_count ?? null };
}

app.get('/api/auth/x/start', async (req,res,next)=>{
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !ENC_KEY) return res.status(500).send('X OAuth is not configured. Add X_CLIENT_ID, X_CLIENT_SECRET and ENCRYPTION_KEY.');
    const state = base64url(crypto.randomBytes(24));
    const verifier = pkceVerifier();
    const challenge = pkceChallenge(verifier);
    const db = await readDb();
    db.oauthStates = db.oauthStates.filter(s=>Date.now()-new Date(s.createdAt).getTime()<10*60*1000);
    db.oauthStates.push({ state, verifier, createdAt:new Date().toISOString() });
    await writeDb(db);
    const params = new URLSearchParams({ response_type:'code', client_id:CLIENT_ID, redirect_uri:REDIRECT_URI, scope:SCOPES.join(' '), state, code_challenge:challenge, code_challenge_method:'S256' });
    res.redirect(`https://x.com/i/oauth2/authorize?${params}`);
  } catch(e){ next(e); }
});

app.get('/api/auth/x/callback', async (req,res,next)=>{
  try {
    if (req.query.error) return res.redirect(`/?auth_error=${encodeURIComponent(req.query.error_description || req.query.error)}`);
    const { code, state } = req.query;
    const db = await readDb();
    const oauth = db.oauthStates.find(s=>s.state===state);
    if (!code || !oauth) return res.status(400).send('Invalid or expired OAuth state.');
    db.oauthStates = db.oauthStates.filter(s=>s.state!==state);
    const body = new URLSearchParams({ code, grant_type:'authorization_code', client_id:CLIENT_ID, redirect_uri:REDIRECT_URI, code_verifier:oauth.verifier });
    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return res.status(400).json(tokens);
    const me = await apiMe(tokens.access_token);
    const p = me.data;
    let user = db.users.find(u=>u.xUserId===p.id);
    if (!user) { user={id:nanoid(),xUserId:p.id}; db.users.push(user); }
    Object.assign(user,{username:p.username,displayName:p.name,profileImageUrl:p.profile_image_url||'',accessTokenEncrypted:encrypt(tokens.access_token),refreshTokenEncrypted:encrypt(tokens.refresh_token),tokenExpiresAt:new Date(Date.now()+(tokens.expires_in||7200)*1000).toISOString(),scopes:tokens.scope||SCOPES.join(' '),updatedAt:new Date().toISOString()});
    const sid=nanoid(32); db.sessions.push({id:sid,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*24*60*60*1000).toISOString()});
    await writeDb(db); setSession(res,sid); res.redirect('/');
  } catch(e){ next(e); }
});

app.post('/api/auth/logout', async (req,res)=>{ const sid=getSessionId(req); const db=await readDb(); db.sessions=db.sessions.filter(s=>s.id!==sid); await writeDb(db); res.clearCookie('x_session'); res.json({ok:true}); });
app.get('/api/auth/me', requireAuth, async (req,res)=>{ const token=await getToken(req.auth.user); const me=await apiMe(token); res.json({account:accountView(me.data)}); });

app.get('/api/dashboard', requireAuth, async (req,res,next)=>{
  try {
    const token=await getToken(req.auth.user); const me=await apiMe(token); const user=accountView(me.data);
    res.json({account:user, metrics:{followers:user.followers_count,following:user.following_count,posts:user.tweet_count,likes:null}, note:'X user public_metrics does not expose a total likes count; likes are not fabricated.'});
  } catch(e){ next(e); }
});

async function saveSnapshot(userId, followers, following) {
  const db=await readDb();
  const now=new Date().toISOString();
  const prev=db.snapshots.filter(s=>s.userId===userId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
  const followerIds=new Set(followers.map(x=>x.id));
  const followingIds=new Set(following.map(x=>x.id));
  const unfollowed=prev ? (prev.followerIds||[]).filter(id=>!followerIds.has(id)) : [];
  const newFollowers=prev ? [...followerIds].filter(id=>!(prev.followerIds||[]).includes(id)) : [];
  db.snapshots.push({id:nanoid(),userId,createdAt:now,followerIds:[...followerIds],followingIds:[...followingIds]});
  await writeDb(db);
  return {unfollowed,newFollowers,previousExists:!!prev};
}

app.get('/api/following', requireAuth, async (req,res,next)=>{ try { const token=await getToken(req.auth.user); const users=await apiAllFollowing(token,req.auth.user.xUserId); res.json({data:users.map(accountView),total:users.length}); } catch(e){next(e);} });
app.get('/api/followers', requireAuth, async (req,res,next)=>{ try { const token=await getToken(req.auth.user); const users=await apiAllFollowers(token,req.auth.user.xUserId); res.json({data:users.map(accountView),total:users.length}); } catch(e){next(e);} });
app.get('/api/analysis/not-following-back', requireAuth, async (req,res,next)=>{
  try { const token=await getToken(req.auth.user); const [following,followers]=await Promise.all([apiAllFollowing(token,req.auth.user.xUserId),apiAllFollowers(token,req.auth.user.xUserId)]); const fids=new Set(followers.map(x=>x.id)); const data=following.filter(x=>!fids.has(x.id)).map(accountView); const snap=await saveSnapshot(req.auth.user.id,followers,following); res.json({data,total:data.length,followingCount:following.length,followerCount:followers.length,mutuals:following.length-data.length,tracking:{previousSnapshot:snap.previousExists,newFollowers:snap.newFollowers.length,unfollowers:snap.unfollowed.length}}); } catch(e){next(e);} });
app.post('/api/unfollow/:targetId', requireAuth, async (req,res,next)=>{
  try { const token=await getToken(req.auth.user); const source=req.auth.user.xUserId; const target=req.params.targetId; const r=await xFetch(`https://api.x.com/2/users/${source}/following/${target}`,token,{method:'DELETE'}); res.json({ok:true,data:r.data||{following:false}}); } catch(e){next(e);} });
app.post('/api/unfollow-bulk', requireAuth, async (req,res,next)=>{
  try { const ids=Array.isArray(req.body.ids)?req.body.ids:[]; if(ids.length>50) return res.status(400).json({error:'Maximum 50 accounts per bulk operation.'}); const token=await getToken(req.auth.user); const source=req.auth.user.xUserId; const results=[]; for(const target of ids){ try { const r=await xFetch(`https://api.x.com/2/users/${source}/following/${target}`,token,{method:'DELETE'}); results.push({id:target,ok:true,data:r.data}); } catch(e){ results.push({id:target,ok:false,error:e.message,status:e.status}); } } res.json({results}); } catch(e){next(e);} });

app.get('/api/profile/:id', requireAuth, async (req,res,next)=>{ try { const token=await getToken(req.auth.user); const data=await xFetch(`https://api.x.com/2/users/${req.params.id}?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics`,token); res.json({account:accountView(data.data)}); } catch(e){next(e);} });

app.use(express.static(path.join(ROOT,'public')));
app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
app.use((err,req,res,next)=>{ console.error(err); res.status(err.status||500).json({error:err.message||'Server error',details:process.env.NODE_ENV==='production'?undefined:err.body}); });

app.listen(PORT,()=>console.log(`X Control Center running at http://localhost:${PORT}`));
