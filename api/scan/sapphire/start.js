const { getDb } = require('../../_lib/firebaseAdmin');
const { requirePermission } = require('../../_lib/serverAuth');
const { PERMISSIONS } = require('../../_lib/roles');
const { ok, forbidden, serverError } = require('../../_lib/apiResponse');

// SECTION: SCAN_START
// PURPOSE: Initializes a scan session and registers the job state in Firestore.

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, PERMISSIONS.REPORTS_CREATE);
        const db = getDb();
        const body = req.body || {};
        const guildId = String(body.guildId || process.env.LUTHEUS_GUILD_ID || '1223431616081166336');
        const pages = Array.isArray(body.pages) ? body.pages.slice(0, 10) : [1];
        const scanMode = body.scanMode || 'fast';
        const source = body.source || 'web-dashboard';

        const jobId = `sapphire_${Date.now()}`;
        const job = {
            id: jobId,
            type: 'sapphire_scan',
            status: 'queued',
            guildId,
            pages,
            scanMode,
            requestedBy: actor.uid,
            requestedByRole: actor.role,
            source,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            stats: {
                received: 0,
                inserted: 0,
                updated: 0,
                skipped: 0,
                incomplete: 0,
                errors: 0
            }
        };

        await db.collection('scanRuns').doc(jobId).set(job);

        // Also add audit log for start
        await db.collection('auditLogs').add({
            action: 'sapphire_scan_started',
            actorUid: actor.uid,
            actorRole: actor.role,
            jobId,
            guildId,
            details: { source, scanMode, pageCount: pages.length },
            createdAt: new Date().toISOString()
        }).catch(() => null);

        return ok(res, {
            success: true,
            jobId,
            status: job.status,
            requiresExtensionAgent: true
        });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
