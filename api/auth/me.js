import { verifySessionCookie, getValidAccessToken, callXApi, formatUser } from '../utils/x-client.js';

export default async function handler(req, res) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/x_session=([^;]+)/);
    const sessionCookie = match ? match[1] : null;

    if (!sessionCookie) {
      return res.status(401).json({ authenticated: false, error: 'Not authenticated' });
    }

    const verification = verifySessionCookie(sessionCookie);
    if (!verification) {
      return res.status(401).json({ authenticated: false, error: 'Session expired or invalid' });
    }

    const { session } = verification;

    // Check if client requested a fresh profile check or use cached session profile
    if (req.query.refresh === 'true') {
      try {
        const token = await getValidAccessToken(session);
        const meRes = await callXApi(
          'https://api.x.com/2/users/me?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url',
          token
        );
        session.user = formatUser(meRes.data.data);
      } catch (err) {
        // Return existing session user if refresh fails, but attach warning
        return res.json({
          authenticated: true,
          user: session.user,
          apiWarning: err.message,
          errorType: err.errorType
        });
      }
    }

    res.json({
      authenticated: true,
      user: session.user
    });
  } catch (err) {
    console.error('auth/me error:', err);
    res.status(500).json({ authenticated: false, error: 'Server error checking authentication' });
  }
}
