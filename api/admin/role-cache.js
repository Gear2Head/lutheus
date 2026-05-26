const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission, safeDocId } = require('../_lib/serverAuth');
const { PERMISSIONS, normalizeRole } = require('../_lib/roles');
const { ok, badRequest, forbidden, serverError } = require('../_lib/apiResponse');

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();

        if (req.method === 'GET') {
            await requirePermission(req, PERMISSIONS.STAFF_VIEW);
            const snap = await db.collection('roleCache').limit(500).get();
            const items = snap.docs.map((doc) => {
                const data = doc.data();
                return { id: doc.id, ...data, role: normalizeRole(data.role || 'pending') };
            });
            return ok(res, { items });
        }

        if (req.method === 'POST' || req.method === 'PATCH') {
            const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
            const identityKey = req.body?.identityKey;
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

            await db.collection('roleCache').doc(safeDocId(identityKey)).set(payload, { merge: true });

            await db.collection('auditLogs').add({
                action: 'role_cache_updated',
                actorUid: actor.uid,
                actorRole: actor.role,
                details: payload,
                createdAt: new Date().toISOString()
            });

            return ok(res, { item: { id: safeDocId(identityKey), ...payload } });
        }

        if (req.method === 'DELETE') {
            const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
            const identityKey = req.query.identityKey || req.body?.identityKey;
            if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

            await db.collection('roleCache').doc(safeDocId(identityKey)).delete();

            await db.collection('auditLogs').add({
                action: 'role_cache_deleted',
                actorUid: actor.uid,
                actorRole: actor.role,
                details: { identityKey },
                createdAt: new Date().toISOString()
            });

            return ok(res, { deleted: true });
        }

        res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
