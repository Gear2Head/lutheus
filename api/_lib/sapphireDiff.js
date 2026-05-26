// SECTION: SAPPHIRE_DIFF
// PURPOSE: Business rules for comparing incoming cases with existing Firestore documents to prevent data loss.

const IMPORTANT_FIELDS = [
    'caseId',
    'userId',
    'userName',
    'authorId',
    'authorName',
    'type',
    'reason',
    'duration',
    'createdAt',
    'sourceUrl'
];

function getCompletenessScore(item) {
    if (!item) return 0;
    let score = 0;
    for (const key of IMPORTANT_FIELDS) {
        if (item[key] && String(item[key]).trim() !== '') {
            score++;
        }
    }
    return score;
}

function mergeWithoutDataLoss(existing, incoming) {
    const result = { ...existing };

    // Fill in missing fields if present in incoming
    for (const key of IMPORTANT_FIELDS) {
        if ((result[key] === undefined || result[key] === null || String(result[key]).trim() === '') && incoming[key]) {
            result[key] = incoming[key];
        }
    }

    // Preserve optional or system fields from existing if not in incoming
    const systemFields = ['firstSeenAt', 'note', 'reviewStatus', 'manualOverride', 'assignee', 'validationStatus', 'validationReason'];
    for (const key of systemFields) {
        if (existing[key] !== undefined && incoming[key] === undefined) {
            result[key] = existing[key];
        }
    }

    if (incoming.contentHash && incoming.contentHash !== existing.contentHash) {
        result.previousHash = existing.contentHash || null;
        result.contentHash = incoming.contentHash;
        result.reason = incoming.reason || existing.reason;
        result.type = incoming.type || existing.type;
        result.duration = incoming.duration || existing.duration;
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

    const existingScore = getCompletenessScore(existing);
    const incomingScore = getCompletenessScore(incoming);

    // Rule 5: If incoming data is less complete, skip to avoid losing data
    if (incomingScore < existingScore) {
        return { type: 'skip' };
    }

    // Rule 3 & 4: Merge fields safely and decide on update
    const merged = mergeWithoutDataLoss(existing, incoming);

    return { type: 'update', data: merged };
}

module.exports = {
    diffCase
};
