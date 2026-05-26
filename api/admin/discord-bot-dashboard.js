// SECTION: API_ROUTES
// PURPOSE: GET/POST discord bot dashboard config for a specific guild. Stored per-guild in Firestore.

const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission } = require('../_lib/serverAuth');
const { sendJson } = require('../_lib/apiResponse');

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN;

// Fetch guild channels from Discord API
async function fetchGuildChannels(guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const channels = await res.json();
    return channels
        .filter(c => c.type === 0 || c.type === 5) // text + announcement
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
        .filter(r => r.id !== guildId) // exclude @everyone
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

// Default configs for a new guild
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

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'dashboard:view');
        const db = getDb();

        const guildId = req.query.guildId;
        if (!guildId || !/^\d{17,20}$/.test(guildId)) {
            return sendJson(res, 400, { error: 'INVALID_GUILD_ID' });
        }

        const docRef = db.collection('botGuildConfigs').doc(guildId);

        if (req.method === 'GET') {
            // Fetch config, channels, roles, commands in parallel
            const [configDoc, channels, roles, commands] = await Promise.all([
                docRef.get(),
                fetchGuildChannels(guildId),
                fetchGuildRoles(guildId),
                fetchBotCommands(guildId)
            ]);

            const configs = configDoc.exists ? configDoc.data().configs : defaultConfigs();

            return sendJson(res, 200, { configs, channels, roles, commands });

        } else {
            // POST: Save configs
            const body = req.body;
            if (!body || typeof body.configs !== 'object') {
                return sendJson(res, 400, { error: 'INVALID_BODY' });
            }

            await docRef.set({
                guildId,
                configs: body.configs,
                updatedAt: new Date().toISOString(),
                updatedBy: actor.discordId || actor.uid
            }, { merge: true });

            // Audit log
            await db.collection('auditLogs').add({
                action: 'bot_guild_config_updated',
                guildId,
                uid: actor.uid,
                discordId: actor.discordId || null,
                createdAt: new Date().toISOString()
            }).catch(() => null);

            return sendJson(res, 200, { ok: true });
        }

    } catch (err) {
        console.error('[discord-bot-dashboard]', err.message);
        const status = err.statusCode || 500;
        return sendJson(res, status, { error: err.message });
    }
};
