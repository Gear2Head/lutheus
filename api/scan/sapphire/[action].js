const { getDb } = require('../../_lib/firebaseAdmin');
const { requirePermission, requireUser } = require('../../_lib/serverAuth');
const { PERMISSIONS } = require('../../_lib/roles');
const { normalizeCase } = require('../../_lib/sapphireNormalize');
const { diffCase } = require('../../_lib/sapphireDiff');
const { ok, forbidden, serverError } = require('../../_lib/apiResponse');

// SECTION: SCAN_CATCH_ALL
// PURPOSE: Consolidates scanning APIs (start, ingest, status) into a single route to meet Vercel serverless function allocations limits.

function getAction(req) {
    const action = req.query?.action;
    if (Array.isArray(action)) return String(action[0] || '').replace(/^\/+|\/+$/g, '');
    return String(action || '').replace(/^\/+|\/+$/g, '');
}

async function handleStart(req, res, db) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const actor = await requirePermission(req, PERMISSIONS.REPORTS_CREATE);
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
}

async function handleIngest(req, res, db) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const actor = await requirePermission(req, PERMISSIONS.REPORTS_CREATE);
    const body = req.body || {};
    const jobId = String(body.jobId || '').trim();
    const guildId = String(body.guildId || process.env.LUTHEUS_GUILD_ID || '1223431616081166336');
    const items = Array.isArray(body.items) ? body.items : [];

    if (!jobId) {
        return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
    }

    const jobRef = db.collection('scanRuns').doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
        return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
    }

    const jobData = jobDoc.data();

    await db.collection('auditLogs').add({
        action: 'sapphire_scan_ingest_received',
        actorUid: actor.uid,
        actorRole: actor.role,
        jobId,
        guildId,
        details: { count: items.length, page: body.page || null },
        createdAt: new Date().toISOString()
    }).catch(() => null);

    const normalizedItems = items.map(item => normalizeCase(item, guildId));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let incomplete = 0;
    let errors = 0;

    if (normalizedItems.length > 0) {
        const refs = normalizedItems.map(item => db.collection('cases').doc(item.caseKey));
        const existingSnapshots = [];
        for (let i = 0; i < refs.length; i += 100) {
            const chunk = refs.slice(i, i + 100);
            const chunkSnaps = await db.getAll(...chunk);
            existingSnapshots.push(...chunkSnaps);
        }

        const existingMap = new Map(existingSnapshots.map(snap => [snap.id, snap.exists ? snap.data() : null]));

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
}

async function handleStatus(req, res, db) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requireUser(req);
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
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();
        const action = getAction(req);

        if (action === 'start') return handleStart(req, res, db);
        if (action === 'ingest') return handleIngest(req, res, db);
        if (action === 'status') return handleStatus(req, res, db);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', action });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
