const { getAuth, getDb } = require('./firebaseAdmin');
const { normalizeRole, hasPermission } = require('./roles');

// SECTION: SERVER_AUTH
// PURPOSE: Handles server-side identity verification, allowance checks, and custom role mappings.

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

function extractDiscordId(decoded) {
    const candidates = [
        decoded.discordId,
        decoded.firebase?.identities?.['discord.com']?.[0],
        String(decoded.uid || '').startsWith('discord:') ? String(decoded.uid).replace(/^discord:/, '') : null
    ].filter(Boolean);

    return candidates.find((value) => /^\d{17,20}$/.test(String(value))) || '';
}

async function resolveActorFromToken(req) {
    const token = getBearerToken(req);
    if (!token) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { statusCode: 401 });
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

async function requireUser(req) {
    const actor = await resolveActorFromToken(req);
    if (actor.role === 'blocked') {
        throw Object.assign(new Error('AUTH_BLOCKED'), { statusCode: 403 });
    }
    return actor;
}

async function requirePermission(req, permission) {
    const actor = await requireUser(req);
    const db = getDb();

    if (!hasPermission(actor.role, permission)) {
        await db.collection('auditLogs').add({
            action: 'unauthorized_access_attempt',
            resource: req.url || 'api',
            permission: permission,
            uid: actor.uid,
            email: actor.email || null,
            discordId: actor.discordId || null,
            role: actor.role,
            roleSource: actor.roleSource,
            method: req.method,
            path: req.url,
            userAgent: req.headers['user-agent'] || null,
            createdAt: new Date().toISOString()
        }).catch(() => null);

        throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
    }

    return actor;
}

module.exports = {
    requireUser,
    requirePermission,
    resolveActorFromToken,
    extractDiscordId,
    safeDocId
};
