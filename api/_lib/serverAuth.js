const { getAuth, getDb } = require('./firebaseAdmin');
const { normalizeRole, hasPermission } = require('./roles');

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

async function requireUser(req) {
    const token = getBearerToken(req);
    if (!token) {
        const error = new Error('AUTH_REQUIRED');
        error.statusCode = 401;
        throw error;
    }

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const db = getDb();

    const doc = await db.collection('users').doc(safeDocId(uid)).get();
    const user = doc.exists ? doc.data() : {};

    const role = normalizeRole(user.role || decoded.role || 'pending');
    const status = user.status || decoded.status || 'active';

    if (status === 'blocked' || role === 'blocked') {
        const error = new Error('AUTH_BLOCKED');
        error.statusCode = 403;
        throw error;
    }

    return {
        uid,
        email: user.email || decoded.email || null,
        role,
        status,
        profile: user
    };
}

async function requirePermission(req, permission) {
    const user = await requireUser(req);

    if (!hasPermission(user.role, permission)) {
        await getDb().collection('auditLogs').add({
            action: 'unauthorized_access_attempt',
            actorUid: user.uid,
            actorRole: user.role,
            details: {
                permission,
                path: req.url,
                method: req.method
            },
            createdAt: new Date().toISOString()
        }).catch(() => null);

        const error = new Error('FORBIDDEN');
        error.statusCode = 403;
        throw error;
    }

    return user;
}

module.exports = { requireUser, requirePermission, safeDocId };
