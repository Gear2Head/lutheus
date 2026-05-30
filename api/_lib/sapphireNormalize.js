const crypto = require('crypto');

// SECTION: SAPPHIRE_NORMALIZE
// PURPOSE: Normalize raw data scraped or intercepted from Sapphire into a strict canonical schema.

function safeString(value) {
    return String(value || '').trim();
}

function calculateContentHash(fields) {
    const serialized = fields.map(f => safeString(f).toLowerCase()).join('|');
    return crypto.createHash('sha256').update(serialized).digest('hex');
}

function parseCaseId(value) {
    const text = safeString(value);
    if (text.includes('_') || text.includes('-')) return '';
    const matched = text.match(/^[A-Za-z0-9]{4,24}$/);
    return matched ? matched[0] : '';
}

function isDiscordId(value) {
    return /^\d{17,20}$/.test(safeString(value));
}

function isLikelyWrongReason(reason) {
    const text = String(reason || '').trim();
    if (!text) return true;
    if (/\d{17,20}/.test(text)) return true; // Discord ID
    if (/<@!?\d{17,20}>/.test(text)) return true; // Mention
    if (/^@?[\w.-]{2,32}#\d{4}$/.test(text)) return true; // User tag (legacy)
    if (/^\S+\s+\d{17,20}$/.test(text)) return true; // Name + ID pattern
    return false;
}

function isReasonLike(value) {
    const text = safeString(value);
    if (!text || isLikelyWrongReason(text)) return false;
    if (isDiscordId(text)) return false;
    if (/^\d{17,20}$/.test(text)) return false;
    if (!text.includes('_') && !text.includes('-') && /^[A-Za-z0-9]{4,24}$/.test(text) && /[A-Za-z]/.test(text) && /\d/.test(text)) return false;
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(text)) return false;
    if (/^(mute|ban|warn|kick|timeout|permanent|süresiz|suresiz)$/i.test(text)) return false;
    return true;
}

function validateWsPayload(item, guildId) {
    const caseId = String(item.caseId || item.id || '').trim();
    if (caseId.includes('_') || caseId.includes('-')) {
        return { valid: false, reason: 'invalid_case_id' };
    }
    if (!caseId || !/^[A-Za-z0-9]{4,24}$/.test(caseId)) {
        return { valid: false, reason: 'invalid_case_id' };
    }
    if (!guildId || String(guildId).trim() === '') {
        return { valid: false, reason: 'unresolvable_guild_id' };
    }

    const userId = String(item.userId || item.user_id || '').trim();
    const authorId = String(item.authorId || item.moderatorId || item.moderator_id || '').trim();
    const hasUserId = userId && /^\d{17,20}$/.test(userId);
    const hasAuthorId = authorId && /^\d{17,20}$/.test(authorId);

    if (!hasUserId && !hasAuthorId) {
        return { valid: false, reason: 'missing_identity_snowflakes' };
    }

    if (item.timestamp !== undefined && item.timestamp !== null) {
        const ts = Number(item.timestamp);
        if (!Number.isFinite(ts) || ts <= 0) {
            return { valid: false, reason: 'invalid_timestamp_epoch' };
        }
    }

    if (item.expiringTimestamp !== undefined && item.expiringTimestamp !== null) {
        const expTs = Number(item.expiringTimestamp);
        if (!Number.isFinite(expTs) || expTs < 0) {
            return { valid: false, reason: 'invalid_expiring_timestamp' };
        }
    }

    if (item.closed !== undefined && item.closed !== null) {
        if (typeof item.closed !== 'object') {
            return { valid: false, reason: 'closed_property_must_be_object' };
        }
        const closedAuthorId = String(item.closed.authorId || '').trim();
        if (!closedAuthorId || !/^\d{17,20}$/.test(closedAuthorId)) {
            return { valid: false, reason: 'invalid_closed_author_id' };
        }
        if (item.closed.timestamp !== undefined && item.closed.timestamp !== null) {
            const closedTs = Number(item.closed.timestamp);
            if (!Number.isFinite(closedTs) || closedTs <= 0) {
                return { valid: false, reason: 'invalid_closed_timestamp' };
            }
        }
    }

    return { valid: true };
}

function toIsoFromMs(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function normalizeCase(item, guildId) {
    const isWsSource = item.capturedVia === 'ws_interceptor' || item.source === 'sapphire-websocket';
    
    // Strict WS payload validation
    if (isWsSource) {
        const validation = validateWsPayload(item, guildId);
        if (!validation.valid) {
            console.warn('[Normalize] WS Payload validation failed:', validation.reason);
            item.validationError = validation.reason;
        }
    }

    const caseId = parseCaseId(item.caseId || item.id || item.case_id);
    const rawUserId = safeString(item.userId || item.user_id || item.target_id || item.targetId);
    const rawAuthorId = safeString(item.authorId || item.moderatorId || item.moderator_id || item.executorId || item.executor_id);
    const embeddedAuthorId = safeString(item.authorName || item.moderator).match(/\d{17,20}/)?.[0] || '';
    const userId = isDiscordId(rawUserId) ? rawUserId : '';
    const authorId = isDiscordId(rawAuthorId) ? rawAuthorId : embeddedAuthorId;
    
    // Ensure essential string fields are parsed safely
    const userName = safeString(item.userName || item.user || item.user_name || 'Unknown');
    const userAvatar = safeString(item.userAvatar || item.avatar || item.user_avatar || null);
    const authorName = safeString(item.authorName || item.moderator || item.moderator_name || 'Bilinmiyor').replace(authorId, '').trim();
    const authorAvatar = safeString(item.authorAvatar || item.moderatorAvatar || item.moderator_avatar || null);
    
    const type = safeString(item.type || 'unknown').toLowerCase();
    const rawReason = safeString(item.reason || item.reasonRaw || '');
    
    // Bypass isReasonLike logic completely for high-confidence WebSocket streams
    const reason = isWsSource ? rawReason : (isReasonLike(rawReason) ? rawReason : '');
    
    const duration = safeString(item.duration || '');
    const createdRaw = safeString(item.createdRaw || item.createdAt || item.date || '');
    const sourceUrl = safeString(item.sourceUrl || '');

    // Attempt to resolve valid ISO timestamp or fallback
    let createdAt = null;
    if (isWsSource && item.timestamp) {
        createdAt = toIsoFromMs(item.timestamp);
    }
    if (!createdAt && createdRaw) {
        try {
            const parsed = new Date(createdRaw);
            if (!isNaN(parsed.getTime())) {
                createdAt = parsed.toISOString();
            }
        } catch (_e) {}
    }
    if (!createdAt) {
        createdAt = new Date().toISOString();
    }

    // Parse closed attributes from WS payload
    const closedByDiscordId = item.closedByDiscordId || item.closedBy || item.closed?.authorId || null;
    let closedAt = null;
    if (item.closedAt) {
        closedAt = item.closedAt;
    } else if (item.closed?.timestamp) {
        closedAt = toIsoFromMs(item.closed.timestamp);
    }

    const isOpen = typeof item.isOpen === 'boolean' ? item.isOpen : !item.closed;

    // Parse expiring duration metrics
    const expiresAt = item.expiresAt || (item.expiringTimestamp ? toIsoFromMs(item.expiringTimestamp) : null);
    let durationMs = null;
    if (Number.isFinite(Number(item.durationMs))) {
        durationMs = Number(item.durationMs);
    } else if (Number.isFinite(Number(item.timestamp)) && Number.isFinite(Number(item.expiringTimestamp))) {
        durationMs = Math.max(0, Number(item.expiringTimestamp) - Number(item.timestamp));
    }
    const isPermanent = durationMs === null;

    const contentHash = calculateContentHash([
        caseId,
        userId,
        authorId,
        type,
        reason,
        duration,
        createdAt
    ]);

    const caseKey = `${guildId}_${caseId}`;

    const dataCompleteness = {
        hasCaseId: Boolean(caseId),
        hasUserId: Boolean(userId),
        hasAuthorId: Boolean(authorId),
        hasReason: Boolean(reason),
        hasType: Boolean(type && type !== 'unknown'),
        hasCreatedAt: Boolean(createdAt)
    };

    return {
        caseKey,
        guildId,
        caseId,
        userId,
        userName,
        userAvatar: userAvatar || null,
        authorId,
        authorName,
        authorAvatar: authorAvatar || null,
        type,
        reason,
        duration,
        durationMs,
        isPermanent,
        createdAt,
        createdRaw,
        sourceUrl,
        isOpen,
        closedByDiscordId,
        closedAt,
        expiresAt,
        source: item.source || 'sapphire-dashboard',
        capturedVia: item.capturedVia || 'dom_scraper',
        dataCompleteness,
        contentHash,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    normalizeCase
};
