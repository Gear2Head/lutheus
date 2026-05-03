import { normalizeText } from './utils.js';

export function normalizeStaffName(value) {
    return normalizeText(value).replace(/\s+/g, '');
}

export function collectStaffEntries(cases = [], registry = {}, directory = {}) {
    const staffMap = new Map();

    for (const entry of cases) {
        const key = entry.authorId || normalizeStaffName(entry.authorName || 'unknown');
        if (!staffMap.has(key)) {
            const registryEntry = registry[entry.authorId] || {};
            const directoryEntry = directory[entry.authorId] || directory[`name:${entry.authorName}`] || {};
            staffMap.set(key, {
                id: entry.authorId || directoryEntry.discordUserId || key,
                sapphireAuthorId: entry.authorId || '',
                displayName: registryEntry.name || directoryEntry.displayName || entry.authorName || 'Bilinmiyor',
                role: registryEntry.role || directoryEntry.role || 'moderator',
                punishmentCount: 0,
                aliases: Array.from(
                    new Set([
                        entry.authorName,
                        registryEntry.name,
                        directoryEntry.displayName,
                        ...(directoryEntry.aliases || [])
                    ].filter(Boolean))
                )
            });
        }

        const current = staffMap.get(key);
        current.punishmentCount += 1;
    }

    return Array.from(staffMap.values()).sort((left, right) => right.punishmentCount - left.punishmentCount);
}

export function resolveDiscordSearchTerm(staff) {
    if (staff.searchTerm) return staff.searchTerm;
    if (staff.aliases?.length) return staff.aliases[0];
    return staff.displayName || staff.sapphireAuthorId || 'unknown';
}

export function mergeStaffDirectory(existing = {}, updates = []) {
    const merged = { ...existing };
    updates.forEach((entry) => {
        const key = entry.sapphireAuthorId || `name:${entry.displayName}`;
        merged[key] = {
            ...(merged[key] || {}),
            ...entry,
            aliases: Array.from(new Set([...(merged[key]?.aliases || []), ...(entry.aliases || [])].filter(Boolean)))
        };
    });
    return merged;
}
