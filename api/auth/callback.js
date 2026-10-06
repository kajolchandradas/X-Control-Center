import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, consumeOAuthState, createSession, callXApi, formatUser } from '../utils/x-client.js';

export default async function handler(req, res) {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.warn('X OAuth returned error:', error, error_description);
      return res.redirect(`/?auth_error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
      return res.redirect('/?auth_error=Missing_OAuth_code_or_state');
    }

    const verifier = consumeOAuthState(state);
    if (!verifier) {
      return res.redirect('/?auth_error=Invalid_or_expired_OAuth_state');
    }

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    });

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (CLIENT_SECRET) {
      headers['Authorization'] = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
    }

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('X token exchange failed:', tokens);
      const msg = tokens?.error_description || tokens?.error || 'Token_exchange_failed';
      return res.redirect(`/?auth_error=${encodeURIComponent(msg)}`);
    }

    // Fetch authenticated user profile
    const meRes = await callXApi(
      'https://api.x.com/2/users/me?user.fields=id,name,username,description,profile_image_url,created_at,verified,protected,public_metrics,location,url',
      tokens.access_token
    );

    const user = formatUser(meRes.data.data);
    const { cookieValue } = createSession(user, tokens);

    // Set secure HTTP-only cookie
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = [
      `x_session=${cookieValue}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      isProd ? 'Secure' : '',
      `Max-Age=${30 * 24 * 60 * 60}`
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookieHeader);
    res.redirect('/?connected=true');
  } catch (err) {
    console.error('OAuth callback exception:', err);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message || 'Authentication_failed')}`);
  }
}
