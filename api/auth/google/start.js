const { createState } = require('../../_lib/oauthState');

function getBaseUrl(req) {
    const raw =
        process.env.VERCEL_AUTH_BASE_URL ||
        process.env.NEXT_PUBLIC_VERCEL_AUTH_BASE_URL ||
        `https://${req.headers.host}`;

    const url = new URL(raw);
    return url.origin;
}

function sanitizeReturnTo(value, origin) {
    if (!value) return '/';
    try {
        const parsed = new URL(String(value), origin);
        return parsed.origin === origin
            ? parsed.pathname + parsed.search + parsed.hash
            : '/';
    } catch (_error) {
        return '/';
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        res.status(500).json({
            ok: false,
            error: 'GOOGLE_CLIENT_ID_MISSING',
            message: 'Vercel Production env içinde GOOGLE_CLIENT_ID tanımlı değil.'
        });
        return;
    }

    const baseOrigin = getBaseUrl(req);
    const callbackUrl = new URL('/api/auth/google/callback', baseOrigin);
    const returnTo = sanitizeReturnTo(req.query.returnTo, baseOrigin);

    const loginUrl = new URL('/src/auth/login.html', baseOrigin);
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
