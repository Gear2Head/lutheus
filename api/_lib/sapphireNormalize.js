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
    const matched = safeString(value).match(/^\d+$/);
    return matched ? matched[0] : '';
}

function normalizeCase(item, guildId) {
    const caseId = parseCaseId(item.caseId || item.id);
    const userId = safeString(item.userId || item.user_id);
    const authorId = safeString(item.authorId || item.moderatorId || item.moderator_id);
    
    // Ensure essential string fields are parsed safely
    const userName = safeString(item.userName || item.user || item.user_name || 'Unknown');
    const userAvatar = safeString(item.userAvatar || item.avatar || item.user_avatar || null);
    const authorName = safeString(item.authorName || item.moderator || item.moderator_name || 'Bilinmiyor');
    const authorAvatar = safeString(item.authorAvatar || item.moderatorAvatar || item.moderator_avatar || null);
    
    const type = safeString(item.type || 'unknown').toLowerCase();
    const reason = safeString(item.reason || '');
    const duration = safeString(item.duration || '');
    const createdRaw = safeString(item.createdRaw || item.createdAt || item.date || '');
    const sourceUrl = safeString(item.sourceUrl || '');

    // Attempt to resolve valid ISO timestamp or fallback
    let createdAt = null;
    if (createdRaw) {
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
        createdAt,
        createdRaw,
        sourceUrl,
        source: 'sapphire',
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
