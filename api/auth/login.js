import { CLIENT_ID, REDIRECT_URI, SCOPES, generatePKCE, saveOAuthState } from '../utils/x-client.js';

export default async function handler(req, res) {
  try {
    if (!CLIENT_ID) {
      return res.status(500).json({
        error: 'X_CLIENT_ID is not configured in server environment variables.',
        instructions: 'Add X_CLIENT_ID, X_CLIENT_SECRET, and ENCRYPTION_KEY to your environment.'
      });
    }

    const { verifier, challenge, state } = generatePKCE();
    saveOAuthState(state, verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;

    // If client requested JSON redirect URL (e.g. from single-page app)
    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.json({ url: authUrl });
    }

    res.redirect(authUrl);
  } catch (err) {
    console.error('Error starting X OAuth:', err);
    res.status(500).json({ error: 'Failed to initiate X authorization flow' });
  }
}
