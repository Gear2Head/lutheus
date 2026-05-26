const { getDb } = require('../_lib/firebaseAdmin');
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

async function addAudit(db, action, actor, details = {}) {
    return db.collection('auditLogs').add({
        action,
        actorUid: actor?.uid || null,
        actorRole: actor?.role || null,
        details,
        createdAt: new Date().toISOString()
    }).catch(() => null);
}

async function handleAuditLogs(req, res, db) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requirePermission(req, PERMISSIONS.AUDIT_LOGS_VIEW);

    const snap = await db.collection('auditLogs')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(res, { items });
}

async function handleGoogleAllowlist(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW);

        const snap = await db.collection('googleAllowlist').limit(200).get();
        const items = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                email: String(data.email || doc.id || '').toLowerCase(),
                allowed: data.allowed !== false,
                role: normalizeRole(data.role || 'viewer')
            };
        });

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const payload = {
            email,
            allowed: req.body?.allowed !== false,
            role: normalizeRole(req.body?.role || 'viewer'),
            note: req.body?.note || '',
            expiresAt: req.body?.expiresAt || null,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        const id = safeDocId(email);
        await db.collection('googleAllowlist').doc(id).set(payload, { merge: true });
        await addAudit(db, 'google_allowlist_updated', actor, payload);

        return ok(res, { item: { id, ...payload } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.query.email || req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const id = safeDocId(email);
        await db.collection('googleAllowlist').doc(id).delete();
        await addAudit(db, 'google_allowlist_deleted', actor, { email });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRoleCache(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        const snap = await db.collection('roleCache').limit(500).get();
        const items = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                identityKey: data.identityKey || doc.id,
                role: normalizeRole(data.role || 'pending')
            };
        });

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const payload = {
            identityKey,
            discordId: req.body?.discordId || String(identityKey).replace(/^discord:/, ''),
            displayName: req.body?.displayName || '',
            role: normalizeRole(req.body?.role || 'pending'),
            manualAccuracy: req.body?.manualAccuracy !== undefined ? Number(req.body.manualAccuracy) : null,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        const id = safeDocId(identityKey);
        await db.collection('roleCache').doc(id).set(payload, { merge: true });
        await addAudit(db, 'role_cache_updated', actor, payload);

        return ok(res, { item: { id, ...payload } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.query.identityKey || req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const id = safeDocId(identityKey);
        await db.collection('roleCache').doc(id).delete();
        await addAudit(db, 'role_cache_deleted', actor, { identityKey });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRolePolicy(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_VIEW);

        const doc = await db.collection('rolePolicy').doc('settings').get();
        const policy = doc.exists ? doc.data() : null;

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

        await db.collection('rolePolicy').doc('settings').set(payload, { merge: true });
        await addAudit(db, 'role_policy_updated', actor, { keys: Object.keys(policy) });

        return ok(res, { policy: payload });
    }

    res.setHeader('Allow', 'GET,PATCH,POST');
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

// Fetch user's guilds from Firestore (stored during OAuth)
async function fetchUserDiscordGuilds(db, discordId) {
    const userDoc = await db.collection('users').doc(`discord:${discordId}`).get().catch(() => null);
    if (!userDoc?.exists) return null;
    return userDoc.data()?.discordGuilds || null;
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

async function handleDiscordBotGuilds(req, res, db) {
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
            const storedGuilds = await fetchUserDiscordGuilds(db, actor.discordId);
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

async function handleDiscordBotDashboard(req, res, db) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET,POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const guildId = String(req.query?.guildId || req.body?.guildId || '').trim();
    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return badRequest(res, 'INVALID_GUILD_ID');
    }

    const docRef = db.collection('botGuildConfigs').doc(guildId);

    try {
        if (req.method === 'GET') {
            await requirePermission(req, 'discord_bot:view');

            const [configDoc, channels, roles, commands] = await Promise.all([
                docRef.get(),
                fetchGuildChannels(guildId),
                fetchGuildRoles(guildId),
                fetchBotCommands(guildId)
            ]);

            const configs = configDoc.exists ? configDoc.data().configs : defaultConfigs();
            return ok(res, { configs, channels, roles, commands });
        } else {
            const actor = await requirePermission(req, 'discord_bot:update');
            const configs = req.body?.configs;
            if (!configs || typeof configs !== 'object') {
                return badRequest(res, 'CONFIGS_REQUIRED');
            }

            await docRef.set({
                guildId,
                configs,
                updatedAt: new Date().toISOString(),
                updatedBy: actor.discordId || actor.uid
            }, { merge: true });

            await addAudit(db, 'bot_guild_config_updated', actor, { guildId });
            return ok(res, { success: true });
        }
    } catch (err) {
        console.error('[discord-bot-dashboard]', err.message);
        return serverError(res, err);
    }
}

async function handleDiscordBotAction(req, res, db) {
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

        const configDoc = await db.collection('botGuildConfigs').doc(guildId).get();
        const configs = configDoc.exists ? configDoc.data().configs : {};

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
            await db.collection('botGuildConfigs').doc(guildId).delete();
            result = { ok: true, message: 'Config reset' };
        } else {
            return badRequest(res, 'UNKNOWN_ACTION');
        }

        await addAudit(db, `discord_bot_action:${action}`, actor, { guildId, payload });
        return ok(res, result);
    } catch (err) {
        console.error('[discord-bot-action]', err.message);
        return serverError(res, err);
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();
        const route = getRoute(req);

        if (route === 'audit-logs') return handleAuditLogs(req, res, db);
        if (route === 'google-allowlist') return handleGoogleAllowlist(req, res, db);
        if (route === 'role-cache') return handleRoleCache(req, res, db);
        if (route === 'role-policy') return handleRolePolicy(req, res, db);
        if (route === 'discord-bot-guilds') return handleDiscordBotGuilds(req, res, db);
        if (route === 'discord-bot-dashboard') return handleDiscordBotDashboard(req, res, db);
        if (route === 'discord-bot-action') return handleDiscordBotAction(req, res, db);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', route });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
