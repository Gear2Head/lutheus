// SECTION: API_ROUTES
// PURPOSE: Triggers bot actions (welcome test, config reset, etc.) on a specific guild.

const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission } = require('../_lib/serverAuth');
const { sendJson } = require('../_lib/apiResponse');

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN;

// Send a message to a Discord channel via bot token
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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'dashboard:view');
        const db = getDb();

        const { guildId, action, payload = {} } = req.body || {};

        if (!guildId || !/^\d{17,20}$/.test(guildId)) {
            return sendJson(res, 400, { error: 'INVALID_GUILD_ID' });
        }
        if (!action) {
            return sendJson(res, 400, { error: 'MISSING_ACTION' });
        }

        // Fetch guild config
        const configDoc = await db.collection('botGuildConfigs').doc(guildId).get();
        const configs = configDoc.exists ? configDoc.data().configs : {};

        let result = { ok: true };

        if (action === 'test_welcome') {
            const welcomeChannelId = configs?.welcome?.channelId;
            if (!welcomeChannelId) {
                return sendJson(res, 400, { error: 'WELCOME_CHANNEL_NOT_SET' });
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
            return sendJson(res, 400, { error: 'UNKNOWN_ACTION' });
        }

        // Audit log
        await db.collection('auditLogs').add({
            action: `bot_action_${action}`,
            guildId,
            uid: actor.uid,
            discordId: actor.discordId || null,
            createdAt: new Date().toISOString()
        }).catch(() => null);

        return sendJson(res, 200, result);

    } catch (err) {
        console.error('[discord-bot-action]', err.message);
        const status = err.statusCode || 500;
        return sendJson(res, status, { error: err.message });
    }
};
