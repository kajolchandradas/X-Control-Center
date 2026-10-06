import { verifySessionCookie, getValidAccessToken, callXApi, formatUser } from '../utils/x-client.js';

export default async function handler(req, res) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/x_session=([^;]+)/);
    const sessionCookie = match ? match[1] : null;

    if (!sessionCookie) {
      return res.status(401).json({ error: 'Not authenticated with X' });
    }

    const verification = verifySessionCookie(sessionCookie);
    if (!verification) {
      return res.status(401).json({ error: 'Session expired. Please reconnect your X account.' });
    }

    const { session } = verification;
    const token = await getValidAccessToken(session);

    const targetUserId = req.query.id || session.user.id;
    const endpoint = targetUserId === session.user.id
      ? 'https://api.x.com/2/users/me?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url'
      : `https://api.x.com/2/users/${targetUserId}?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url`;

    const { data, rateLimit } = await callXApi(endpoint, token);
    const user = formatUser(data.data);

    res.json({
      user,
      rateLimit,
      dataSource: 'LIVE X API'
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to fetch X profile',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null,
      raw: process.env.NODE_ENV === 'development' ? err.raw : undefined
    });
  }
}
