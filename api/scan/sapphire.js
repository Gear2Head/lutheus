const { getAuth, getDb } = require('../_lib/firebaseAdmin');

const STAFF_ROLES = new Set([
    'kurucu',
    'admin',
    'yonetici',
    'genel_sorumlu',
    'discord_yoneticisi',
    'kidemli_discord_moderatoru',
    'senior_moderator',
    'discord_moderatoru',
    'moderator'
]);

function normalizeDiscordId(value) {
    return String(value || '').replace(/^discord:/, '').trim();
}

async function requireRoleCacheUser(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });

    const decoded = await getAuth().verifyIdToken(token);
    const discordId = normalizeDiscordId(decoded.uid || decoded.discordId || decoded.firebase?.identities?.['discord.com']?.[0]);
    if (!discordId) throw Object.assign(new Error('DISCORD_ID_REQUIRED'), { status: 403 });

    const db = getDb();
    const doc = await db.collection('roleCache').doc(`discord:${discordId}`).get();
    if (!doc.exists) throw Object.assign(new Error('AUTH_FORBIDDEN'), { status: 403 });
    const role = String(doc.data().role || '').toLowerCase();
    if (!STAFF_ROLES.has(role)) throw Object.assign(new Error('AUTH_FORBIDDEN'), { status: 403 });

    return { uid: decoded.uid, discordId, role };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requireRoleCacheUser(req);
        const db = getDb();
        const body = req.body || {};
        const jobId = `sapphire_${Date.now()}`;
        const hasWebhook = Boolean(process.env.SAPPHIRE_SCAN_WEBHOOK_URL);
        const job = {
            id: jobId,
            type: 'sapphire_scan',
            status: 'queued',
            guildId: String(body.guildId || process.env.LUTHEUS_GUILD_ID || '1223431616081166336'),
            pages: Array.isArray(body.pages) ? body.pages.slice(0, 10) : [1],
            scanMode: body.scanMode || 'fast',
            requestedBy: `discord:${actor.discordId}`,
            createdAt: new Date().toISOString(),
            delivery: hasWebhook ? 'webhook' : 'firestore_queue',
            error: null
        };

        await db.collection('scanRuns').doc(jobId).set(job);

        if (hasWebhook) {
            await fetch(process.env.SAPPHIRE_SCAN_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(process.env.SAPPHIRE_SCAN_WEBHOOK_SECRET
                        ? { Authorization: `Bearer ${process.env.SAPPHIRE_SCAN_WEBHOOK_SECRET}` }
                        : {})
                },
                body: JSON.stringify(job)
            });
        }

        return res.status(200).json({
            success: true,
            jobId,
            status: job.status,
            error: job.error
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            error: error.message || 'SAPPHIRE_SCAN_FAILED'
        });
    }
};
