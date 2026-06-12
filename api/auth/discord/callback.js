const { supabase } = require('../../_lib/supabaseClient');
const { readState } = require('../../_lib/oauthState');
const { resolveDiscordRole } = require('../../_lib/discordRoleResolver');
const jwt = require('jsonwebtoken');

// SECTION: API_ROUTES
// PURPOSE: Discord OAuth callback endpoint with Supabase backend integration and JWT issuance.
// SECURITY: No secrets are hardcoded. All credentials come from environment variables.
// If DISCORD_CLIENT_SECRET or SUPABASE_JWT_SECRET are missing, requests fail fast with a
// clear error message rather than falling back to a leaked/compromised value.

function redirectWithError(res, redirectUri, error, errorStage = '', detail = '') {
    try {
        const url = new URL(redirectUri);
        url.searchParams.set('error', error);
        if (errorStage) url.searchParams.set('error_stage', errorStage);
        if (detail) url.searchParams.set('detail', String(detail).slice(0, 200));
        res.writeHead(302, { Location: url.toString() });
        res.end();
    } catch (_parseError) {
        // redirectUri is not a valid URL — fall back to JSON error
        res.status(400).json({ ok: false, error, error_stage: errorStage });
    }
}

function encodeProfile(profile) {
    return Buffer.from(encodeURIComponent(JSON.stringify(profile))).toString('base64');
}

async function exchangeCode(code, oauthRedirectUri) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId) {
        throw Object.assign(new Error('DISCORD_CLIENT_ID_MISSING'), { stage: 'pre_exchange' });
    }
    if (!clientSecret) {
        throw Object.assign(new Error('DISCORD_CLIENT_SECRET_MISSING'), { stage: 'pre_exchange' });
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: oauthRedirectUri
        })
    });

    const payload = await response.json();
    if (!response.ok) {
        const errType = payload.error || '';
        const errDesc = payload.error_description || '';
        // Log without exposing secrets
        console.error('[auth.discord.callback] Discord code exchange failed', {
            status: response.status,
            errorType: errType,
            errorDesc: errDesc
        });
        if (errDesc.includes('redirect_uri_mismatch') || errType.includes('redirect_uri_mismatch')) {
            throw Object.assign(new Error('DISCORD_REDIRECT_URI_MISMATCH'), { stage: 'code_exchange' });
        }
        throw Object.assign(new Error('DISCORD_CODE_EXCHANGE_FAILED'), { stage: 'code_exchange' });
    }

    // Return only what we need — never log access/refresh tokens
    return { accessToken: payload.access_token };
}

async function fetchDiscordUser(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    if (!response.ok) {
        console.error('[auth.discord.callback] Discord user fetch failed', { status: response.status });
        throw Object.assign(new Error('DISCORD_USER_FETCH_FAILED'), { stage: 'user_fetch' });
    }
    return payload;
}

async function fetchDiscordUserGuilds(accessToken) {
    try {
        const response = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) return [];
        return response.json();
    } catch {
        return [];
    }
}

async function fetchDiscordGuildMember(accessToken) {
    try {
        const guildId = '1223431616081166336';
        const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.warn('Failed to fetch Discord guild member details:', err);
        return null;
    }
}

module.exports = async function handler(req, res) {
    // Determine the app's canonical public URL for redirect fallbacks
    const appUrl = process.env.PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || `https://${req.headers.host}`;

    let redirectUri = '';
    let oauthRedirectUri = '';

    const wantsJson = req.query.json === 'true' || !req.query.state;

    const fallbackCallbackUrl = `${appUrl}/api/auth/discord/callback`;
    const defaultPostLoginUrl = `${appUrl}/dashboard`;

    try {
        if (!wantsJson) {
            if (!req.query.state) {
                throw Object.assign(new Error('DISCORD_STATE_MISSING'), { stage: 'state_validation' });
            }
            const state = readState(req.query.state);
            redirectUri = state.redirectUri || defaultPostLoginUrl;
            oauthRedirectUri = state.oauthRedirectUri || fallbackCallbackUrl;
        } else {
            redirectUri = req.query.redirect_uri || '';
            oauthRedirectUri = redirectUri || fallbackCallbackUrl;
        }

        if (req.query.error) {
            const discordError = String(req.query.error);
            console.warn('[auth.discord.callback] Discord returned error param', { discordError });
            if (wantsJson) {
                res.status(400).json({ ok: false, error: discordError });
                return;
            }
            redirectWithError(res, redirectUri || defaultPostLoginUrl, discordError, 'discord_authorize');
            return;
        }

        const code = String(req.query.code || '');
        if (!code) {
            throw Object.assign(new Error('DISCORD_CODE_MISSING'), { stage: 'params_validation' });
        }

        const { accessToken } = await exchangeCode(code, oauthRedirectUri);

        const [discordUser, discordGuilds, guildMember] = await Promise.all([
            fetchDiscordUser(accessToken),
            fetchDiscordUserGuilds(accessToken),
            fetchDiscordGuildMember(accessToken)
        ]);

        if (!discordUser || !discordUser.id) {
            throw Object.assign(new Error('USER_UID_REQUIRED'), { stage: 'user_fetch' });
        }

        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 5}.png`;

        const roleInfo = await resolveDiscordRole(discordUser, avatarUrl);
        const role = roleInfo.role;
        const uid = `discord:${discordUser.id}`;

        // SECTION: PENDING_AUTH_WRITE
        // PURPOSE: Check if existing approved profile exists before overwriting role.
        // New logins without an approved profile must remain pending.
        let { data: existingProfile } = await supabase
            .from('staff_profiles')
            .select('access_status, is_active_staff, staff_rank')
            .eq('discord_id', discordUser.id)
            .maybeSingle();

        const isApproved = existingProfile?.access_status === 'approved' && existingProfile?.is_active_staff === true;
        const effectiveRole = isApproved ? role : 'pending';
        const effectivePermissionGroup = isApproved ? roleInfo.permissionGroup : 'pending';
        const effectivePermissionLevel = isApproved ? roleInfo.permissionLevel : 0;

        const profile = {
            uid,
            provider: 'discord',
            discordId: discordUser.id,
            username: discordUser.username || null,
            globalName: discordUser.global_name || discordUser.username || null,
            displayName: discordUser.global_name || discordUser.username || null,
            avatar: avatarUrl,
            role: effectiveRole,
            status: isApproved ? 'active' : 'pending'
        };

        const userProfile = {
            discord_id: discordUser.id,
            email: discordUser.email || null,
            display_name: (guildMember && guildMember.nick) || discordUser.global_name || discordUser.username || null,
            username: discordUser.username || null,
            avatar_url: (guildMember && guildMember.avatar)
                ? `https://cdn.discordapp.com/guilds/1223431616081166336/users/${discordUser.id}/avatars/${guildMember.avatar}.png?size=128`
                : avatarUrl,
            staff_rank: effectiveRole,
            permission_group: effectivePermissionGroup,
            permission_level: effectivePermissionLevel,
            is_active_staff: isApproved,
            access_status: existingProfile?.access_status || 'pending',
            last_seen_at: new Date().toISOString(),
            raw_payload: {
                ...profile,
                discordGuilds: (discordGuilds || []).map(g => ({
                    id: g.id,
                    name: g.name,
                    permissions: String(g.permissions || '0')
                })),
                guildMember: guildMember ? {
                    nick: guildMember.nick,
                    roles: guildMember.roles,
                    avatar: guildMember.avatar,
                    joined_at: guildMember.joined_at
                } : null
            },
            updated_at: new Date().toISOString()
        };

        try {
            await supabase.from('staff_profiles').upsert([userProfile], { onConflict: 'discord_id' });
        } catch (dbError) {
            console.error('[auth.discord.callback] Supabase staff_profiles upsert failed', {
                error: dbError?.message || String(dbError)
            });
            throw Object.assign(new Error('SUPABASE_USER_WRITE_FAILED'), { stage: 'supabase_db' });
        }

        // Issue custom JWT using SUPABASE_JWT_SECRET — must be set in Vercel env
        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        if (!jwtSecret) {
            throw Object.assign(new Error('SUPABASE_JWT_SECRET_MISSING'), { stage: 'supabase_auth' });
        }

        let supabaseToken;
        try {
            const tokenPayload = {
                aud: 'authenticated',
                role: 'authenticated',
                sub: discordUser.id,
                email: discordUser.email || `${discordUser.username}@lutheus.local`,
                phone: '',
                app_metadata: {
                    provider: 'discord',
                    providers: ['discord']
                },
                user_metadata: {
                    avatar_url: avatarUrl,
                    full_name: discordUser.global_name || discordUser.username,
                    discordId: discordUser.id,
                    custom_claims: {
                        role,
                        discordId: discordUser.id
                    }
                },
                aal: 'aal1',
                amr: [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) }]
            };
            supabaseToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });
        } catch (tokenError) {
            console.error('[auth.discord.callback] JWT sign failed', { error: tokenError?.message });
            throw Object.assign(new Error('SUPABASE_CUSTOM_TOKEN_FAILED'), { stage: 'supabase_auth' });
        }

        // Structured success log — no tokens or secrets logged
        console.info('[auth.discord.callback]', {
            ok: true,
            discordUserId: discordUser.id,
            hasEmail: Boolean(discordUser.email),
            role,
            wantsJson,
            redirectTo: wantsJson ? null : redirectUri
        });

        if (wantsJson) {
            res.status(200).json({ ok: true, supabaseToken, profile });
        } else {
            // Redirect to login.html (or returnTo) with token+profile as query params
            // login.js picks these up via signInWithCustomToken
            const url = new URL(redirectUri);
            url.searchParams.set('supabaseToken', supabaseToken);
            url.searchParams.set('profile', encodeProfile(profile));
            res.writeHead(302, { Location: url.toString() });
            res.end();
        }
    } catch (error) {
        const errCode = error.message || 'DISCORD_AUTH_FAILED';
        const errorStage = error.stage || 'callback_handler';
        const requestId = Math.random().toString(36).slice(2, 10);

        console.error('[auth.discord.callback] Error', {
            error: errCode,
            stage: errorStage,
            requestId
        });

        if (wantsJson) {
            res.status(400).json({
                ok: false,
                error: errCode,
                message: 'Discord login callback failed',
                error_stage: errorStage,
                requestId
            });
        } else if (redirectUri) {
            redirectWithError(res, redirectUri, errCode, errorStage);
        } else {
            res.status(400).json({
                ok: false,
                error: errCode,
                message: 'Discord login callback failed',
                error_stage: errorStage,
                requestId
            });
        }
    }
};
