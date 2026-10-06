import { verifySessionCookie, getValidAccessToken, callXApi } from '../utils/x-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
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

    const targetUserId = req.body?.target_user_id || req.query.target_user_id || req.body?.id || req.query.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'target_user_id is required' });
    }

    const sourceUserId = session.user.id;
    const endpoint = `https://api.x.com/2/users/${sourceUserId}/following`;

    const { data, rateLimit } = await callXApi(endpoint, token, {
      method: 'POST',
      body: JSON.stringify({ target_user_id: targetUserId })
    });

    res.json({
      success: true,
      data: data.data || { following: true },
      targetUserId,
      rateLimit
    });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to follow user on X',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null
    });
  }
}
