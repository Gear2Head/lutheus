const { getAuth, getDb } = require('../../_lib/firebaseAdmin');
const { readState } = require('../../_lib/oauthState');
const { normalizeRole } = require('../../_lib/roles');

// SECTION: API_ROUTES
// PURPOSE: Google web OAuth callback endpoint with server-side token exchange.

function encodeProfile(profile) {
    return Buffer.from(encodeURIComponent(JSON.stringify(profile))).toString('base64');
}

function redirectWithError(res, redirectUri, error) {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    res.writeHead(302, { Location: url.toString() });
    res.end();
}

async function exchangeCode(code, redirectUri) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('GOOGLE_CLIENT_SECRET_MISSING');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error === 'redirect_uri_mismatch'
            ? 'GOOGLE_REDIRECT_URI_MISMATCH'
            : 'GOOGLE_CODE_EXCHANGE_FAILED');
    }
    if (!payload.access_token) throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');
    return payload.access_token;
}

async function fetchGoogleUser(accessToken) {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('GOOGLE_USER_FETCH_FAILED');
    return payload;
}

async function resolveRole(db, email) {
    const docId = String(email || '').toLowerCase().replace(/\//g, '_');
    if (!docId) throw new Error('GOOGLE_EMAIL_MISSING');
    const doc = await db.collection('googleAllowlist').doc(docId).get();
    if (!doc.exists || doc.data().allowed !== true) {
        throw new Error('GOOGLE_EMAIL_NOT_ALLOWLISTED');
    }
    return normalizeRole(doc.data().role || 'viewer');
}

module.exports = async function handler(req, res) {
    let redirectUri = '';
    try {
        const state = readState(req.query.state);
        redirectUri = state.redirectUri;
        const oauthRedirectUri = state.oauthRedirectUri || `https://${req.headers.host}/api/auth/google/callback`;

        if (req.query.error) {
            redirectWithError(res, redirectUri, String(req.query.error));
            return;
        }

        const code = String(req.query.code || '');
        if (!code) throw new Error('GOOGLE_CODE_MISSING');

        const accessToken = await exchangeCode(code, oauthRedirectUri);
        const googleUser = await fetchGoogleUser(accessToken);
        const uid = googleUser.sub ? `google:${googleUser.sub}` : '';
        if (!uid) throw new Error('USER_UID_REQUIRED');

        const db = getDb();
        const auth = getAuth();
        const email = String(googleUser.email || '').toLowerCase();
        const role = await resolveRole(db, email);
        const profile = {
            uid,
            provider: 'google',
            email,
            displayName: googleUser.name || email || 'Google User',
            avatar: googleUser.picture || null,
            role,
            status: 'active'
        };

        const userDocId = uid.toLowerCase().replace(/\//g, '_');
        await db.collection('users').doc(userDocId).set({
            ...profile,
            lastLogin: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const firebaseToken = await auth.createCustomToken(uid, {
            provider: 'google',
            email,
            role
        });

        const url = new URL(redirectUri);
        url.searchParams.set('firebaseToken', firebaseToken);
        url.searchParams.set('profile', encodeProfile(profile));
        res.writeHead(302, { Location: url.toString() });
        res.end();
    } catch (error) {
        const fallback = redirectUri || `https://${req.headers.host}/src/auth/login.html`;
        redirectWithError(res, fallback, error.message || 'GOOGLE_AUTH_FAILED');
    }
};
