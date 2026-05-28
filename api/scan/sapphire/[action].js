const { supabase } = require('../../_lib/supabaseClient');
const { requirePermission, requireUser } = require('../../_lib/serverAuth');
const { PERMISSIONS, normalizeRole } = require('../../_lib/roles');
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

function unflattenCaseFromDb(row) {
    if (!row) return null;
    return {
        id: row.case_id,
        caseId: row.case_id,
        caseKey: row.case_id,
        guildId: row.guild_id,
        caseUrl: row.case_url,
        sourceUrl: row.case_url,
        type: row.type,
        state: {
            raw: row.state_raw,
            isOpen: row.is_open
        },
        punishedUser: {
            discordId: row.punished_user_discord_id,
            displayName: row.punished_user_display_name,
            avatarUrl: row.punished_user_avatar_url,
            rawText: row.punished_user_display_name || ''
        },
        userId: row.punished_user_discord_id,
        user: row.punished_user_display_name,
        userAvatar: row.punished_user_avatar_url,
        author: {
            discordId: row.author_discord_id,
            displayName: row.author_display_name,
            avatarUrl: row.author_avatar_url,
            rawText: row.author_display_name || ''
        },
        authorId: row.author_discord_id,
        authorName: row.author_display_name,
        authorAvatar: row.author_avatar_url,
        reason: {
            raw: row.reason_raw,
            normalized: row.reason_normalized,
            category: row.reason_category,
            parseStatus: row.reason_parse_status
        },
        duration: {
            raw: row.duration_raw,
            durationMs: row.duration_ms,
            isPermanent: row.is_permanent,
            parseStatus: row.duration_parse_status
        },
        durationMs: row.duration_ms,
        isPermanent: row.is_permanent,
        created: {
            raw: row.created_raw,
            createdAt: row.created_at_sapphire,
            parseStatus: row.created_parse_status
        },
        createdRaw: row.created_raw,
        createdAt: row.created_at_sapphire,
        expiry: {
            expiresAt: row.expires_at,
            remainingMs: row.remaining_ms,
            isExpired: row.is_expired
        },
        expiresAt: row.expires_at,
        isExpired: row.is_expired,
        activeStatus: {
            isActive: row.is_active,
            source: row.active_source,
            conflictDetected: row.conflict_detected,
            conflictReason: row.conflict_reason
        },
        isActive: row.is_active,
        cukAnalysis: row.cuk_analysis,
        cukVerdict: row.cuk_verdict,
        cukConfidence: row.cuk_confidence,
        cukFlags: row.cuk_flags,
        stale: {
            isStale: row.is_stale,
            staleReason: row.stale_reason,
            staleDetectedAt: row.stale_detected_at,
            lastConfirmedInSapphireAt: row.last_confirmed_in_sapphire_at
        },
        isStale: row.is_stale,
        contentHash: row.legacy_payload?.contentHash || null
    };
}

function flattenCaseForDb(data) {
    if (!data) return {};
    const state = data.state || {};
    const punishedUser = data.punishedUser || {};
    const author = data.author || {};
    const reason = data.reason || {};
    const duration = data.duration || {};
    const created = data.created || {};
    const expiry = data.expiry || {};
    const activeStatus = data.activeStatus || {};
    const stale = data.stale || {};

    const authorDiscordId = author.discordId || data.authorId || null;
    const punishedUserDiscordId = punishedUser.discordId || data.userId || null;

    return {
        case_id: data.caseId || data.id,
        guild_id: data.guildId || '1223431616081166336',
        case_url: data.caseUrl || data.sourceUrl || '',
        type: data.type || null,
        state_raw: state.raw || data.stateRaw || null,
        is_open: state.isOpen !== undefined ? state.isOpen : (data.isOpen !== undefined ? data.isOpen : null),
        punished_user_discord_id: punishedUserDiscordId,
        punished_user_display_name: punishedUser.displayName || data.user || null,
        punished_user_avatar_url: punishedUser.avatarUrl || data.userAvatar || null,
        author_discord_id: authorDiscordId,
        author_display_name: author.displayName || data.authorName || null,
        author_avatar_url: author.avatarUrl || data.authorAvatar || null,
        reason_raw: reason.raw || data.reason || '',
        reason_normalized: reason.normalized || data.reason || '',
        reason_category: reason.category || null,
        reason_parse_status: reason.parseStatus || 'complete',
        duration_raw: duration.raw || data.duration || null,
        duration_ms: duration.durationMs !== undefined ? duration.durationMs : (data.durationMs !== undefined ? data.durationMs : null),
        is_permanent: duration.isPermanent !== undefined ? duration.isPermanent : (data.isPermanent || false),
        duration_parse_status: duration.parseStatus || 'complete',
        created_raw: created.raw || data.createdRaw || null,
        created_at_sapphire: created.createdAt || data.createdAt || null,
        created_parse_status: created.parseStatus || 'complete',
        expires_at: expiry.expiresAt || data.expiresAt || null,
        remaining_ms: expiry.remainingMs || data.remainingMs || null,
        is_expired: expiry.isExpired !== undefined ? expiry.isExpired : (data.isExpired || null),
        is_active: activeStatus.isActive !== undefined ? activeStatus.isActive : (data.isActive || null),
        active_source: activeStatus.source || null,
        conflict_detected: activeStatus.conflictDetected || false,
        conflict_reason: activeStatus.conflictReason || null,
        cuk_verdict: data.cukVerdict || data.cukAnalysis?.verdict || null,
        cuk_confidence: data.cukConfidence || data.cukAnalysis?.confidence || null,
        cuk_flags: data.cukFlags || data.cukAnalysis?.flags || [],
        cuk_analysis: data.cukAnalysis || null,
        is_stale: stale.isStale || data.isStale || false,
        stale_reason: stale.staleReason || data.staleReason || null,
        stale_detected_at: stale.staleDetectedAt || data.staleDetectedAt || null,
        last_confirmed_in_sapphire_at: stale.lastConfirmedInSapphireAt || data.lastConfirmedInSapphireAt || null,
        scan_session_id: data.scanSessionId || null,
        migration_source: data.migrationSource || null,
        legacy_payload: { contentHash: data.contentHash },
        raw_payload: data.rawPayload || data || {},
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

    const jobId = `sapphire_${Date.now()}`;
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

    await supabase.from('audit_logs').insert([{
        action: 'sapphire_scan_started',
        target_type: 'scan',
        actor_email: actor.email || null,
        actor_discord_id: actor.discordId || null,
        metadata: { jobId, guildId, scanMode, source }
    }]).catch(() => null);

    return ok(res, {
        success: true,
        jobId,
        status: 'pending',
        requiresExtensionAgent: true
    });
}

async function handleIngest(req, res) {
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

    let { data: jobData } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

    if (!jobData) {
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
        jobData = insertedJob || jobPayload;
    }

    await supabase.from('audit_logs').insert([{
        action: 'sapphire_scan_ingest_received',
        target_type: 'scan',
        actor_email: actor.email || null,
        actor_discord_id: actor.discordId || null,
        metadata: { jobId, guildId, count: items.length, page: body.page || null }
    }]).catch(() => null);

    const normalizedItems = items.map(item => normalizeCase(item, guildId));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (normalizedItems.length > 0) {
        const caseIds = normalizedItems.map(item => item.caseKey);

        const existingRows = [];
        for (let i = 0; i < caseIds.length; i += 100) {
            const chunkIds = caseIds.slice(i, i + 100);
            const { data: chunkRows } = await supabase
                .from('sapphire_cases')
                .select('*')
                .in('case_id', chunkIds);
            if (chunkRows) existingRows.push(...chunkRows);
        }

        const existingMap = new Map(existingRows.map(row => [row.case_id, unflattenCaseFromDb(row)]));

        const upsertRows = [];
        for (const item of normalizedItems) {
            const existing = existingMap.get(item.caseKey);
            const decision = diffCase(existing, item);

            if (decision.type === 'insert') {
                upsertRows.push(flattenCaseForDb(decision.data));
                inserted++;
            } else if (decision.type === 'update') {
                upsertRows.push(flattenCaseForDb(decision.data));
                updated++;
            } else {
                skipped++;
            }
        }

        const staffProfiles = new Map();
        for (const item of normalizedItems) {
            if (item.authorId) {
                staffProfiles.set(item.authorId, {
                    discord_id: item.authorId,
                    display_name: item.authorName || null,
                    avatar_url: item.authorAvatar || null,
                    staff_rank: null,
                    permission_group: 'sapphire',
                    permission_level: 0,
                    is_active_staff: true,
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
        }
        if (staffProfiles.size) {
            const authorIds = Array.from(staffProfiles.keys());
            const { data: existingProfiles } = await supabase
                .from('staff_profiles')
                .select('discord_id, staff_rank, permission_group, permission_level')
                .in('discord_id', authorIds);
            
            const existingMap = new Map((existingProfiles || []).map(p => [p.discord_id, p]));

            const finalProfiles = Array.from(staffProfiles.values()).map(p => {
                const existing = existingMap.get(p.discord_id);
                if (existing) {
                    return {
                        ...p,
                        staff_rank: existing.staff_rank || null,
                        permission_group: existing.permission_group || p.permission_group,
                        permission_level: existing.permission_level !== undefined ? existing.permission_level : p.permission_level
                    };
                }
                return p;
            });

            const { error: staffUpsertError } = await supabase.from('staff_profiles').upsert(finalProfiles, { onConflict: 'discord_id' });
            if (staffUpsertError) {
                console.error('[Ingest] Failed to upsert staff_profiles:', staffUpsertError);
                return serverError(res, staffUpsertError);
            }
        }

        if (upsertRows.length > 0) {
            for (let i = 0; i < upsertRows.length; i += 100) {
                const chunk = upsertRows.slice(i, i + 100);
                const { error: caseUpsertError } = await supabase.from('sapphire_cases').upsert(chunk, { onConflict: 'case_id' });
                if (caseUpsertError) {
                    console.error('[Ingest] Failed to upsert sapphire_cases:', caseUpsertError);
                    return serverError(res, caseUpsertError);
                }
            }
        }
    }

    const nextStats = {
        received: Number(jobData.rows_read || 0) + items.length,
        inserted: Number(jobData.new_cases_inserted || 0) + inserted,
        updated: Number(jobData.cases_updated || 0) + updated,
        skipped: Number(jobData.stale_cases_detected || 0) + skipped,
        incomplete: 0,
        errors: 0
    };

    const isFinished = body.finished === true;
    const jobUpdate = {
        status: isFinished ? 'completed' : 'running',
        completed_pages: Number(jobData.completed_pages || 0) + 1,
        unique_cases_found: Number(jobData.unique_cases_found || 0) + normalizedItems.length,
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
        await supabase.from('audit_logs').insert([{
            action: 'sapphire_scan_completed',
            target_type: 'scan',
            actor_email: actor.email || null,
            actor_discord_id: actor.discordId || null,
            metadata: { jobId, guildId, stats: nextStats }
        }]).catch(() => null);
    }

    return ok(res, {
        ok: true,
        success: true,
        jobId,
        received: items.length,
        inserted,
        updated,
        skipped,
        incomplete: 0,
        errors: 0
    });
}

async function handleStatus(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requireUser(req);
    const jobId = String(req.query.jobId || '').trim();

    if (!jobId) {
        return res.status(400).json({ ok: false, error: 'JOB_ID_REQUIRED' });
    }

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
            id: row.id,
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

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const action = getAction(req);

        if (action === 'start') return handleStart(req, res);
        if (action === 'ingest') return handleIngest(req, res);
        if (action === 'status') return handleStatus(req, res);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', action });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
