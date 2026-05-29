// SECTION: API_CLIENT
// PURPOSE: Pure-fetch Supabase REST client — no CDN dependency, CSP-safe for Chrome Extension.

import { getStoredSession, isSessionExpired } from '../auth/sessionStore.js';

const SUPABASE_URL = 'https://jxhzhaqqtlynbnntwpyu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O2mC-cIGP8QgPFpT26_akQ_mW26Jfwg';

async function supabaseFetch(path, options = {}, token = null) {
    const headers = {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
        ...(token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': `Bearer ${SUPABASE_KEY}` }),
        ...(options.headers || {})
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const error = new Error(errBody.message || errBody.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.payload = errBody;
        throw error;
    }
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
}

function isAuthKeyError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.status === 401 ||
        error?.status === 403 ||
        message.includes('no suitable key') ||
        message.includes('wrong key type') ||
        message.includes('invalid jwt') ||
        message.includes('expired') ||
        message.includes('jwt');
}


function mapPathToTable(path) {
    const parts = path.split('/');
    const collection = parts[0];
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;

    let tableName = collection;
    let keyColumn = 'id';

    if (collection === 'googleAllowlist') {
        tableName = 'google_allowlist';
        keyColumn = 'email';
    } else if (collection === 'roleCache') {
        tableName = 'role_cache';
        keyColumn = 'discord_id';
    } else if (collection === 'cases') {
        tableName = 'sapphire_cases';
        keyColumn = 'case_id';
    } else if (collection === 'scanRuns') {
        tableName = 'scan_sessions';
        keyColumn = 'id';
    } else if (collection === 'users') {
        tableName = 'staff_profiles';
        keyColumn = 'discord_id';
    } else if (collection === 'auditLogs') {
        tableName = 'audit_logs';
        keyColumn = 'id';
    } else if (collection === 'rolePolicy') {
        tableName = 'app_settings';
        keyColumn = 'key';
    }

    return { tableName, id, keyColumn };
}

// Data Mappers for Snake/Camel conversions and flattening
function flattenForDb(tableName, data) {
    if (!data) return {};
    
    if (tableName === 'sapphire_cases') {
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
            legacy_payload: data.legacyPayload || null,
            raw_payload: data.rawPayload || data || {},
            scraped_at: data.scrapedAt ? new Date(data.scrapedAt).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    if (tableName === 'google_allowlist') {
        return {
            email: data.email?.toLowerCase(),
            dashboard_access_role: data.role || data.dashboardAccessRole || 'viewer',
            linked_discord_id: data.linkedDiscordId || null,
            staff_rank: data.staffRank || null,
            active: data.allowed !== false && data.active !== false,
            created_at: data.createdAt || data.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    if (tableName === 'role_cache') {
        const discordId = data.discordId || String(data.identityKey || data.id || '').replace(/^discord:/, '');
        return {
            discord_id: discordId,
            staff_rank: data.role || data.staff_rank || 'pending',
            active: data.active !== false,
            source: data.source || 'manual_or_cache',
            last_synced_at: data.lastSyncedAt || new Date().toISOString(),
            raw_payload: data,
            updated_at: new Date().toISOString()
        };
    }

    if (tableName === 'staff_profiles') {
        const discordId = data.discordId || String(data.uid || data.id || '').replace(/^discord:/, '');
        return {
            discord_id: discordId,
            email: data.email || null,
            display_name: data.displayName || data.name || null,
            username: data.username || null,
            avatar_url: data.avatar || data.avatarUrl || null,
            staff_rank: data.role || data.staffRank || null,
            permission_group: data.permissionGroup || 'unknown',
            permission_level: data.permissionLevel !== undefined ? Number(data.permissionLevel) : 0,
            is_active_staff: data.isActiveStaff !== false && data.status !== 'blocked',
            last_seen_at: data.lastLogin || data.updatedAt || new Date().toISOString(),
            raw_payload: data,
            updated_at: new Date().toISOString()
        };
    }

    if (tableName === 'scan_sessions') {
        return {
            source: data.source || 'sapphire',
            guild_id: data.guildId || '1223431616081166336',
            started_at: data.startedAt || new Date().toISOString(),
            completed_at: data.completedAt || null,
            status: data.status || 'pending',
            sapphire_total_cases: data.sapphireTotalCases !== undefined ? data.sapphireTotalCases : null,
            page_size: data.pageSize !== undefined ? data.pageSize : null,
            total_pages: data.totalPages !== undefined ? data.totalPages : null,
            completed_pages: data.completedPages || 0,
            unique_cases_found: data.uniqueCasesFound || 0,
            rows_read: data.rowsRead || 0,
            new_cases_inserted: data.newCasesInserted || 0,
            cases_updated: data.casesUpdated || 0,
            stale_cases_detected: data.staleCasesDetected || 0,
            inconsistencies: data.inconsistencies || [],
            error_message: data.errorMessage || null,
            raw_payload: data
        };
    }

    if (tableName === 'app_settings') {
        return {
            key: data.key,
            value: data,
            updated_at: new Date().toISOString()
        };
    }

    // Default camel -> snake conversion
    const flat = {};
    Object.entries(data).forEach(([k, v]) => {
        const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        flat[snake] = v;
    });
    return flat;
}

function unflattenFromDb(tableName, row) {
    if (!row) return null;

    if (tableName === 'sapphire_cases') {
        return {
            id: row.case_id,
            caseId: row.case_id,
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
            stale: {
                isStale: row.is_stale,
                staleReason: row.stale_reason,
                staleDetectedAt: row.stale_detected_at,
                lastConfirmedInSapphireAt: row.last_confirmed_in_sapphire_at
            },
            isStale: row.is_stale,
            scanSessionId: row.scan_session_id,
            migrationSource: row.migration_source,
            legacyPayload: row.legacy_payload,
            rawPayload: row.raw_payload,
            scrapedAt: row.scraped_at,
            updatedAt: row.updated_at
        };
    }

    if (tableName === 'google_allowlist') {
        return {
            id: row.email,
            email: row.email,
            allowed: row.active,
            active: row.active,
            role: row.dashboard_access_role,
            dashboardAccessRole: row.dashboard_access_role,
            linkedDiscordId: row.linked_discord_id,
            staff_rank: row.staff_rank,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    if (tableName === 'role_cache') {
        const payload = row.raw_payload || {};
        return {
            id: `discord:${row.discord_id}`,
            identityKey: `discord:${row.discord_id}`,
            discordId: row.discord_id,
            displayName: payload.displayName || payload.name || `User ${row.discord_id}`,
            role: row.staff_rank,
            staffRank: row.staff_rank,
            active: row.active,
            source: row.source,
            avatar: payload.avatar || null,
            lastSyncedAt: row.last_synced_at,
            updatedAt: row.updated_at
        };
    }

    if (tableName === 'staff_profiles') {
        const payload = row.raw_payload || {};
        return {
            uid: `discord:${row.discord_id}`,
            id: `discord:${row.discord_id}`,
            discordId: row.discord_id,
            email: row.email,
            displayName: row.display_name,
            name: row.display_name,
            username: row.username,
            avatar: row.avatar_url,
            avatarUrl: row.avatar_url,
            role: row.staff_rank,
            staffRank: row.staff_rank,
            permissionGroup: row.permission_group,
            permissionLevel: row.permission_level,
            isActiveStaff: row.is_active_staff,
            status: row.is_active_staff ? 'active' : 'blocked',
            lastLogin: row.last_seen_at,
            updatedAt: row.updated_at
        };
    }

    if (tableName === 'scan_sessions') {
        return {
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
        };
    }

    if (tableName === 'app_settings') {
        return row.value;
    }

    // Default snake -> camel conversion
    const camel = {};
    Object.entries(row).forEach(([k, v]) => {
        const parts = k.split('_');
        const key = parts[0] + parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        camel[key] = v;
    });
    return camel;
}

async function getIdToken() {
    const session = await getStoredSession();
    if (!session?.idToken || isSessionExpired(session)) {
        return null;
    }
    return session.idToken;
}

function cleanupId(tableName, id) {
    if (!id) return id;
    if (tableName === 'role_cache' || tableName === 'staff_profiles') {
        return id.replace(/^discord:/, '');
    }
    if (tableName === 'sapphire_cases') {
        const parts = id.split('_');
        return parts.length > 1 ? parts[1] : id;
    }
    return id;
}

export const SupabaseRest = {
    async getDocument(path, token = null) {
        const { tableName, id, keyColumn } = mapPathToTable(path);
        const activeToken = token || await getIdToken();
        const cleanId = cleanupId(tableName, id);
        const encoded = encodeURIComponent(cleanId);
        const result = await supabaseFetch(
            `${tableName}?${keyColumn}=eq.${encoded}&limit=1`,
            { prefer: 'return=representation' },
            activeToken
        );
        const row = Array.isArray(result) ? result[0] : result;
        return unflattenFromDb(tableName, row || null);
    },

    async setDocument(path, data) {
        const { tableName, id, keyColumn } = mapPathToTable(path);
        const token = await getIdToken();
        const mappedBody = flattenForDb(tableName, data);
        const cleanId = cleanupId(tableName, id);
        if (cleanId) mappedBody[keyColumn] = cleanId;
        const result = await supabaseFetch(
            `${tableName}`,
            { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: mappedBody },
            token
        );
        const row = Array.isArray(result) ? result[0] : result;
        return unflattenFromDb(tableName, row);
    },

    async listDocuments(collectionPath, options = {}) {
        const { tableName } = mapPathToTable(collectionPath);
        const token = options.token || await getIdToken();
        let qs = '';
        if (options.pageSize) qs += `&limit=${Number(options.pageSize)}`;
        if (options.orderBy) {
            const parts = options.orderBy.trim().split(/\s+/);
            let col = parts[0].replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
            if (tableName === 'sapphire_cases' && parts[0] === 'createdAt') col = 'created_at_sapphire';
            const dir = parts[1] === 'desc' ? 'desc' : 'asc';
            qs += `&order=${col}.${dir}`;
        }
        let result;
        try {
            result = await supabaseFetch(`${tableName}?select=*${qs}`, {}, token);
        } catch (error) {
            if (tableName !== 'sapphire_cases' || !isAuthKeyError(error) || !token) throw error;
            result = await supabaseFetch(`${tableName}?select=*${qs}`, { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }, null);
        }
        if (Array.isArray(result)) return result.map(row => unflattenFromDb(tableName, row));
        return [];
    },

    async createDocument(collectionPath, data, documentId = null) {
        const { tableName, keyColumn } = mapPathToTable(collectionPath);
        const token = await getIdToken();
        const mappedBody = flattenForDb(tableName, data);
        if (documentId) {
            mappedBody[keyColumn] = cleanupId(tableName, documentId);
        }
        const result = await supabaseFetch(
            `${tableName}`,
            { method: 'POST', prefer: 'return=representation', body: mappedBody },
            token
        );
        const row = Array.isArray(result) ? result[0] : result;
        return unflattenFromDb(tableName, row);
    },

    async deleteDocument(path) {
        const { tableName, id, keyColumn } = mapPathToTable(path);
        const token = await getIdToken();
        const cleanId = cleanupId(tableName, id);
        const encoded = encodeURIComponent(cleanId);
        await supabaseFetch(
            `${tableName}?${keyColumn}=eq.${encoded}`,
            { method: 'DELETE', prefer: 'return=minimal' },
            token
        );
        return { deleted: true };
    }
};
