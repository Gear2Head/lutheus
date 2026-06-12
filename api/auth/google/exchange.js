const { supabase } = require('../../_lib/supabaseClient');
const { isOwnerIdentity, normalizeRole, getPermissionForRole } = require('../../_lib/roles');
const jwt = require('jsonwebtoken');

// SECTION: API_ROUTES
// PURPOSE: Dedicated Google Access Token exchange endpoint for Chrome Extensions using Supabase.

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
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = req.body || {};
        const accessToken = String(body.accessToken || '');

        if (!accessToken) throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');

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

        let existingProfile = null;
        try {
            const { data } = await supabase
                .from('staff_profiles')
                .select('*')
                .eq('email', email.toLowerCase())
                .maybeSingle();
            existingProfile = data;
        } catch (_) {
            // ignore profile query errors
        }

        if (existingProfile) {
            userProfile.discord_id = existingProfile.discord_id || null;
            const { error: updateError } = await supabase
                .from('staff_profiles')
                .update(userProfile)
                .eq('id', existingProfile.id);
            if (updateError) {
                console.error('Supabase DB User Update Failed:', updateError);
                throw new Error('SUPABASE_USER_WRITE_FAILED');
            }
        } else {
            const { error: insertError } = await supabase
                .from('staff_profiles')
                .insert([userProfile]);
            if (insertError) {
                console.error('Supabase DB User Insert Failed:', insertError);
                throw new Error('SUPABASE_USER_WRITE_FAILED');
            }
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

        res.status(200).json({
            ok: true,
            uid,
            supabaseToken,
            profile
        });
    } catch (error) {
        console.error('Google Exchange Endpoint Error:', error);
        res.status(400).json({
            error: error.message || 'GOOGLE_AUTH_FAILED'
        });
    }
};
