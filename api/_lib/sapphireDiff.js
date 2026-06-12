// SECTION: SAPPHIRE_DIFF
// PURPOSE: Business rules for comparing incoming cases with existing Firestore documents to prevent data loss.

const IMPORTANT_FIELDS = [
    'caseId',
    'guildId',
    'userId',
    'userName',
    'userAvatar',
    'authorId',
    'authorName',
    'authorAvatar',
    'type',
    'reason',
    'duration',
    'durationMs',
    'isPermanent',
    'isOpen',
    'closedAt',
    'closedByDiscordId',
    'expiresAt',
    'createdAt',
    'createdRaw',
    'sourceUrl',
    'source',
    'capturedVia'
];

const SOURCE_CONFIDENCE = {
    'ws_interceptor': 100,
    'sapphire-websocket': 100,
    'http_interceptor': 80,
    'dom_scraper': 50,
    'sapphire-dashboard': 50,
    'manual': 70,
    'legacy_import': 30
};

const PROTECTED_FIELDS = [
    'case_id',
    'guild_id',
    'punished_user_discord_id',
    'author_discord_id',
    'type',
    'reason_raw',
    'reason_normalized',
    'reason_category',
    'created_at_sapphire',
    'expires_at',
    'duration_raw',
    'duration_ms',
    'is_permanent',
    'is_open',
    'closed_at',
    'closed_by_discord_id'
];

function getConfidence(source) {
    return SOURCE_CONFIDENCE[source] || 40;
}

function mapToDbField(key) {
    const mapping = {
        caseId: 'case_id',
        guildId: 'guild_id',
        userId: 'punished_user_discord_id',
        authorId: 'author_discord_id',
        reason: 'reason_raw',
        createdAt: 'created_at_sapphire',
        expiresAt: 'expires_at',
        duration: 'duration_raw',
        durationMs: 'duration_ms',
        isPermanent: 'is_permanent',
        isOpen: 'is_open',
        closedAt: 'closed_at',
        closedByDiscordId: 'closed_by_discord_id',
        type: 'type'
    };
    return mapping[key] || key;
}

function getCompletenessScore(item) {
    if (!item) return 0;
    let score = 0;
    for (const key of IMPORTANT_FIELDS) {
        if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '') {
            score++;
        }
    }
    return score;
}

function mergeWithoutDataLoss(existing, incoming) {
    const result = { ...existing };
    const existingConf = getConfidence(existing.capturedVia || existing.source);
    const incomingConf = getConfidence(incoming.capturedVia || incoming.source);

    // 1. If incoming has higher or equal confidence, we overwrite everything
    if (incomingConf >= existingConf) {
        for (const key of IMPORTANT_FIELDS) {
            if (incoming[key] !== undefined && incoming[key] !== null) {
                if (key === 'userName') {
                    const existingName = String(result[key] || '').trim();
                    const incomingName = String(incoming[key] || '').trim();
                    if (existingName && (incomingName === 'Unknown' || incomingName === 'Bilinmiyor' || incomingName === '')) {
                        continue;
                    }
                }
                if (key === 'authorName') {
                    const existingName = String(result[key] || '').trim();
                    const incomingName = String(incoming[key] || '').trim();
                    const isGeneric = /^(unknown|bilinmiyor|yetkili|bilinmeyen yetkili|unknown moderator)$/i.test(incomingName);
                    if (existingName && (isGeneric || incomingName === '')) {
                        continue;
                    }
                }
                result[key] = incoming[key];
            }
        }
    } else {
        // 2. If incoming has LOWER confidence (e.g. DOM scraper trying to override WS data),
        // we ONLY fill missing fields. We NEVER override protected database fields.
        for (const key of IMPORTANT_FIELDS) {
            const dbField = mapToDbField(key);
            const isProtected = PROTECTED_FIELDS.includes(dbField);

            if (isProtected) {
                // If it is a protected field, only fill if existing is null, empty or undefined
                if (result[key] === undefined || result[key] === null || String(result[key]).trim() === '') {
                    if (incoming[key] !== undefined && incoming[key] !== null) {
                        result[key] = incoming[key];
                    }
                }
            } else {
                // Non-protected field: fill if existing is empty
                if (result[key] === undefined || result[key] === null || String(result[key]).trim() === '') {
                    if (incoming[key] !== undefined && incoming[key] !== null) {
                        result[key] = incoming[key];
                    }
                }
            }
        }
    }

    // Preserve optional or system fields from existing if not in incoming
    const systemFields = ['firstSeenAt', 'note', 'reviewStatus', 'manualOverride', 'assignee', 'validationStatus', 'validationReason', 'cukVerdict', 'cukAnalysis'];
    for (const key of systemFields) {
        if (existing[key] !== undefined && incoming[key] === undefined) {
            result[key] = existing[key];
        }
    }

    if (incoming.contentHash && incoming.contentHash !== existing.contentHash && incomingConf >= existingConf) {
        result.previousHash = existing.contentHash || null;
        result.contentHash = incoming.contentHash;
        result.updatedAt = new Date().toISOString();
    }

    result.lastSeenAt = new Date().toISOString();
    return result;
}

function diffCase(existing, incoming) {
    if (!existing) {
        return { type: 'insert', data: incoming };
    }

    // Rule 2: If contentHash is identical, skip writing entirely
    if (existing.contentHash === incoming.contentHash) {
        return { type: 'skip' };
    }

    const existingConf = getConfidence(existing.capturedVia || existing.source);
    const incomingConf = getConfidence(incoming.capturedVia || incoming.source);

    // Rule 5: If incoming data is less complete, skip to avoid losing data
    // ONLY do this if incoming confidence is NOT lower (if it is lower, it could still fill in empty fields, so we do a partial merge instead of skipping completely, but we avoid overriding protected fields).
    // If incoming confidence is higher, we always allow update.
    if (incomingConf < existingConf) {
        // If incoming has lower confidence, we want to allow the update ONLY if there is at least one field in existing that is empty and populated in incoming.
        let hasNewData = false;
        for (const key of IMPORTANT_FIELDS) {
            const isEmptyInExisting = existing[key] === undefined || existing[key] === null || String(existing[key]).trim() === '';
            const isFilledInIncoming = incoming[key] !== undefined && incoming[key] !== null && String(incoming[key]).trim() !== '';
            if (isEmptyInExisting && isFilledInIncoming) {
                hasNewData = true;
                break;
            }
        }
        if (!hasNewData) {
            return { type: 'skip' };
        }
    }

    // Rule 3 & 4: Merge fields safely and decide on update
    const merged = mergeWithoutDataLoss(existing, incoming);

    return { type: 'update', data: merged };
}

module.exports = {
    diffCase,
    mergeWithoutDataLoss
};
