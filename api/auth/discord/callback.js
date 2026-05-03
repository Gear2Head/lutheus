const { getAuth, getDb } = require('../../_lib/firebaseAdmin');
const { readState } = require('../../_lib/oauthState');
const { normalizeRole } = require('../../_lib/roles');

function redirectWithError(res, redirectUri, error) {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    res.writeHead(302, { Location: url.toString() });
    res.end();
}

function encodeProfile(profile) {
    return Buffer.from(encodeURIComponent(JSON.stringify(profile))).toString('base64');
}

async function exchangeCode(code, redirectUri, host) {
    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: `https://${host}/api/auth/discord/callback`
        })
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error_description || payload.error || 'DISCORD_CODE_EXCHANGE_FAILED');
    }
    return payload.access_token;
}

async function fetchDiscordUser(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.message || 'DISCORD_USER_FETCH_FAILED');
    }
    return payload;
}

async function resolveRole(db, discordId) {
    const bootstrapIds = String(process.env.BOOTSTRAP_DISCORD_IDS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (bootstrapIds.includes(String(discordId))) return 'admin';

    const doc = await db.collection('roleCache').doc(`discord:${discordId}`).get();
    if (!doc.exists) return 'moderator';
    return normalizeRole(doc.data().role || 'moderator');
}

module.exports = async function handler(req, res) {
    let redirectUri = '';
    try {
        const state = readState(req.query.state);
        redirectUri = state.redirectUri;
        if (req.query.error) {
            redirectWithError(res, redirectUri, String(req.query.error));
            return;
        }

        const code = String(req.query.code || '');
        if (!code) throw new Error('DISCORD_CODE_MISSING');
        const accessToken = await exchangeCode(code, redirectUri, req.headers.host);
        const discordUser = await fetchDiscordUser(accessToken);
        const db = getDb();
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

        await db.collection('users').doc(uid).set({
            ...profile,
            lastLogin: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const firebaseToken = await getAuth().createCustomToken(uid, {
            provider: 'discord',
            discordId: discordUser.id,
            role
        });

        const url = new URL(redirectUri);
        url.searchParams.set('firebaseToken', firebaseToken);
        url.searchParams.set('profile', encodeProfile(profile));
        res.writeHead(302, { Location: url.toString() });
        res.end();
    } catch (error) {
        if (redirectUri) {
            redirectWithError(res, redirectUri, error.message || 'DISCORD_AUTH_FAILED');
            return;
        }
        res.status(400).json({ error: error.message || 'DISCORD_AUTH_FAILED' });
    }
};
