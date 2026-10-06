import { verifySessionCookie, getValidAccessToken, callXApi } from '../utils/x-client.js';

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
    const maxResults = Math.min(Number(req.query.max_results) || 10, 50);

    const url = new URL(`https://api.x.com/2/users/${targetUserId}/tweets`);
    url.searchParams.set('max_results', String(maxResults));
    url.searchParams.set('tweet.fields', 'created_at,public_metrics,text,attachments,entities');

    const { data, rateLimit } = await callXApi(url.toString(), token);

    res.json({
      posts: data.data || [],
      resultCount: data.meta?.result_count || 0,
      nextToken: data.meta?.next_token || null,
      rateLimit,
      dataSource: 'LIVE X API'
    });
  } catch (err) {
    console.error('Posts fetch error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to fetch posts from X',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null
    });
  }
}
