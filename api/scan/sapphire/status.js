const { getDb } = require('../../_lib/firebaseAdmin');
const { requireUser } = require('../../_lib/serverAuth');
const { ok, forbidden, serverError } = require('../../_lib/apiResponse');

// SECTION: SCAN_STATUS
// PURPOSE: Returns the current operational state and stats for a given scan job.

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        await requireUser(req);
        const db = getDb();
        const jobId = String(req.query.jobId || '').trim();

        if (!jobId) {
            return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
        }

        const doc = await db.collection('scanRuns').doc(jobId).get();
        if (!doc.exists) {
            return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
        }

        return ok(res, {
            ok: true,
            job: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
