const { createState } = require('../../_lib/oauthState');

// SECTION: API_ROUTES
// PURPOSE: Discord OAuth start endpoint with redirect URI verification and robust base URL resolution.

module.exports = async function handler(req, res) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        res.status(500).json({ error: 'DISCORD_CLIENT_ID_MISSING' });
        return;
    }

    const redirectUri = String(req.query.redirect_uri || '');
    const isAllowedRedirect = /^https:\/\/[a-z0-9]{32}\.chromiumapp\.org\/?$/i.test(redirectUri);
    if (!isAllowedRedirect) {
        res.status(400).json({ error: 'INVALID_REDIRECT_URI' });
        return;
    }

    const authBaseUrl = process.env.VERCEL_AUTH_BASE_URL || `https://${req.headers.host}`;
    const callbackUrl = new URL('/api/auth/discord/callback', authBaseUrl);
    const state = createState({
        redirectUri,
        source: 'extension'
    });

    const url = new URL('https://discord.com/oauth2/authorize');
    const allowedScopes = new Set(['identify', 'email', 'guilds', 'openid', 'messages.read']);
    const scope = String(req.query.scope || 'identify')
        .split(/\s+/)
        .filter((item) => allowedScopes.has(item))
        .join(' ') || 'identify';
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl.toString());
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');

    res.writeHead(302, { Location: url.toString() });
    res.end();
};
