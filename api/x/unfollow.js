import { verifySessionCookie, getValidAccessToken, callXApi } from '../utils/x-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed. Use POST or DELETE.' });
  }

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

    // Support target id from body or query or path
    const targetUserId = req.body?.target_user_id || req.query.target_user_id || req.body?.id || req.query.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'target_user_id is required' });
    }

    const sourceUserId = session.user.id;
    const endpoint = `https://api.x.com/2/users/${sourceUserId}/following/${targetUserId}`;

    const { data, rateLimit } = await callXApi(endpoint, token, {
      method: 'DELETE'
    });

    res.json({
      success: true,
      data: data.data || { following: false },
      targetUserId,
      rateLimit
    });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to unfollow user on X',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null
    });
  }
}
