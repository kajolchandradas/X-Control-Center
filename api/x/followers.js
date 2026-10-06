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

    const maxResults = Math.min(Number(req.query.max_results) || 100, 1000);
    const paginationToken = req.query.pagination_token || '';

    const url = new URL(`https://api.x.com/2/users/${session.user.id}/followers`);
    url.searchParams.set('max_results', String(maxResults));
    url.searchParams.set('user.fields', 'id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url');
    if (paginationToken) {
      url.searchParams.set('pagination_token', paginationToken);
    }

    const { data, rateLimit } = await callXApi(url.toString(), token);
    const users = (data.data || []).map(formatUser);

    res.json({
      users,
      resultCount: data.meta?.result_count || users.length,
      nextToken: data.meta?.next_token || null,
      previousToken: data.meta?.previous_token || null,
      rateLimit,
      dataSource: 'LIVE X API'
    });
  } catch (err) {
    console.error('Followers fetch error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to fetch followers from X',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null
    });
  }
}
