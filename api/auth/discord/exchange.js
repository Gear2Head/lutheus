const { supabase } = require('../../_lib/supabaseClient');
const { normalizeRole } = require('../../_lib/roles');
const jwt = require('jsonwebtoken');

// SECTION: API_ROUTES
// PURPOSE: Dedicated Discord OAuth token exchange endpoint for Chrome Extensions using Supabase Auth.

async function exchangeCode(code, redirectUri) {
    const clientId = process.env.DISCORD_CLIENT_ID || '1500551629768888542';
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'zsFAnmy_7FMPvNlfmXaHoPG6AV03zafi';

    if (!clientId || !clientSecret) {
        throw new Error('DISCORD_CLIENT_SECRET_MISSING');
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        })
    });

    const payload = await response.json();
    if (!response.ok) {
        const errType = payload.error || '';
        const errDesc = payload.error_description || '';
        console.error(`Discord Code Exchange Error: status=${response.status}, error=${errType}, description=${errDesc}, raw=${JSON.stringify(payload)}`);
        
        const error = new Error('DISCORD_CODE_EXCHANGE_FAILED');
        error.status = response.status;
        error.payload = payload;
        throw error;
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
        const error = new Error('DISCORD_USER_FETCH_FAILED');
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}

const SEEDED_ROLE_MEMBERS = [
    { id: '770612318689165313', role: 'yonetici', name: 'Yönetici' },
    { id: '202889333563195402', role: 'yonetici', name: 'Yönetici' },
    { id: '344121374320754709', role: 'yonetici', name: 'Yönetici' },
    { id: '1109657614968692840', role: 'genel_sorumlu', name: 'Genel Sorumlu' },
    { id: '962062500189331506', role: 'genel_sorumlu', name: 'Genel Sorumlu' },
    { id: '860192567177773076', role: 'discord_yoneticisi', name: 'Discord Yöneticisi' },
    { id: '758769576778661989', role: 'kidemli_discord_moderatoru', name: 'Gear_Head' },
    { id: '529357404882599966', role: 'discord_moderatoru', name: 'Discord Moderatör' },
    { id: '1360069068794626139', role: 'discord_destek_ekibi', name: 'Discord Destek Ekibi' },
    { id: '707582959766732872', role: 'discord_destek_ekibi', name: 'Discord Destek Ekibi' },
    { id: '1135248585802403901', role: 'discord_destek_ekibi', name: 'Discord Destek Ekibi' },
    { id: '760895784153251841', role: 'discord_destek_ekibi', name: 'Discord Destek Ekibi' },
    { id: '1375772029982085184', role: 'discord_destek_ekibi', name: 'Discord Destek Ekibi' }
];

async function resolveRole(discordId) {
    const bootstrapIds = String(process.env.BOOTSTRAP_DISCORD_IDS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (bootstrapIds.includes(String(discordId))) return 'admin';

    const { data: roleRow } = await supabase
        .from('role_cache')
        .select('*')
        .eq('discord_id', discordId)
        .maybeSingle();

    if (roleRow?.staff_rank) {
        return normalizeRole(roleRow.staff_rank);
    }

    const seeded = SEEDED_ROLE_MEMBERS.find(m => m.id === String(discordId));
    if (seeded) {
        await supabase.from('role_cache').insert([{
            discord_id: String(discordId),
            staff_rank: normalizeRole(seeded.role),
            active: true,
            source: 'lutheus-autoseed',
            last_synced_at: new Date().toISOString(),
            raw_payload: { displayName: seeded.name, role: seeded.role },
            updated_at: new Date().toISOString()
        }]).catch(() => null);

        return normalizeRole(seeded.role);
    }

    return 'pending';
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = req.body || {};
        const code = String(body.code || '');
        const redirectUri = String(body.redirectUri || '');

        if (!code) throw new Error('DISCORD_CODE_MISSING');
        if (!redirectUri) throw new Error('DISCORD_REDIRECT_URI_MISSING');

        const accessToken = await exchangeCode(code, redirectUri);
        const discordUser = await fetchDiscordUser(accessToken);

        if (!discordUser || !discordUser.id) {
            res.status(400).json({ error: 'USER_UID_REQUIRED', detail: 'Discord user id missing' });
            return;
        }

        const uid = `discord:${discordUser.id}`;
        const role = await resolveRole(discordUser.id);
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 5}.png`;

        const profile = {
            uid,
            provider: 'discord',
            discordId: discordUser.id,
            username: discordUser.username || null,
            globalName: discordUser.global_name || discordUser.username || null,
            displayName: discordUser.global_name || discordUser.username || null,
            avatar: avatarUrl,
            role,
            status: 'active'
        };

        const userProfile = {
            discord_id: discordUser.id,
            email: discordUser.email || null,
            display_name: discordUser.global_name || discordUser.username || null,
            username: discordUser.username || null,
            avatar_url: avatarUrl,
            staff_rank: role,
            permission_group: role === 'admin' ? 'admin' : (role === 'yonetici' ? 'management' : 'moderator'),
            permission_level: role === 'admin' ? 100 : (role === 'yonetici' ? 80 : 50),
            is_active_staff: true,
            last_seen_at: new Date().toISOString(),
            raw_payload: profile,
            updated_at: new Date().toISOString()
        };

        try {
            await supabase.from('staff_profiles').upsert([userProfile], { onConflict: 'discord_id' });
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
                        role: role,
                        discordId: discordUser.id
                    }
                },
                role: 'authenticated',
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
        console.error('Discord Exchange Endpoint Error:', error);

        let errCode = 'DISCORD_AUTH_FAILED';
        let errorStage = 'exchange_handler';
        let detail = error.message || '';
        let discordPayload = null;

        if (error.payload) {
            discordPayload = error.payload;
        }

        const msg = String(error.message || '');
        if (msg.includes('DISCORD_CLIENT_SECRET_MISSING')) {
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
        } else if (msg.includes('SUPABASE_USER_WRITE_FAILED')) {
            errCode = 'SUPABASE_USER_WRITE_FAILED';
            errorStage = 'supabase_db';
        } else if (msg.includes('SUPABASE_CUSTOM_TOKEN_FAILED')) {
            errCode = 'SUPABASE_CUSTOM_TOKEN_FAILED';
            errorStage = 'supabase_auth';
        } else if (msg.includes('DISCORD_CODE_MISSING')) {
            errCode = 'DISCORD_CODE_MISSING';
            errorStage = 'params_validation';
        } else if (msg.includes('DISCORD_REDIRECT_URI_MISSING')) {
            errCode = 'DISCORD_REDIRECT_URI_MISSING';
            errorStage = 'params_validation';
        } else if (msg.includes('USER_UID_REQUIRED')) {
            errCode = 'USER_UID_REQUIRED';
            errorStage = 'params_validation';
        }

        res.status(400).json({
            error: errCode,
            error_stage: errorStage,
            detail,
            discord: discordPayload
        });
    }
};
