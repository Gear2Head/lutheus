const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission } = require('../_lib/serverAuth');
const { PERMISSIONS } = require('../_lib/roles');
const { ok, forbidden, serverError } = require('../_lib/apiResponse');

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();

        if (req.method === 'GET') {
            await requirePermission(req, PERMISSIONS.AUDIT_LOGS_VIEW);
            const snap = await db.collection('auditLogs')
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
            const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            return ok(res, { items });
        }

        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
