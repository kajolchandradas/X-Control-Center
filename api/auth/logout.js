import { verifySessionCookie, deleteSession } from '../utils/x-client.js';

export default async function handler(req, res) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/x_session=([^;]+)/);
    const sessionCookie = match ? match[1] : null;

    if (sessionCookie) {
      const verification = verifySessionCookie(sessionCookie);
      if (verification) {
        deleteSession(verification.id);
      }
    }

    const isProd = process.env.NODE_ENV === 'production';
    const clearCookieHeader = [
      'x_session=',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      isProd ? 'Secure' : '',
      'Max-Age=0'
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', clearCookieHeader);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to complete logout' });
  }
}
