const crypto = require('crypto');
const { supabase } = require('../../_lib/supabaseClient');
const { requirePermission, requireUser } = require('../../_lib/serverAuth');
const { PERMISSIONS, normalizeRole, ROLES } = require('../../_lib/roles');
const { validateCase } = require('../../_lib/cukEngine');
const { resolveDurationMinutesForCuk } = require('../../_lib/durationResolve');

const SESSION_LOCKOUT_MS = 15 * 60 * 1000;
const ACTIVE_SESSION_STATUSES = ['pending', 'running'];
const INGEST_CHUNK_SIZE = 100;

function canForceStartScan(role) {
    const normalized = normalizeRole(role);
    return normalized === ROLES.KURUCU || normalized === ROLES.ADMIN;
}

async function findActiveGuildScan(guildId) {
    const cutoff = new Date(Date.now() - SESSION_LOCKOUT_MS).toISOString();
    const { data, error } = await supabase
        .from('scan_sessions')
        .select('id, status, started_at, source, guild_id')
        .eq('guild_id', guildId)
        .in('status', ACTIVE_SESSION_STATUSES)
        .gte('started_at', cutoff)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw Object.assign(new Error(error.message || 'ACTIVE_SESSION_LOOKUP_FAILED'), { cause: error });
    }
    return data || null;
}

async function cancelHangingSession(sessionId, actor) {
    const message = `Force-start by ${actor.email || actor.discordId || actor.uid || 'admin'}`;
    await supabase
        .from('scan_sessions')
        .update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
}
const { normalizeCase } = require('../../_lib/sapphireNormalize');
const { diffCase, mergeWithoutDataLoss } = require('../../_lib/sapphireDiff');
const { ok, forbidden, serverError } = require('../../_lib/apiResponse');

function getSafeJobId(jobId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const clean = String(jobId || '').trim();
    if (uuidRegex.test(clean)) {
        return clean;
    }
    const hash = crypto.createHash('md5').update(clean).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-a${hash.slice(15, 18)}-${hash.slice(18, 30)}`;
}

async function safeInsertAuditLog(log) {
    try {
        await supabase.from('audit_logs').insert([log]);
    } catch (e) {
        console.warn('[AuditLog] Failed to insert audit log:', e.message || e);
    }
}

// SECTION: SCAN_CATCH_ALL
// PURPOSE: Consolidates scanning APIs (start, ingest, status) into a single route to meet Vercel serverless function allocations limits.

function getAction(req) {
    const action = req.query?.action;
    if (Array.isArray(action)) return String(action[0] || '').replace(/^\/+|\/+$/g, '');
    return String(action || '').replace(/^\/+|\/+$/g, '');
}

function dbRowToDomain(row) {
    if (!row) return null;
    const caseKey = `${row.guild_id}_${row.case_id}`;
    
    const dataCompleteness = {
        hasCaseId: Boolean(row.case_id),
        hasUserId: Boolean(row.punished_user_discord_id),
        hasAuthorId: Boolean(row.author_discord_id),
        hasReason: Boolean(row.reason_raw),
        hasType: Boolean(row.type && row.type !== 'unknown'),
        hasCreatedAt: Boolean(row.created_at_sapphire)
    };

    return {
        caseKey,
        guildId: row.guild_id,
        caseId: row.case_id,
        userId: row.punished_user_discord_id || '',
        userName: row.punished_user_display_name || null,
        userAvatar: row.punished_user_avatar_url || null,
        authorId: row.author_discord_id || '',
        authorName: row.author_display_name || null,
        authorAvatar: row.author_avatar_url || null,
        type: row.type || 'unknown',
        reason: row.reason_raw || '',
        duration: row.duration_raw || '',
        durationMs: row.duration_ms !== undefined ? row.duration_ms : null,
        isPermanent: row.is_permanent !== undefined ? row.is_permanent : (row.duration_ms === null),
        createdAt: row.created_at_sapphire || null,
        createdRaw: row.created_raw || '',
        sourceUrl: row.case_url || '',
        isOpen: row.is_open !== undefined ? row.is_open : null,
        closedByDiscordId: row.closed_by_discord_id || null,
        closedAt: row.closed_at || null,
        expiresAt: row.expires_at || null,
        source: row.source_sync || 'sapphire-dashboard',
        capturedVia: row.source_sync || 'dom_scraper',
        cukVerdict: row.cuk_verdict || null,
        cukAnalysis: row.cuk_analysis || null,
        dataCompleteness,
        contentHash: row.legacy_payload?.contentHash || null,
        firstSeenAt: row.scraped_at || new Date().toISOString(),
        lastSeenAt: row.last_worker_seen_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
    };
}

function resolveLastSyncedBy(source) {
    const s = String(source || '').toLowerCase();
    if (s === 'ws_interceptor' || s === 'sapphire-websocket') return 'extension-ws';
    if (s === 'http_interceptor') return 'extension-http';
    if (s === 'dom_scraper' || s === 'sapphire-dashboard') return 'extension-dom';
    return 'extension-unknown';
}

function flattenCaseForDb(data) {
    if (!data) return {};
    const capturedVia = data.capturedVia || data.source || 'unknown';

    // Run CUK validation (prefer duration_raw, then durationMs; unknown → pending)
    let cukVerdict = data.cukVerdict || null;
    let cukAnalysis = data.cukAnalysis || null;

    if (!cukVerdict) {
        const durationMins = resolveDurationMinutesForCuk(data);
        let analysis;
        // durationMs=0: expiresAt=timestamp olan kalıcı banlar için (Sapphire pattern)
        const effectiveDurationMins = (durationMins === null && data.isPermanent === true) ? 0 : durationMins;
        if (effectiveDurationMins === null) {
            cukVerdict = 'pending';
            cukAnalysis = {
                message: 'Süre belirlenemedi — manuel inceleme gerekir.',
                category: 'Beklemede',
                score: 0
            };
        } else {
            analysis = validateCase(data.reason || '', effectiveDurationMins);
            cukVerdict = analysis.valid ? 'valid' : 'invalid';
            cukAnalysis = {
                message: analysis.message,
                category: analysis.categoryMatched || 'Diğer',
                score: analysis.score
            };
        }
    }

    return {
        case_id: data.caseId || data.id,
        guild_id: data.guildId || '1223431616081166336',
        case_url: data.sourceUrl || '',
        type: data.type || null,
        state_raw: null,
        is_open: data.isOpen !== undefined ? data.isOpen : null,
        punished_user_discord_id: data.userId || null,
        punished_user_display_name: data.userName || null,
        punished_user_avatar_url: data.userAvatar || null,
        author_discord_id: data.authorId || null,
        author_display_name: data.authorName || null,
        author_avatar_url: data.authorAvatar || null,
        reason_raw: data.reason || '',
        reason_normalized: data.reason || '',
        reason_category: null,
        reason_parse_status: 'complete',
        duration_raw: data.duration || null,
        duration_ms: data.durationMs !== undefined ? data.durationMs : null,
        is_permanent: data.isPermanent !== undefined ? data.isPermanent : (data.durationMs === null),
        duration_parse_status: 'complete',
        created_raw: data.createdRaw || null,
        created_at_sapphire: data.createdAt || null,
        created_parse_status: 'complete',
        expires_at: data.expiresAt || null,
        remaining_ms: null,
        is_expired: null,
        is_active: data.isOpen !== undefined ? data.isOpen : null,
        active_source: null,
        conflict_detected: false,
        conflict_reason: null,
        cuk_verdict: cukVerdict,
        cuk_confidence: null,
        cuk_flags: [],
        cuk_analysis: cukAnalysis,
        is_stale: false,
        stale_reason: null,
        stale_detected_at: null,
        last_confirmed_in_sapphire_at: null,
        scan_session_id: data.scanSessionId || null,
        migration_source: null,
        legacy_payload: { contentHash: data.contentHash },
        raw_payload: data.rawPayload || data || {},
        source_sync: capturedVia,
        last_synced_by: resolveLastSyncedBy(capturedVia),
        last_worker_seen_at: new Date().toISOString(),
        closed_by_discord_id: data.closedByDiscordId || null,
        closed_at: data.closedAt || null,
        scraped_at: data.scrapedAt ? new Date(data.scrapedAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function handleStart(req, res) {
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
    const forceStart = body.force === true;

    const activeSession = await findActiveGuildScan(guildId);
    if (activeSession) {
        if (!forceStart || !canForceStartScan(actor.role)) {
            return res.status(409).json({
                ok: false,
                error: 'ACTIVE_SESSION_EXISTS',
                activeSessionId: activeSession.id,
                activeSessionStatus: activeSession.status,
                lockoutMinutes: SESSION_LOCKOUT_MS / 60_000
            });
        }
        await cancelHangingSession(activeSession.id, actor);
        await safeInsertAuditLog({
            action: 'sapphire_scan_force_cancelled',
            target_type: 'scan',
            actor_email: actor.email || null,
            actor_discord_id: actor.discordId || null,
            metadata: { cancelledSessionId: activeSession.id, guildId, forceStart: true }
        });
    }

    const jobId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    const job = {
        id: jobId,
        source: source,
        guildId,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'pending',
        sapphireTotalCases: 0,
        pageSize: 100,
        totalPages: pages.length,
        completedPages: 0,
        uniqueCasesFound: 0,
        rowsRead: 0,
        newCasesInserted: 0,
        casesUpdated: 0,
        staleCasesDetected: 0,
        inconsistencies: [],
        errorMessage: null,
        rawPayload: { jobId, pages, scanMode, requestedBy: actor.uid }
    };

    const dbJob = {
        id: jobId,
        source: job.source,
        guild_id: job.guildId,
        started_at: job.startedAt,
        completed_at: job.completedAt,
        status: job.status,
        sapphire_total_cases: job.sapphireTotalCases,
        page_size: job.pageSize,
        total_pages: job.totalPages,
        completed_pages: job.completedPages,
        unique_cases_found: job.uniqueCasesFound,
        rows_read: job.rowsRead,
        new_cases_inserted: job.newCasesInserted,
        cases_updated: job.casesUpdated,
        stale_cases_detected: job.staleCasesDetected,
        inconsistencies: job.inconsistencies,
        error_message: job.errorMessage,
        raw_payload: job.rawPayload
    };

    await supabase.from('scan_sessions').insert([dbJob]);

    await safeInsertAuditLog({
        action: 'sapphire_scan_started',
        target_type: 'scan',
        actor_email: actor.email || null,
        actor_discord_id: actor.discordId || null,
        metadata: { jobId, guildId, scanMode, source }
    });

    return ok(res, {
        success: true,
        jobId,
        status: 'pending',
        requiresExtensionAgent: true
    });
}

function caseDedupeKey(item) {
    const guildId = item.guildId || item.guild_id;
    const caseId = item.caseId || item.case_id || item.id;

    if (!guildId || !caseId) return null;

    return `${String(guildId)}:${String(caseId)}`;
}

function sourceConfidenceOf(item) {
    const source = String(
        item.capturedVia ||
        item.source_sync ||
        item.source ||
        'unknown'
    );

    if (source === 'ws_interceptor' || source === 'sapphire-websocket') return 100;
    if (source === 'http_interceptor') return 80;
    if (source === 'manual') return 70;
    if (source === 'dom_scraper' || source === 'sapphire-dashboard') return 50;

    return 40;
}

function completenessScore(item) {
    let score = 0;

    if (item.userId || item.punished_user_discord_id) score += 1;
    if (item.authorId || item.author_discord_id) score += 1;
    if (item.reason || item.reason_raw) score += 1;
    if (item.createdAt || item.created_at_sapphire) score += 1;
    if (item.expiresAt || item.expires_at) score += 1;
    if (item.durationMs || item.duration_ms) score += 1;
    if (item.closedAt || item.closed_at) score += 1;
    if (item.closedByDiscordId || item.closed_by_discord_id) score += 1;
    if (item.type) score += 1;

    return score;
}

function preferCase(a, b) {
    const ac = sourceConfidenceOf(a);
    const bc = sourceConfidenceOf(b);

    if (bc > ac) return b;
    if (ac > bc) return a;

    const as = completenessScore(a);
    const bs = completenessScore(b);

    if (bs > as) return b;
    return a;
}

function dedupeCasesForUpsert(domainCases) {
    const map = new Map();
    const duplicateKeys = [];

    for (const item of domainCases) {
        const key = caseDedupeKey(item);

        if (!key) {
            continue;
        }

        const existing = map.get(key);

        if (!existing) {
            map.set(key, item);
            continue;
        }

        duplicateKeys.push(key);

        const preferred = preferCase(existing, item);

        // mergeWithoutDataLoss takes two domain objects and returns one merged domain object
        const merged = mergeWithoutDataLoss(existing, preferred);

        map.set(key, merged);
    }

    return {
        items: Array.from(map.values()),
        duplicateKeys: Array.from(new Set(duplicateKeys))
    };
}

function buildStaffProfilesFromCases(dedupedCases) {
    const staffProfiles = new Map();
    for (const item of dedupedCases) {
        if (!item.authorId) continue;
        staffProfiles.set(item.authorId, {
            discord_id: item.authorId,
            display_name: item.authorName || null,
            avatar_url: item.authorAvatar || null,
            staff_rank: 'pending',
            permission_group: 'pending',
            permission_level: 0,
            is_active_staff: false,
            access_status: 'pending',
            last_seen_at: new Date().toISOString(),
            raw_payload: {
                discordId: item.authorId,
                displayName: item.authorName,
                avatar: item.authorAvatar,
                source: 'sapphire-author'
            },
            updated_at: new Date().toISOString()
        });
    }
    return staffProfiles;
}

async function upsertStaffProfilesForIngest(dedupedCases) {
    const staffProfiles = buildStaffProfilesFromCases(dedupedCases);
    if (!staffProfiles.size) {
        return { success: true, count: 0 };
    }

    const authorIds = Array.from(staffProfiles.keys());
    const { data: existingProfiles, error: existingProfilesError } = await supabase
        .from('staff_profiles')
        .select('discord_id, display_name, avatar_url, staff_rank, permission_group, permission_level, is_active_staff')
        .in('discord_id', authorIds);

    if (existingProfilesError) {
        return {
            success: false,
            error: existingProfilesError,
            code: 'STAFF_PROFILE_READ_FAILED'
        };
    }

    const existingMap = new Map((existingProfiles || []).map((p) => [p.discord_id, p]));

    // SECTION: NAME_DEGRADATION_GUARD
    // PURPOSE: Prevent Sapphire-parsed degraded names (e.g. "Yetkili[3131]") from overwriting
    // valid names already stored in the database from Discord login.
    const DEGRADED_NAME_PATTERNS = [
        /^yetkili\s*\[/i,
        /^yetkili\s*\(/i,
        /^unknown moderator/i,
        /^bilinmeyen yetkili/i,
        /^mod\s*\[/i,
        /^moderator\s*\[/i,
        // WS/DOM fallback placeholder'lar — gerçek isimleri ezmesin
        /^bilinmiyor$/i,
        /^unknown$/i,
        /^yetkili$/i,
        /^unknown user/i
    ];
    const isDegradedName = (name) => !name || DEGRADED_NAME_PATTERNS.some((rx) => rx.test(name.trim()));

    const finalProfiles = Array.from(staffProfiles.values()).map((p) => {
        const existing = existingMap.get(p.discord_id);
        if (!existing) return p;
        // Preserve role/permission data from DB
        const merged = {
            ...p,
            staff_rank: existing.staff_rank || p.staff_rank,
            permission_group: existing.permission_group || p.permission_group,
            permission_level: existing.permission_level !== undefined ? existing.permission_level : p.permission_level,
            is_active_staff: existing.is_active_staff !== undefined ? existing.is_active_staff : p.is_active_staff,
            access_status: existing.access_status || p.access_status
        };
        // Preserve display_name from DB when incoming name is degraded
        if (isDegradedName(p.display_name) && existing.display_name && !isDegradedName(existing.display_name)) {
            merged.display_name = existing.display_name;
        }
        // Preserve avatar_url from DB when incoming is empty
        if (!p.avatar_url && existing.avatar_url) {
            merged.avatar_url = existing.avatar_url;
        }
        return merged;
    });

    const { error: staffUpsertError } = await supabase
        .from('staff_profiles')
        .upsert(finalProfiles, { onConflict: 'discord_id' });

    if (staffUpsertError) {
        return {
            success: false,
            error: staffUpsertError,
            code: 'STAFF_PROFILE_UPSERT_FAILED'
        };
    }

    return { success: true, count: finalProfiles.length };
}

async function upsertCaseRowsInChunks(upsertRows) {
    if (!upsertRows.length) {
        return { success: true, committedChunks: [], committedRowCount: 0 };
    }

    assertNoDuplicateUpsertKeys(upsertRows);

    const committedChunks = [];
    let committedRowCount = 0;

    for (let i = 0; i < upsertRows.length; i += INGEST_CHUNK_SIZE) {
        const chunk = upsertRows.slice(i, i + INGEST_CHUNK_SIZE);
        const chunkIndex = Math.floor(i / INGEST_CHUNK_SIZE);
        const { error: caseUpsertError } = await supabase
            .from('sapphire_cases')
            .upsert(chunk, { onConflict: 'guild_id,case_id' });

        if (caseUpsertError) {
            return {
                success: false,
                partial: committedChunks.length > 0,
                failedChunkIndex: chunkIndex,
                failedRecordStartIndex: i,
                failedRecordEndIndex: Math.min(i + chunk.length - 1, upsertRows.length - 1),
                failedRecordCount: chunk.length,
                committedChunks,
                committedRowCount,
                error: caseUpsertError
            };
        }

        committedChunks.push(chunkIndex);
        committedRowCount += chunk.length;
    }

    return { success: true, committedChunks, committedRowCount };
}

function assertNoDuplicateUpsertKeys(rows) {
    const seen = new Set();
    const duplicates = [];

    for (const row of rows) {
        const key = `${row.guild_id}:${row.case_id}`;

        if (seen.has(key)) {
            duplicates.push(key);
        }

        seen.add(key);
    }

    if (duplicates.length) {
        const uniqueDuplicates = Array.from(new Set(duplicates));
        throw new Error(
            `Duplicate upsert keys detected before Supabase upsert: ${uniqueDuplicates
                .slice(0, 10)
                .join(', ')}`
        );
    }
}

async function handleIngest(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const actor = await requirePermission(req, PERMISSIONS.REPORTS_CREATE);
    const body = req.body || {};
    const rawJobId = String(body.jobId || '').trim();
    const guildId = String(body.guildId || process.env.LUTHEUS_GUILD_ID || '1223431616081166336');
    const items = Array.isArray(body.items) ? body.items : [];

    const skipScanSession = body.skipScanSession === true || body.source === 'ws_interceptor' || rawJobId.startsWith('ws-live-');

    if (!rawJobId && !skipScanSession) {
        return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
    }

    const jobId = rawJobId ? getSafeJobId(rawJobId) : null;

    let jobData = null;
    if (!skipScanSession && jobId) {
        let { data: fetchedJob } = await supabase
            .from('scan_sessions')
            .select('*')
            .eq('id', jobId)
            .maybeSingle();

        if (!fetchedJob) {
            const now = new Date().toISOString();
            const jobPayload = {
                id: jobId,
                source: body.source || 'extension-direct',
                guild_id: guildId,
                started_at: now,
                completed_at: null,
                status: 'running',
                sapphire_total_cases: 0,
                page_size: 100,
                total_pages: Number(body.totalPages || 1),
                completed_pages: 0,
                unique_cases_found: 0,
                rows_read: 0,
                new_cases_inserted: 0,
                cases_updated: 0,
                stale_cases_detected: 0,
                inconsistencies: [],
                error_message: null,
                raw_payload: { jobId, guildId, createdBy: 'ingest' }
            };
            const { data: insertedJob, error: insertError } = await supabase
                .from('scan_sessions')
                .insert([jobPayload])
                .select('*')
                .maybeSingle();
            if (insertError) return serverError(res, insertError);
            fetchedJob = insertedJob || jobPayload;
        }
        jobData = fetchedJob;
    }

    if (!skipScanSession) {
        await safeInsertAuditLog({
            action: 'sapphire_scan_ingest_received',
            target_type: 'scan',
            actor_email: actor.email || null,
            actor_discord_id: actor.discordId || null,
            metadata: { jobId, guildId, count: items.length, page: body.page || null }
        });
    }

    const received = items.length;
    const normalized = [];
    const invalid = [];

    for (const item of items) {
        try {
            const normalizedCase = normalizeCase(item, guildId);

            if (!normalizedCase || !normalizedCase.caseId || !normalizedCase.guildId || normalizedCase.validationError) {
                invalid.push({
                    item,
                    reason: normalizedCase?.validationError || 'missing_case_id_or_guild_id'
                });
                continue;
            }

            normalized.push(normalizedCase);
        } catch (error) {
            invalid.push({
                item,
                reason: error?.message || 'normalize_failed'
            });
        }
    }

    const {
        items: dedupedCases,
        duplicateKeys
    } = dedupeCasesForUpsert(normalized);

    let queuedInsert = 0;
    let queuedUpdate = 0;
    let skipped = 0;
    let warning = null;
    let ingestPartial = false;
    let ingestDiagnostics = null;

    const upsertRows = [];

    if (dedupedCases.length > 0) {
        const caseIds = dedupedCases.map(item => item.caseId).filter(Boolean);

        const existingRows = [];
        if (caseIds.length > 0) {
            for (let i = 0; i < caseIds.length; i += 100) {
                const chunkIds = caseIds.slice(i, i + 100);
                const { data: chunkRows } = await supabase
                    .from('sapphire_cases')
                    .select('*')
                    .in('case_id', chunkIds);
                if (chunkRows) existingRows.push(...chunkRows);
            }
        }

        const existingMap = new Map(existingRows.map(row => [row.case_id, dbRowToDomain(row)]));

        for (const item of dedupedCases) {
            const existing = existingMap.get(item.caseId);
            const decision = diffCase(existing, item);

            if (decision.type === 'insert') {
                upsertRows.push(flattenCaseForDb(decision.data));
                queuedInsert++;
            } else if (decision.type === 'update') {
                upsertRows.push(flattenCaseForDb(decision.data));
                queuedUpdate++;
            } else {
                skipped++;
            }
        }

        const staffSync = await upsertStaffProfilesForIngest(dedupedCases);
        if (!staffSync.success) {
            console.error('[Ingest] staff_profiles sync failed before case upsert:', staffSync.error);
            if (!skipScanSession && jobId) {
                await supabase.from('scan_sessions').update({
                    status: 'failed',
                    error_message: staffSync.code || 'STAFF_PROFILE_SYNC_FAILED',
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
            }
            return res.status(500).json({
                ok: false,
                error: staffSync.code || 'STAFF_PROFILE_SYNC_FAILED',
                message: staffSync.error?.message || 'Staff profile upsert failed',
                details: staffSync.error?.details || null,
                hint: staffSync.error?.hint || null,
                received,
                normalized: normalized.length,
                invalid: invalid.length,
                duplicateInBatch: duplicateKeys.length,
                deduped: dedupedCases.length
            });
        }

        if (upsertRows.length > 0) {
            const caseUpsert = await upsertCaseRowsInChunks(upsertRows);
            if (!caseUpsert.success) {
                ingestPartial = Boolean(caseUpsert.partial);
                ingestDiagnostics = {
                    failedChunkIndex: caseUpsert.failedChunkIndex,
                    failedRecordStartIndex: caseUpsert.failedRecordStartIndex,
                    failedRecordEndIndex: caseUpsert.failedRecordEndIndex,
                    failedRecordCount: caseUpsert.failedRecordCount,
                    committedChunks: caseUpsert.committedChunks,
                    committedRowCount: caseUpsert.committedRowCount
                };

                console.error('[Ingest] sapphire_cases upsert failed:', caseUpsert.error, ingestDiagnostics);

                if (!skipScanSession && jobId) {
                    await supabase.from('scan_sessions').update({
                        status: 'partial',
                        error_message: caseUpsert.error?.message || 'SAPPHIRE_CASES_UPSERT_PARTIAL',
                        inconsistencies: ingestDiagnostics,
                        updated_at: new Date().toISOString()
                    }).eq('id', jobId);
                }

                return res.status(caseUpsert.partial ? 207 : 500).json({
                    ok: false,
                    error: caseUpsert.partial ? 'SAPPHIRE_CASES_UPSERT_PARTIAL' : 'SAPPHIRE_CASES_UPSERT_FAILED',
                    message: caseUpsert.error?.message,
                    details: caseUpsert.error?.details,
                    hint: caseUpsert.error?.hint,
                    code: caseUpsert.error?.code || null,
                    partial: caseUpsert.partial,
                    diagnostics: ingestDiagnostics,
                    received,
                    normalized: normalized.length,
                    invalid: invalid.length,
                    duplicateInBatch: duplicateKeys.length,
                    deduped: dedupedCases.length,
                    committedRowCount: caseUpsert.committedRowCount || 0
                });
            }
        }
    }

    console.log('[Sapphire ingest] batch normalization summary', {
        received,
        normalized: normalized.length,
        invalid: invalid.length,
        duplicateInBatch: duplicateKeys.length,
        deduped: dedupedCases.length,
        rows: upsertRows.length,
        queuedInsert,
        queuedUpdate,
        skipped
    });

    if (!skipScanSession && jobData) {
        const nextStats = {
            received: Number(jobData.rows_read || 0) + items.length,
            inserted: Number(jobData.new_cases_inserted || 0) + queuedInsert,
            updated: Number(jobData.cases_updated || 0) + queuedUpdate,
            skipped: Number(jobData.stale_cases_detected || 0) + skipped,
            incomplete: 0,
            errors: 0
        };

        const isFinished = body.finished === true;
        const status = ingestPartial
            ? 'partial'
            : (body.status || (isFinished ? 'completed' : 'running'));
        const jobUpdate = {
            status: status,
            completed_pages: Number(jobData.completed_pages || 0) + 1,
            unique_cases_found: Number(jobData.unique_cases_found || 0) + normalized.length,
            rows_read: nextStats.received,
            new_cases_inserted: nextStats.inserted,
            cases_updated: nextStats.updated,
            stale_cases_detected: nextStats.skipped,
            updated_at: new Date().toISOString()
        };

        if (isFinished) {
            jobUpdate.completed_at = new Date().toISOString();
        }

        await supabase.from('scan_sessions').update(jobUpdate).eq('id', jobId);

        if (isFinished) {
            await safeInsertAuditLog({
                action: 'sapphire_scan_completed',
                target_type: 'scan',
                actor_email: actor.email || null,
                actor_discord_id: actor.discordId || null,
                metadata: { jobId, guildId, stats: nextStats }
            });
        }
    }

    return ok(res, {
        ok: true,
        success: true,
        jobId: rawJobId,
        received,
        normalized: normalized.length,
        invalid: invalid.length,
        duplicateInBatch: duplicateKeys.length,
        duplicateKeys: duplicateKeys.slice(0, 20),
        deduped: dedupedCases.length,
        upserted: queuedInsert + queuedUpdate,
        queuedInsert,
        queuedUpdate,
        skipped,
        ...(warning ? { warning } : {}),
        ...(ingestPartial ? { partial: true, diagnostics: ingestDiagnostics } : {})
    });
}

async function handleStatus(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requireUser(req);
    const rawJobId = String(req.query.jobId || '').trim();

    if (!rawJobId) {
        return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
    }

    const jobId = getSafeJobId(rawJobId);

    const { data: row } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

    if (!row) {
        return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
    }

    return ok(res, {
        ok: true,
        job: {
            id: rawJobId,
            source: row.source,
            guildId: row.guild_id,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            status: row.status,
            sapphireTotalCases: row.sapphire_total_cases,
            pageSize: row.page_size,
            totalPages: row.total_pages,
            completedPages: row.completed_pages,
            uniqueCasesFound: row.unique_cases_found,
            rowsRead: row.rows_read,
            newCasesInserted: row.new_cases_inserted,
            casesUpdated: row.cases_updated,
            staleCasesDetected: row.stale_cases_detected,
            inconsistencies: row.inconsistencies,
            errorMessage: row.error_message,
            rawPayload: row.raw_payload
        }
    });
}

async function handleWebhook(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    if (process.env.SAPPHIRE_WEBHOOK_ENABLED !== 'true') {
        return res.status(503).json({
            ok: false,
            error: 'WEBHOOK_DISABLED',
            message: 'Sapphire webhook ingest is disabled. Use extension/Vercel ingest (Mod B).'
        });
    }

    const secret = process.env.SAPPHIRE_WEBHOOK_SECRET || '';
    const provided = req.headers['x-sapphire-signature'] || req.headers['x-webhook-secret'] || '';
    if (secret && String(provided) !== secret) {
        return res.status(401).json({ ok: false, error: 'WEBHOOK_UNAUTHORIZED' });
    }

    return handleIngest(req, res);
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const action = getAction(req);

        if (action === 'start') return await handleStart(req, res);
        if (action === 'ingest') return await handleIngest(req, res);
        if (action === 'status') return await handleStatus(req, res);
        if (action === 'webhook') return await handleWebhook(req, res);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', action });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
