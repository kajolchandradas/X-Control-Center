import { verifySessionCookie, getValidAccessToken, callXApi, formatUser } from '../utils/x-client.js';

// Helper to fetch all pages up to a reasonable cap (e.g. 1000 per list to stay within standard limits)
async function fetchAllUsers(baseUrl, token, maxTotal = 1000) {
  const users = [];
  let paginationToken = null;

  do {
    const url = new URL(baseUrl);
    url.searchParams.set('max_results', '1000');
    url.searchParams.set('user.fields', 'id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url');
    if (paginationToken) url.searchParams.set('pagination_token', paginationToken);

    const { data } = await callXApi(url.toString(), token);
    const chunk = (data.data || []).map(formatUser);
    users.push(...chunk);
    paginationToken = data.meta?.next_token;

    if (users.length >= maxTotal) break;
  } while (paginationToken);

  return users;
}

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

    // Fetch both following and followers from real X API
    const [followingList, followersList] = await Promise.all([
      fetchAllUsers(`https://api.x.com/2/users/${session.user.id}/following`, token, 2000),
      fetchAllUsers(`https://api.x.com/2/users/${session.user.id}/followers`, token, 2000)
    ]);

    const followerIds = new Set(followersList.map(u => u.id));
    const followingIds = new Set(followingList.map(u => u.id));

    // Not following back = users I follow who do NOT follow me back
    const notFollowingBack = followingList.filter(u => !followerIds.has(u.id));

    // Mutuals = users I follow who ALSO follow me back
    const mutuals = followingList.filter(u => followerIds.has(u.id));

    // Fans (followers only) = users who follow me but I do NOT follow back
    const fans = followersList.filter(u => !followingIds.has(u.id));

    res.json({
      dataSource: 'LIVE X API',
      account: session.user,
      counts: {
        following: followingList.length,
        followers: followersList.length,
        notFollowingBack: notFollowingBack.length,
        mutuals: mutuals.length,
        fans: fans.length
      },
      notFollowingBack,
      mutuals,
      fans,
      following: followingList,
      followers: followersList,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to complete X following analysis',
      errorType: err.errorType || 'API_ERROR',
      rateLimit: err.rateLimit || null,
      raw: process.env.NODE_ENV === 'development' ? err.raw : undefined
    });
  }
}
