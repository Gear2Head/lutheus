const { getAuth, getDb } = require('./_lib/firebaseAdmin');
const { readState } = require('./_lib/oauthState');

const WRITE_OPS = new Set(['set', 'create', 'delete']);
const WRITE_ROLES = new Set([
    'kurucu',
    'admin',
    'yonetici',
    'genel_sorumlu',
    'discord_yoneticisi',
    'kidemli_discord_moderatoru'
]);

function safeSegment(segment) {
    const value = String(segment || '').trim();
    if (!value || value === '.' || value === '..' || value.includes('/')) {
        throw new Error('INVALID_PATH');
    }
    return value;
}

function docRef(db, path) {
    const parts = String(path || '').split('/').filter(Boolean).map(safeSegment);
    if (!parts.length || parts.length % 2 !== 0) throw new Error('INVALID_DOCUMENT_PATH');
    let ref = db.collection(parts[0]);
    for (let index = 1; index < parts.length; index += 2) {
        ref = ref.doc(parts[index]);
        if (parts[index + 1]) ref = ref.collection(parts[index + 1]);
    }
    return ref;
}

function collectionRef(db, path) {
    const parts = String(path || '').split('/').filter(Boolean).map(safeSegment);
    if (!parts.length || parts.length % 2 === 0) throw new Error('INVALID_COLLECTION_PATH');
    let ref = db.collection(parts[0]);
    for (let index = 1; index < parts.length; index += 2) {
        ref = ref.doc(parts[index]);
        if (parts[index + 1]) ref = ref.collection(parts[index + 1]);
    }
    return ref;
}

async function verifySession(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new Error('AUTH_REQUIRED');

    try {
        const decoded = await getAuth().verifyIdToken(token);
        let role = decoded.role || decoded.claims?.role || '';
        try {
            const db = getDb();
            const userDoc = await db.collection('users').doc(String(decoded.uid).toLowerCase().replace(/\//g, '_')).get();
            if (userDoc.exists && userDoc.data().role) role = userDoc.data().role;
            if (!role && decoded.email) {
                const allowDoc = await db.collection('googleAllowlist').doc(String(decoded.email).toLowerCase().replace(/\//g, '_')).get();
                if (allowDoc.exists && allowDoc.data().allowed !== false) role = allowDoc.data().role;
            }
        } catch (_) {
            // Keep token claims if admin lookup is unavailable.
        }
        return {
            uid: decoded.uid,
            email: decoded.email || null,
            role: role || 'viewer',
            provider: decoded.provider || 'firebase'
        };
    } catch (firebaseError) {
        const decoded = readState(token);
        return {
            uid: decoded.uid,
            discordId: decoded.discordId,
            role: decoded.role || 'moderator',
            provider: 'discord-session'
        };
    }
}

function assertAllowed(actor, op) {
    if (!actor?.uid) throw new Error('AUTH_REQUIRED');
    if (WRITE_OPS.has(op) && !WRITE_ROLES.has(String(actor.role || '').toLowerCase())) {
        throw new Error('AUTH_FORBIDDEN');
    }
}

function normalizeDoc(snapshot) {
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const actor = await verifySession(req);
        const { op, path, data, documentId, pageSize = 100, orderBy } = req.body || {};
        assertAllowed(actor, op);

        const db = getDb();
        if (op === 'get') {
            const snapshot = await docRef(db, path).get();
            res.json({ ok: true, document: normalizeDoc(snapshot) });
            return;
        }

        if (op === 'list') {
            let query = collectionRef(db, path);
            if (orderBy) {
                const [field, direction = 'asc'] = String(orderBy).split(/\s+/);
                query = query.orderBy(field, direction.toLowerCase() === 'desc' ? 'desc' : 'asc');
            }
            query = query.limit(Math.min(Number(pageSize) || 100, 500));
            const snapshot = await query.get();
            res.json({ ok: true, documents: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
            return;
        }

        if (op === 'set') {
            const ref = docRef(db, path);
            await ref.set(data || {}, { merge: true });
            const snapshot = await ref.get();
            res.json({ ok: true, document: normalizeDoc(snapshot) });
            return;
        }

        if (op === 'create') {
            const collection = collectionRef(db, path);
            const ref = documentId ? collection.doc(String(documentId)) : collection.doc();
            await ref.set(data || {}, { merge: false });
            const snapshot = await ref.get();
            res.json({ ok: true, document: normalizeDoc(snapshot) });
            return;
        }

        if (op === 'delete') {
            await docRef(db, path).delete();
            res.json({ ok: true });
            return;
        }

        res.status(400).json({ error: 'UNKNOWN_OP' });
    } catch (error) {
        const status = error.message === 'AUTH_REQUIRED' ? 401
            : error.message === 'AUTH_FORBIDDEN' ? 403
                : 400;
        res.status(status).json({ ok: false, error: error.message });
    }
};
