const { getAuth, getDb } = require('../_lib/firebaseAdmin');
const { PERMISSIONS, hasPermission, normalizeRole } = require('../_lib/roles');

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function extractDiscordId(decoded) {
    const candidates = [
        decoded.discordId,
        decoded.firebase?.identities?.['discord.com']?.[0],
        String(decoded.uid || '').startsWith('discord:') ? String(decoded.uid).replace(/^discord:/, '') : null
    ].filter(Boolean);

    return candidates.find((value) => /^\d{17,20}$/.test(String(value))) || '';
}

async function logUnauthorized(db, actor, permission, req) {
    await db.collection('auditLogs').add({
        action: 'unauthorized_access_attempt',
        resource: 'api/scan/sapphire',
        permission: permission,
        uid: actor.uid,
        email: actor.email || null,
        discordId: actor.discordId || null,
        role: actor.role || null,
        roleSource: actor.roleSource || null,
        method: req.method,
        path: req.url || '/api/scan/sapphire',
        userAgent: req.headers['user-agent'] || null,
        createdAt: new Date().toISOString()
    }).catch(() => null);
}

async function resolveActorFromToken(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const db = getDb();

    const uid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    const discordId = extractDiscordId(decoded);

    let role = null;
    let source = 'none';

    // 1. users doc
    const userDoc = uid
        ? await db.collection('users').doc(safeDocId(uid)).get().catch(() => null)
        : null;

    if (userDoc?.exists && userDoc.data()?.role) {
        role = userDoc.data().role;
        source = 'users';
    }

    // 2. googleAllowlist doc
    if (!role && email) {
        const allowDoc = await db.collection('googleAllowlist').doc(safeDocId(email)).get().catch(() => null);
        if (allowDoc?.exists && allowDoc.data()?.allowed === true && allowDoc.data()?.role) {
            role = allowDoc.data().role;
            source = 'googleAllowlist';
        }
    }

    // 3. roleCache doc
    if (!role && discordId) {
        const roleDoc = await db.collection('roleCache').doc(`discord:${discordId}`).get().catch(() => null);
        if (roleDoc?.exists && roleDoc.data()?.role) {
            role = roleDoc.data().role;
            source = 'roleCache';
        }
    }

    // 4. tokenClaim
    if (!role && decoded.role) {
        role = decoded.role;
        source = 'tokenClaim';
    }

    role = normalizeRole(role || 'pending');

    return {
        uid,
        email,
        discordId,
        role,
        roleSource: source
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await resolveActorFromToken(req);
        const db = getDb();

        if (!hasPermission(actor.role, PERMISSIONS.REPORTS_CREATE)) {
            await logUnauthorized(db, actor, PERMISSIONS.REPORTS_CREATE, req);
            throw Object.assign(new Error('AUTH_FORBIDDEN'), { status: 403 });
        }

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
            requestedBy: actor.discordId ? `discord:${actor.discordId}` : actor.uid,
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
            ok: false,
            success: false,
            error: error.status === 403 ? 'FORBIDDEN' : (error.message || 'SAPPHIRE_SCAN_FAILED'),
            message: error.status === 403 ? 'Bu islem icin yetkiniz yok.' : undefined
        });
    }
};
