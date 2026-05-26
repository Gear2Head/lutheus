const { getDb } = require('../../_lib/firebaseAdmin');
const { requirePermission } = require('../../_lib/serverAuth');
const { PERMISSIONS } = require('../../_lib/roles');
const { normalizeCase } = require('../../_lib/sapphireNormalize');
const { diffCase } = require('../../_lib/sapphireDiff');
const { ok, forbidden, serverError } = require('../../_lib/apiResponse');

// SECTION: SCAN_INGEST
// PURPOSE: Processes a batch of moderation entries sent by the extension agent, normalizes them, and merges them to Firestore securely.

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, PERMISSIONS.REPORTS_CREATE);
        const db = getDb();
        const body = req.body || {};
        const jobId = String(body.jobId || '').trim();
        const guildId = String(body.guildId || process.env.LUTHEUS_GUILD_ID || '1223431616081166336');
        const items = Array.isArray(body.items) ? body.items : [];

        if (!jobId) {
            return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
        }

        // Fetch the corresponding job document
        const jobRef = db.collection('scanRuns').doc(jobId);
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) {
            return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
        }

        const jobData = jobDoc.data();

        // Audit Log for Ingest Batch Received
        await db.collection('auditLogs').add({
            action: 'sapphire_scan_ingest_received',
            actorUid: actor.uid,
            actorRole: actor.role,
            jobId,
            guildId,
            details: { count: items.length, page: body.page || null },
            createdAt: new Date().toISOString()
        }).catch(() => null);

        // Normalize incoming items
        const normalizedItems = items.map(item => normalizeCase(item, guildId));

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let incomplete = 0;
        let errors = 0;

        // Perform high-performance batch read of existing documents
        if (normalizedItems.length > 0) {
            const refs = normalizedItems.map(item => db.collection('cases').doc(item.caseKey));
            
            // Fetch existing data in chunks of 100 to prevent exceeding limits
            const existingSnapshots = [];
            for (let i = 0; i < refs.length; i += 100) {
                const chunk = refs.slice(i, i + 100);
                const chunkSnaps = await db.getAll(...chunk);
                existingSnapshots.push(...chunkSnaps);
            }

            const existingMap = new Map(existingSnapshots.map(snap => [snap.id, snap.exists ? snap.data() : null]));

            // Batch writes in chunks of 200 items (Firestore limit is 500)
            for (let i = 0; i < normalizedItems.length; i += 200) {
                const chunk = normalizedItems.slice(i, i + 200);
                const batch = db.batch();
                let batchWritesCount = 0;

                for (const item of chunk) {
                    const existing = existingMap.get(item.caseKey);
                    const decision = diffCase(existing, item);

                    const caseRef = db.collection('cases').doc(item.caseKey);

                    if (decision.type === 'insert') {
                        batch.set(caseRef, decision.data);
                        inserted++;
                        batchWritesCount++;
                    } else if (decision.type === 'update') {
                        batch.set(caseRef, decision.data, { merge: true });
                        updated++;
                        batchWritesCount++;
                    } else {
                        skipped++;
                    }
                }

                if (batchWritesCount > 0) {
                    await batch.commit();
                }
            }
        }

        // Update Job statistics in scanRuns
        const nextStats = {
            received: (jobData.stats?.received || 0) + items.length,
            inserted: (jobData.stats?.inserted || 0) + inserted,
            updated: (jobData.stats?.updated || 0) + updated,
            skipped: (jobData.stats?.skipped || 0) + skipped,
            incomplete: (jobData.stats?.incomplete || 0) + incomplete,
            errors: (jobData.stats?.errors || 0) + errors
        };

        const isFinished = body.finished === true;
        const jobUpdate = {
            status: isFinished ? 'completed' : 'running',
            stats: nextStats,
            updatedAt: new Date().toISOString()
        };
        if (isFinished) {
            jobUpdate.finishedAt = new Date().toISOString();
        } else if (!jobData.startedAt) {
            jobUpdate.startedAt = new Date().toISOString();
        }

        await jobRef.update(jobUpdate);

        // Audit scan completed milestone
        if (isFinished) {
            await db.collection('auditLogs').add({
                action: 'sapphire_scan_completed',
                actorUid: actor.uid,
                actorRole: actor.role,
                jobId,
                guildId,
                details: { stats: nextStats },
                createdAt: new Date().toISOString()
            }).catch(() => null);
        }

        return ok(res, {
            ok: true,
            success: true,
            jobId,
            received: items.length,
            inserted,
            updated,
            skipped,
            incomplete,
            errors
        });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        return serverError(res, error);
    }
};
