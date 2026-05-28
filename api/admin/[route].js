const { supabase } = require('../_lib/supabaseClient');
const { requirePermission, safeDocId } = require('../_lib/serverAuth');
const { PERMISSIONS, normalizeRole } = require('../_lib/roles');
const { ok, badRequest, forbidden, serverError } = require('../_lib/apiResponse');

// SECTION: ADMIN_CATCH_ALL
// PURPOSE: Merged administrative API router to comply with Vercel serverless function allocations limit.

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeIdentityKey(value) {
    return String(value || '').trim();
}

function getRoute(req) {
    const route = req.query?.route;
    if (Array.isArray(route)) return String(route[0] || '').replace(/^\/+|\/+$/g, '');
    return String(route || '').replace(/^\/+|\/+$/g, '');
}

async function addAudit(action, actor, details = {}) {
    return supabase.from('audit_logs').insert([{
        action,
        actor_user_id: actor?.uid || null,
        actor_email: actor?.email || null,
        actor_discord_id: actor?.discordId || null,
        target_type: 'admin',
        metadata: details
    }]).catch(() => null);
}

async function handleAuditLogs(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requirePermission(req, PERMISSIONS.AUDIT_LOGS_VIEW);

    const { data: rows, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) return serverError(res, error);

    const items = (rows || []).map((row) => ({
        id: row.id,
        action: row.action,
        actorUid: row.actor_user_id,
        actorRole: row.metadata?.role || null,
        details: row.metadata,
        createdAt: row.created_at
    }));
    return ok(res, { items });
}

async function handleGoogleAllowlist(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW);

        const { data: rows, error } = await supabase.from('google_allowlist').select('*').limit(200);
        if (error) return serverError(res, error);

        const items = (rows || []).map((row) => ({
            id: row.email,
            email: row.email,
            allowed: row.active,
            role: normalizeRole(row.dashboard_access_role || 'viewer')
        }));

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const payload = {
            email,
            dashboard_access_role: normalizeRole(req.body?.role || 'viewer'),
            active: req.body?.allowed !== false,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('google_allowlist').upsert([payload], { onConflict: 'email' });
        if (error) return serverError(res, error);

        await addAudit('google_allowlist_updated', actor, payload);

        return ok(res, { item: { id: email, email, allowed: payload.active, role: payload.dashboard_access_role } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.query.email || req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const { error } = await supabase.from('google_allowlist').delete().eq('email', email);
        if (error) return serverError(res, error);

        await addAudit('google_allowlist_deleted', actor, { email });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRoleCache(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        let { data: rows, error } = await supabase.from('role_cache').select('*').limit(500);
        if (error) return serverError(res, error);

        if (!rows || rows.length === 0) {
            const seedPayloads = [
                { discord_id: '770612318689165313', staff_rank: 'yonetici', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Yagi' } },
                { discord_id: '202889333563195402', staff_rank: 'yonetici', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'BarisYilmaz' } },
                { discord_id: '344121374320754709', staff_rank: 'yonetici', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Rei' } },
                { discord_id: '1109657614968692840', staff_rank: 'genel_sorumlu', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Maty' } },
                { discord_id: '962062500189331506', staff_rank: 'genel_sorumlu', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Göktuğ' } },
                { discord_id: '860192567177773076', staff_rank: 'discord_yoneticisi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'xGoveer' } },
                { discord_id: '758769576778661989', staff_rank: 'kidemli_discord_moderatoru', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Gear_Head' } },
                { discord_id: '529357404882599966', staff_rank: 'discord_moderatoru', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Dadlukady' } },
                { discord_id: '1360069068794626139', staff_rank: 'discord_destek_ekibi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Timur3' } },
                { discord_id: '707582959766732872', staff_rank: 'discord_destek_ekibi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Ocean' } },
                { discord_id: '1135248585802403901', staff_rank: 'discord_destek_ekibi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'QumruClaus' } },
                { discord_id: '760895784153251841', staff_rank: 'discord_destek_ekibi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Atom' } },
                { discord_id: '1375772029982085184', staff_rank: 'discord_destek_ekibi', active: true, source: 'lutheus-seed', raw_payload: { displayName: 'Nadoo' } }
            ];

            const staffPayloads = seedPayloads.map(p => ({
                discord_id: p.discord_id,
                display_name: p.raw_payload.displayName,
                permission_group: 'seed',
                staff_rank: p.staff_rank,
                is_active_staff: true,
                raw_payload: p.raw_payload,
                updated_at: new Date().toISOString()
            }));

            await supabase.from('staff_profiles').upsert(staffPayloads, { onConflict: 'discord_id' });
            await supabase.from('role_cache').upsert(seedPayloads, { onConflict: 'discord_id' });

            const { data: reRows } = await supabase.from('role_cache').select('*').limit(500);
            rows = reRows || [];
        }

        const items = (rows || []).map((row) => {
            const payload = row.raw_payload || {};
            return {
                id: `discord:${row.discord_id}`,
                identityKey: `discord:${row.discord_id}`,
                discordId: row.discord_id,
                displayName: payload.displayName || payload.name || `User ${row.discord_id}`,
                role: normalizeRole(row.staff_rank || 'pending')
            };
        });

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const discordId = req.body?.discordId || String(identityKey).replace(/^discord:/, '');
        const role = normalizeRole(req.body?.role || 'pending');

        const payload = {
            discord_id: discordId,
            staff_rank: role,
            active: true,
            source: 'manual_or_cache',
            raw_payload: {
                identityKey,
                discordId,
                displayName: req.body?.displayName || '',
                role,
                manualAccuracy: req.body?.manualAccuracy !== undefined ? Number(req.body.manualAccuracy) : null,
                updatedAt: new Date().toISOString()
            },
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Ensure staff_profiles entry exists to satisfy the foreign key constraint in role_cache
        const staffPayload = {
            discord_id: discordId,
            display_name: req.body?.displayName || `User ${discordId}`,
            permission_group: ['admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'senior_moderator', 'kidemli_discord_moderatoru'].includes(role) ? 'management' :
                              (['discord_destek_ekibi', 'destek'].includes(role) ? 'support' : 'moderation'),
            permission_level: ['admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'senior_moderator', 'kidemli_discord_moderatoru'].includes(role) ? 100 :
                              (['discord_destek_ekibi', 'destek'].includes(role) ? 25 : 50),
            staff_rank: role,
            is_active_staff: role !== 'pending' && role !== 'blocked',
            updated_at: new Date().toISOString()
        };
        const { error: staffError } = await supabase.from('staff_profiles').upsert([staffPayload], { onConflict: 'discord_id' });
        if (staffError) return serverError(res, staffError);

        const { error } = await supabase.from('role_cache').upsert([payload], { onConflict: 'discord_id' });
        if (error) return serverError(res, error);

        await addAudit('role_cache_updated', actor, payload.raw_payload);

        return ok(res, { item: { id: identityKey, ...payload.raw_payload } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.query.identityKey || req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const discordId = String(identityKey).replace(/^discord:/, '');
        const { error } = await supabase.from('role_cache').delete().eq('discord_id', discordId);
        if (error) return serverError(res, error);

        await addAudit('role_cache_deleted', actor, { identityKey });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRolePolicy(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_VIEW);

        const { data: row, error } = await supabase.from('app_settings').select('*').eq('key', 'settings').maybeSingle();
        if (error) return serverError(res, error);

        const policy = row ? row.value : null;
        return ok(res, { policy });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
        const actor = await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_UPDATE);
        const policy = req.body?.policy;

        if (!policy || typeof policy !== 'object') {
            return badRequest(res, 'POLICY_REQUIRED');
        }

        const payload = {
            ...policy,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase.from('app_settings').upsert([{ key: 'settings', value: payload }], { onConflict: 'key' });
        if (error) return serverError(res, error);

        await addAudit('role_policy_updated', actor, { keys: Object.keys(policy) });

        return ok(res, { policy: payload });
    }

    res.setHeader('Allow', 'GET,PATCH,POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleStaffProfiles(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        const { data: rows, error } = await supabase
            .from('staff_profiles')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(500);
        if (error) return serverError(res, error);

        const items = (rows || []).map((row) => ({
            id: row.discord_id || row.id,
            discordId: row.discord_id,
            discordUserId: row.discord_id,
            sapphireAuthorId: row.discord_id,
            email: row.email,
            displayName: row.display_name || row.username || row.raw_payload?.displayName || row.raw_payload?.name || `User ${row.discord_id}`,
            name: row.display_name || row.username || row.raw_payload?.displayName || row.raw_payload?.name || `User ${row.discord_id}`,
            username: row.username,
            avatar: row.avatar_url || row.raw_payload?.avatar || row.raw_payload?.avatarUrl || null,
            avatarUrl: row.avatar_url || row.raw_payload?.avatar || row.raw_payload?.avatarUrl || null,
            role: normalizeRole(row.staff_rank || row.raw_payload?.role || 'pending'),
            isActiveStaff: row.is_active_staff !== false,
            source: row.permission_group || row.raw_payload?.source || 'supabase',
            updatedAt: row.updated_at,
            lastSeen: row.last_seen_at
        }));

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const profiles = Array.isArray(req.body?.profiles) ? req.body.profiles : [req.body || {}];
        const rows = profiles
            .map((profile) => {
                const discordId = String(profile.discordId || profile.discordUserId || profile.id || '').replace(/^discord:/, '').trim();
                if (!/^\d{17,20}$/.test(discordId)) return null;
                return {
                    discord_id: discordId,
                    email: profile.email || null,
                    display_name: profile.displayName || profile.name || profile.username || null,
                    username: profile.username || null,
                    avatar_url: profile.avatar || profile.avatarUrl || null,
                    staff_rank: profile.role ? normalizeRole(profile.role) : null,
                    permission_group: profile.source || 'extension',
                    permission_level: Number(profile.permissionLevel || 0),
                    is_active_staff: profile.isActiveStaff !== false,
                    last_seen_at: profile.lastSeen || profile.updatedAt || new Date().toISOString(),
                    raw_payload: profile,
                    updated_at: new Date().toISOString()
                };
            })
            .filter(Boolean);

        if (!rows.length) return badRequest(res, 'STAFF_PROFILES_REQUIRED');

        const { error } = await supabase.from('staff_profiles').upsert(rows, { onConflict: 'discord_id' });
        if (error) return serverError(res, error);

        await addAudit('staff_profiles_upserted', actor, { count: rows.length });
        return ok(res, { items: rows });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

// SECTION: DISCORD_BOT_DASHBOARD
// PURPOSE: Handles server lists, server configurations, automod, logging, welcome messages and manual testing.

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN;

// Fetch all guilds where bot is installed via bot token
async function fetchBotGuilds() {
    const token = BOT_TOKEN();
    if (!token) throw new Error('DISCORD_BOT_TOKEN_MISSING');

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bot ${token}` }
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Bot guilds fetch failed:', err);
        throw new Error('DISCORD_GUILDS_FETCH_FAILED');
    }

    return res.json();
}

// Fetch guild details (member count, icon, etc.)
async function fetchGuildDetails(guildId) {
    const token = BOT_TOKEN();
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${token}` }
    });
    if (!res.ok) return null;
    return res.json();
}

// Fetch user's guilds from Supabase (stored during OAuth)
async function fetchUserDiscordGuilds(discordId) {
    const { data: row } = await supabase
        .from('staff_profiles')
        .select('raw_payload')
        .eq('discord_id', discordId)
        .maybeSingle();
    if (!row) return null;
    return row.raw_payload?.discordGuilds || null;
}

// Fetch guild channels from Discord API
async function fetchGuildChannels(guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const channels = await res.json();
    return channels
        .filter(c => c.type === 0 || c.type === 5)
        .map(c => ({ id: c.id, name: c.name, type: c.type === 5 ? 'announcement' : 'text' }));
}

// Fetch guild roles from Discord API
async function fetchGuildRoles(guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const roles = await res.json();
    return roles
        .filter(r => r.id !== guildId)
        .map(r => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5'
        }));
}

// Fetch bot's slash commands for the guild
async function fetchBotCommands(guildId) {
    const appId = process.env.DISCORD_CLIENT_ID;
    if (!appId) return [];
    const res = await fetch(`${DISCORD_API}/applications/${appId}/guilds/${guildId}/commands`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const cmds = await res.json();
    return cmds.map(c => ({
        name: c.name,
        description: c.description || '',
        category: 'moderation',
        cooldown: 3,
        enabled: true
    }));
}

function defaultConfigs() {
    return {
        moderation: { enabled: false, moderatorRoles: [], muteRole: '', logChannelId: '', appealLink: '', dmOnAction: true, reasonRequired: true },
        automod: { enabled: false, antiSpam_enabled: false, antiSpam_threshold: 5, antiSpam_action: 'timeout', antiLink_enabled: false, antiInvite_enabled: false, antiLink_action: 'warn', antiCaps_enabled: false, antiCaps_maxPercent: 70, badWords_enabled: false, badWords_list: '' },
        logging: { enabled: false, logChannelId: '', events_messageDelete: true, events_messageEdit: true, events_memberJoin: true, events_memberLeave: true, events_roleChange: false, events_channelChange: false, events_voiceState: false, events_modAction: true },
        welcome: { enabled: false, channelId: '', message: 'Hoş geldin {user}!', embedEnabled: false, embedTitle: 'Hoş Geldin!', embedColor: '#7c5af5', dmEnabled: false, dmMessage: '' },
        permissions: { adminRoles: [], moderatorRoles: [] },
        levels: { enabled: false, xpMin: 15, xpMax: 25, cooldownSeconds: 60, rewards: {} },
        settings: { language: 'tr', timezone: 'Europe/Istanbul', retentionDays: 30 }
    };
}

async function sendDiscordMessage(channelId, content, embed = null) {
    const body = { content };
    if (embed) body.embeds = [embed];

    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${BOT_TOKEN()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`DISCORD_MESSAGE_FAILED: ${err}`);
    }
    return res.json();
}

async function handleDiscordBotGuilds(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'discord_bot:view');

        const botGuilds = await fetchBotGuilds();
        const botGuildIds = new Set(botGuilds.map(g => g.id));

        let userGuildIds = new Set();
        if (actor.discordId) {
            const storedGuilds = await fetchUserDiscordGuilds(actor.discordId);
            if (storedGuilds) {
                storedGuilds
                    .filter(g => (Number(g.permissions) & 0x20) !== 0 || (Number(g.permissions) & 0x8) !== 0)
                    .forEach(g => userGuildIds.add(g.id));
            }
        }

        const hasFilter = userGuildIds.size > 0;
        const filteredGuildIds = hasFilter
            ? [...botGuildIds].filter(id => userGuildIds.has(id))
            : [...botGuildIds];

        const detailPromises = filteredGuildIds.slice(0, 25).map(id => fetchGuildDetails(id));
        const details = await Promise.all(detailPromises);

        const guilds = details
            .filter(Boolean)
            .map(g => ({
                id: g.id,
                name: g.name,
                memberCount: g.approximate_member_count || g.member_count || 0,
                botInstalled: true,
                iconUrl: g.icon
                    ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
                    : `https://cdn.discordapp.com/embed/avatars/${Number(g.id) % 5}.png`
            }));

        return ok(res, { guilds });
    } catch (err) {
        console.error('[discord-bot-guilds]', err.message);
        return serverError(res, err);
    }
}

async function handleDiscordBotDashboard(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET,POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const guildId = String(req.query?.guildId || req.body?.guildId || '').trim();
    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return badRequest(res, 'INVALID_GUILD_ID');
    }

    try {
        if (req.method === 'GET') {
            await requirePermission(req, 'discord_bot:view');

            const [configRow, channels, roles, commands] = await Promise.all([
                supabase.from('app_settings').select('*').eq('key', `bot_guild_config_${guildId}`).maybeSingle(),
                fetchGuildChannels(guildId),
                fetchGuildRoles(guildId),
                fetchBotCommands(guildId)
            ]);

            const configs = configRow?.data ? configRow.data.value.configs : defaultConfigs();
            return ok(res, { configs, channels, roles, commands });
        } else {
            const actor = await requirePermission(req, 'discord_bot:update');
            const configs = req.body?.configs;
            if (!configs || typeof configs !== 'object') {
                return badRequest(res, 'CONFIGS_REQUIRED');
            }

            await supabase.from('app_settings').upsert([{
                key: `bot_guild_config_${guildId}`,
                value: {
                    guildId,
                    configs,
                    updatedAt: new Date().toISOString(),
                    updatedBy: actor.discordId || actor.uid
                }
            }], { onConflict: 'key' });

            await addAudit('bot_guild_config_updated', actor, { guildId });
            return ok(res, { success: true });
        }
    } catch (err) {
        console.error('[discord-bot-dashboard]', err.message);
        return serverError(res, err);
    }
}

async function handleDiscordBotAction(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'discord_bot:update');
        const { guildId, action, payload = {} } = req.body || {};

        if (!guildId || !/^\d{17,20}$/.test(guildId)) {
            return badRequest(res, 'INVALID_GUILD_ID');
        }
        if (!action) {
            return badRequest(res, 'MISSING_ACTION');
        }

        const { data: row } = await supabase.from('app_settings').select('*').eq('key', `bot_guild_config_${guildId}`).maybeSingle();
        const configs = row ? row.value.configs : {};

        let result = { ok: true };

        if (action === 'test_welcome') {
            const welcomeChannelId = configs?.welcome?.channelId;
            if (!welcomeChannelId) {
                return badRequest(res, 'WELCOME_CHANNEL_NOT_SET');
            }

            const msg = configs?.welcome?.message || 'Hoş geldin {user}!';
            const formatted = msg
                .replace(/{user}/g, `<@${actor.discordId || '0'}>`)
                .replace(/{username}/g, actor.discordId ? 'TestUser' : 'TestUser')
                .replace(/{server}/g, 'Sunucu')
                .replace(/{memberCount}/g, '?');

            if (configs?.welcome?.embedEnabled) {
                await sendDiscordMessage(welcomeChannelId, null, {
                    title: configs.welcome.embedTitle || 'Hoş Geldin!',
                    description: formatted,
                    color: parseInt((configs.welcome.embedColor || '#7c5af5').replace('#', ''), 16)
                });
            } else {
                await sendDiscordMessage(welcomeChannelId, formatted);
            }

            result = { ok: true, message: 'Welcome test sent' };
        } else if (action === 'reset_config') {
            await supabase.from('app_settings').delete().eq('key', `bot_guild_config_${guildId}`);
            result = { ok: true, message: 'Config reset' };
        } else {
            return badRequest(res, 'UNKNOWN_ACTION');
        }

        await addAudit(`discord_bot_action:${action}`, actor, { guildId, payload });
        return ok(res, result);
    } catch (err) {
        console.error('[discord-bot-action]', err.message);
        return serverError(res, err);
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const route = getRoute(req);

        if (route === 'audit-logs') return handleAuditLogs(req, res);
        if (route === 'google-allowlist') return handleGoogleAllowlist(req, res);
        if (route === 'role-cache') return handleRoleCache(req, res);
        if (route === 'role-policy') return handleRolePolicy(req, res);
        if (route === 'staff-profiles') return handleStaffProfiles(req, res);
        if (route === 'discord-bot-guilds') return handleDiscordBotGuilds(req, res);
        if (route === 'discord-bot-dashboard') return handleDiscordBotDashboard(req, res);
        if (route === 'discord-bot-action') return handleDiscordBotAction(req, res);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', route });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
