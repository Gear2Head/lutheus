const { getAuth, getDb } = require('../../_lib/firebaseAdmin');
const { readState } = require('../../_lib/oauthState');
const { normalizeRole } = require('../../_lib/roles');

// SECTION: API_ROUTES
// PURPOSE: Discord OAuth callback endpoint with detailed diagnostic logs and error reporting.

function redirectWithError(res, redirectUri, error, errorStage = '', detail = '') {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    if (errorStage) {
        url.searchParams.set('error_stage', errorStage);
    }
    if (detail) {
        url.searchParams.set('detail', detail);
    }
    res.writeHead(302, { Location: url.toString() });
    res.end();
}

function encodeProfile(profile) {
    return Buffer.from(encodeURIComponent(JSON.stringify(profile))).toString('base64');
}

async function exchangeCode(code, redirectUri, host) {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        throw new Error('DISCORD_CLIENT_SECRET_MISSING');
    }

    const exchangeRedirectUri = redirectUri || `https://${host}/api/auth/discord/callback`;

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: exchangeRedirectUri
        })
    });
    const payload = await response.json();
    if (!response.ok) {
        const errType = payload.error || '';
        const errDesc = payload.error_description || '';
        console.error(`Discord Code Exchange Error: error=${errType}, description=${errDesc}`);
        if (errDesc.includes('redirect_uri_mismatch') || errType.includes('redirect_uri_mismatch')) {
            throw new Error('DISCORD_REDIRECT_URI_MISMATCH');
        }
        throw new Error('DISCORD_CODE_EXCHANGE_FAILED');
    }
    return payload.access_token;
}

async function fetchDiscordUser(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (!response.ok) {
        console.error('Discord User Fetch Error:', payload);
        throw new Error('DISCORD_USER_FETCH_FAILED');
    }
    return payload;
}

async function resolveRole(db, discordId) {
    const bootstrapIds = String(process.env.BOOTSTRAP_DISCORD_IDS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (bootstrapIds.includes(String(discordId))) return 'admin';

    const docId = `discord:${discordId}`.toLowerCase().replace(/\//g, '_');
    const doc = await db.collection('roleCache').doc(docId).get();
    if (!doc.exists) return 'pending';
    return normalizeRole(doc.data().role || 'pending');
}

module.exports = async function handler(req, res) {
    let redirectUri = '';
    let oauthRedirectUri = '';
    const wantsJson = req.query.json === 'true' || !req.query.state;
    try {
        const fallbackCallbackUrl = `https://${req.headers.host}/api/auth/discord/callback`;
        if (!wantsJson) {
            const state = readState(req.query.state);
            redirectUri = state.redirectUri;
            oauthRedirectUri = state.oauthRedirectUri || fallbackCallbackUrl;
        } else {
            redirectUri = req.query.redirect_uri || '';
            oauthRedirectUri = redirectUri || fallbackCallbackUrl;
        }

        if (req.query.error) {
            if (wantsJson) {
                res.status(400).json({ error: String(req.query.error) });
                return;
            }
            redirectWithError(res, redirectUri, String(req.query.error));
            return;
        }

        const code = String(req.query.code || '');
        if (!code) throw new Error('DISCORD_CODE_MISSING');
        const accessToken = await exchangeCode(code, oauthRedirectUri, req.headers.host);
        const discordUser = await fetchDiscordUser(accessToken);

        let db, auth;
        try {
            db = getDb();
            auth = getAuth();
        } catch (adminError) {
            console.error('Firebase Admin SDK Initialization Error:', adminError);
            throw new Error('FIREBASE_ADMIN_INIT_FAILED');
        }

        const role = await resolveRole(db, discordUser.id);
        const uid = `discord:${discordUser.id}`;
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 5}.png`;

        const profile = {
            uid,
            provider: 'discord',
            discordId: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.global_name || discordUser.username,
            displayName: discordUser.global_name || discordUser.username,
            avatar: avatarUrl,
            role,
            status: 'active'
        };

        const userDocId = uid.toLowerCase().replace(/\//g, '_');
        try {
            await db.collection('users').doc(userDocId).set({
                ...profile,
                lastLogin: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (dbError) {
            console.error('Firebase DB User Write Failed:', dbError);
            throw new Error('FIREBASE_USER_WRITE_FAILED');
        }

        let firebaseToken;
        try {
            firebaseToken = await auth.createCustomToken(uid, {
                provider: 'discord',
                discordId: discordUser.id,
                role
            });
        } catch (tokenError) {
            console.error('Firebase Custom Token Generation Failed:', tokenError);
            throw new Error('FIREBASE_CUSTOM_TOKEN_FAILED');
        }

        if (wantsJson) {
            res.status(200).json({ firebaseToken, profile });
        } else {
            const url = new URL(redirectUri);
            url.searchParams.set('firebaseToken', firebaseToken);
            url.searchParams.set('profile', encodeProfile(profile));
            res.writeHead(302, { Location: url.toString() });
            res.end();
        }
    } catch (error) {
        console.error('Discord Callback Handler Error:', error);
        
        let errCode = 'DISCORD_AUTH_FAILED';
        let errorStage = 'callback_handler';
        let detail = error.message || '';
        
        const msg = String(error.message || '');
        
        if (msg.includes('INVALID_OAUTH_STATE')) {
            errCode = 'INVALID_OAUTH_STATE';
            errorStage = 'state_validation';
        } else if (msg.includes('OAUTH_STATE_EXPIRED')) {
            errCode = 'OAUTH_STATE_EXPIRED';
            errorStage = 'state_validation';
        } else if (msg.includes('DISCORD_CLIENT_SECRET_MISSING')) {
            errCode = 'DISCORD_CLIENT_SECRET_MISSING';
            errorStage = 'pre_exchange';
        } else if (msg.includes('DISCORD_REDIRECT_URI_MISMATCH')) {
            errCode = 'DISCORD_REDIRECT_URI_MISMATCH';
            errorStage = 'code_exchange';
        } else if (msg.includes('DISCORD_CODE_EXCHANGE_FAILED')) {
            errCode = 'DISCORD_CODE_EXCHANGE_FAILED';
            errorStage = 'code_exchange';
        } else if (msg.includes('DISCORD_USER_FETCH_FAILED')) {
            errCode = 'DISCORD_USER_FETCH_FAILED';
            errorStage = 'user_fetch';
        } else if (msg.includes('FIREBASE_ADMIN_INIT_FAILED')) {
            errCode = 'FIREBASE_ADMIN_INIT_FAILED';
            errorStage = 'firebase_init';
        } else if (msg.includes('FIREBASE_USER_WRITE_FAILED')) {
            errCode = 'FIREBASE_USER_WRITE_FAILED';
            errorStage = 'firebase_db';
        } else if (msg.includes('FIREBASE_CUSTOM_TOKEN_FAILED')) {
            errCode = 'FIREBASE_CUSTOM_TOKEN_FAILED';
            errorStage = 'firebase_auth';
        } else if (msg.includes('DISCORD_CODE_MISSING')) {
            errCode = 'DISCORD_CODE_MISSING';
            errorStage = 'params_validation';
        }
        
        if (wantsJson) {
            res.status(400).json({ error: errCode, error_stage: errorStage, detail });
        } else if (redirectUri) {
            redirectWithError(res, redirectUri, errCode, errorStage, detail);
        } else {
            res.status(400).json({ error: errCode, error_stage: errorStage, detail });
        }
    }
};
