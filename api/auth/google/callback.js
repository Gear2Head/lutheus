const { supabase } = require('../../_lib/supabaseClient');
const { readState } = require('../../_lib/oauthState');
const { isOwnerIdentity, normalizeRole, getPermissionForRole } = require('../../_lib/roles');
const jwt = require('jsonwebtoken');

// SECTION: API_ROUTES
// PURPOSE: Google web OAuth callback endpoint with server-side token exchange using Supabase.

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
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID_MISSING');
    }

    if (!process.env.GOOGLE_CLIENT_SECRET) {
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
        if (payload.error === 'redirect_uri_mismatch') {
            throw new Error('GOOGLE_REDIRECT_URI_MISMATCH');
        }
        throw new Error(`GOOGLE_CODE_EXCHANGE_FAILED:${payload.error || response.status}`);
    }

    if (!payload.access_token) {
        throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');
    }

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

async function resolveRole(email) {
    if (isOwnerIdentity({ email })) return 'kurucu';
    const { data: allowRow } = await supabase
        .from('google_allowlist')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('active', true)
        .maybeSingle();

    if (!allowRow || allowRow.active !== true) {
        throw new Error('GOOGLE_EMAIL_NOT_ALLOWLISTED');
    }
    return normalizeRole(allowRow.dashboard_access_role || 'viewer');
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

        const email = String(googleUser.email || '').toLowerCase();
        const role = await resolveRole(email);
        const profile = {
            uid,
            provider: 'google',
            email,
            displayName: googleUser.name || email || 'Google User',
            avatar: googleUser.picture || null,
            role,
            status: 'active'
        };

        const userProfile = {
            discord_id: null,
            email,
            display_name: googleUser.name || email || 'Google User',
            username: null,
            avatar_url: googleUser.picture || null,
            staff_rank: role,
            permission_group: getPermissionForRole(role).group,
            permission_level: getPermissionForRole(role).level,
            is_active_staff: true,
            last_seen_at: new Date().toISOString(),
            raw_payload: profile,
            updated_at: new Date().toISOString()
        };

        const { data: existingProfile } = await supabase
            .from('staff_profiles')
            .select('*')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (existingProfile) {
            userProfile.discord_id = existingProfile.discord_id;
        }

        try {
            await supabase.from('staff_profiles').upsert([userProfile], { onConflict: 'email' });
        } catch (dbError) {
            console.error('Supabase DB User Write Failed:', dbError);
            throw new Error('SUPABASE_USER_WRITE_FAILED');
        }

        let supabaseToken;
        try {
            const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-key-with-at-least-32-characters-long';
            const tokenPayload = {
                aud: 'authenticated',
                role: 'authenticated',
                sub: uid,
                email: email,
                phone: '',
                app_metadata: {
                    provider: 'google',
                    providers: ['google']
                },
                user_metadata: {
                    avatar_url: googleUser.picture || null,
                    full_name: googleUser.name || email || 'Google User',
                    email: email
                },
                aal: 'aal1',
                amr: [
                    {
                        method: 'oauth',
                        timestamp: Math.floor(Date.now() / 1000)
                    }
                ]
            };
            supabaseToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });
        } catch (tokenError) {
            console.error('Supabase Custom Token Generation Failed:', tokenError);
            throw new Error('SUPABASE_CUSTOM_TOKEN_FAILED');
        }

        const url = new URL(redirectUri);
        url.searchParams.set('supabaseToken', supabaseToken);
        url.searchParams.set('profile', encodeProfile(profile));
        res.writeHead(302, { Location: url.toString() });
        res.end();
    } catch (error) {
        const fallback = redirectUri || `https://${req.headers.host}/src/auth/login.html`;
        redirectWithError(res, fallback, error.message || 'GOOGLE_AUTH_FAILED');
    }
};
