const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission, safeDocId } = require('../_lib/serverAuth');
const { PERMISSIONS, normalizeRole } = require('../_lib/roles');
const { ok, badRequest, forbidden, serverError } = require('../_lib/apiResponse');

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();

        if (req.method === 'GET') {
            await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW);
            const snap = await db.collection('googleAllowlist').limit(200).get();
            const items = snap.docs.map((doc) => {
                const data = doc.data();
                return { id: doc.id, ...data, role: normalizeRole(data.role || 'viewer') };
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

            await db.collection('googleAllowlist').doc(safeDocId(email)).set(payload, { merge: true });

            await db.collection('auditLogs').add({
                action: 'google_allowlist_updated',
                actorUid: actor.uid,
                actorRole: actor.role,
                details: payload,
                createdAt: new Date().toISOString()
            });

            return ok(res, { item: { id: safeDocId(email), ...payload } });
        }

        if (req.method === 'DELETE') {
            const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
            const email = normalizeEmail(req.query.email || req.body?.email);
            if (!email) return badRequest(res, 'EMAIL_REQUIRED');

            await db.collection('googleAllowlist').doc(safeDocId(email)).delete();

            await db.collection('auditLogs').add({
                action: 'google_allowlist_deleted',
                actorUid: actor.uid,
                actorRole: actor.role,
                details: { email },
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
