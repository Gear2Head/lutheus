const { createState } = require('../../_lib/oauthState');

// SECTION: API_ROUTES
// PURPOSE: Google web OAuth start endpoint with backend callback redirect.

function sanitizeReturnTo(value, origin) {
    if (!value) return '/';
    try {
        const parsed = new URL(String(value), origin);
        return parsed.origin === origin ? parsed.pathname + parsed.search + parsed.hash : '/';
    } catch (_error) {
        return '/';
    }
}

module.exports = async function handler(req, res) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        res.status(500).json({ error: 'GOOGLE_CLIENT_ID_MISSING' });
        return;
    }

    const authBaseUrl = process.env.VERCEL_AUTH_BASE_URL || `https://${req.headers.host}`;
    const baseOrigin = new URL(authBaseUrl).origin;
    const callbackUrl = new URL('/api/auth/google/callback', authBaseUrl);
    const returnTo = sanitizeReturnTo(req.query.returnTo, baseOrigin);
    const loginUrl = new URL('/src/auth/login.html', authBaseUrl);
    loginUrl.searchParams.set('returnTo', returnTo);

    const state = createState({
        redirectUri: loginUrl.toString(),
        oauthRedirectUri: callbackUrl.toString(),
        source: 'web'
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl.toString());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    res.writeHead(302, { Location: url.toString() });
    res.end();
};
