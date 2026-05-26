const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission } = require('../_lib/serverAuth');
const { PERMISSIONS } = require('../_lib/roles');
const { ok, badRequest, forbidden, serverError } = require('../_lib/apiResponse');

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();

        if (req.method === 'GET') {
            await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_VIEW);
            const doc = await db.collection('rolePolicy').doc('settings').get();
            const policy = doc.exists ? doc.data() : null;
            return ok(res, { policy });
        }

        if (req.method === 'PATCH' || req.method === 'POST') {
            const actor = await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_UPDATE);
            const policy = req.body?.policy;
            if (!policy) return badRequest(res, 'POLICY_REQUIRED');

            const payload = {
                ...policy,
                updatedBy: actor.uid,
                updatedAt: new Date().toISOString()
            };

            await db.collection('rolePolicy').doc('settings').set(payload, { merge: true });

            await db.collection('auditLogs').add({
                action: 'role_policy_updated',
                actorUid: actor.uid,
                actorRole: actor.role,
                details: { keys: Object.keys(policy) },
                createdAt: new Date().toISOString()
            });

            return ok(res, { policy: payload });
        }

        res.setHeader('Allow', 'GET,PATCH,POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
