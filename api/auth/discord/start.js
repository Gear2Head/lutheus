const { createState } = require('../../_lib/oauthState');

module.exports = async function handler(req, res) {
    const clientId = process.env.DISCORD_CLIENT_ID || '1500551629768888542';
    if (!clientId) {
        res.status(500).json({ error: 'DISCORD_CLIENT_ID_MISSING' });
        return;
    }

    const redirectUri = String(req.query.redirect_uri || '');
    if (!redirectUri.startsWith('https://') && !redirectUri.startsWith('http://localhost')) {
        res.status(400).json({ error: 'INVALID_REDIRECT_URI' });
        return;
    }

    const callbackUrl = new URL('/api/auth/discord/callback', `https://${req.headers.host}`);
    const state = createState({ redirectUri });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl.toString());
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');

    res.writeHead(302, { Location: url.toString() });
    res.end();
};
