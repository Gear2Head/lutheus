// SECTION: API_ROUTES
// PURPOSE: Returns guilds where the Lutheus bot is installed. Uses bot token for server list,
//          filters by admin permission of the authenticated user.

const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission } = require('../_lib/serverAuth');
const { sendJson } = require('../_lib/apiResponse');

const DISCORD_API = 'https://discord.com/api/v10';

// Fetch all guilds where bot is installed via bot token
async function fetchBotGuilds() {
    const token = process.env.DISCORD_BOT_TOKEN;
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
    const token = process.env.DISCORD_BOT_TOKEN;
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

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'dashboard:view');
        const db = getDb();

        // Get guilds where bot is installed
        const botGuilds = await fetchBotGuilds();
        const botGuildIds = new Set(botGuilds.map(g => g.id));

        // Get user's stored Discord guilds (from OAuth) from Firestore
        let userGuildIds = new Set();
        if (actor.discordId) {
            const storedGuilds = await fetchUserDiscordGuilds(db, actor.discordId);
            if (storedGuilds) {
                // User guilds where they have MANAGE_GUILD permission (0x20)
                storedGuilds
                    .filter(g => (Number(g.permissions) & 0x20) !== 0 || (Number(g.permissions) & 0x8) !== 0)
                    .forEach(g => userGuildIds.add(g.id));
            }
        }

        // Filter: only guilds where bot is installed AND user has admin in that guild
        // If no user guilds stored, return all bot guilds (admin sees all)
        const hasFilter = userGuildIds.size > 0;
        const filteredGuildIds = hasFilter
            ? [...botGuildIds].filter(id => userGuildIds.has(id))
            : [...botGuildIds];

        // Fetch details for each guild (parallel, max 10)
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

        return sendJson(res, 200, { guilds });

    } catch (err) {
        console.error('[discord-bot-guilds]', err.message);
        const status = err.statusCode || 500;
        return sendJson(res, status, { error: err.message });
    }
};
