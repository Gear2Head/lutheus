// FILE: src/content/network_listener.js
// WORLD: ISOLATED
// PURPOSE: Receive intercepted payloads from interceptor.js and forward to service worker.
// LUTHEUS v3 - Network Interception Layer
/* eslint-disable no-console */

(function () {
    'use strict';

    const seenIds = new Set();
    const MAX_SEEN = 500;

    // ASSUME: Hydrating seenKeys from local storage asynchronously at startup to prevent double interception after page reloads
    chrome.storage.local.get(['lutheus_seen_keys'], (result) => {
        if (Array.isArray(result.lutheus_seen_keys)) {
            for (const key of result.lutheus_seen_keys) {
                seenIds.add(key);
            }
        }
    });

    function firstValue(...values) {
        for (const value of values) {
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return null;
    }

    function pick(obj, paths) {
        for (const path of paths) {
            const value = path.split('.').reduce((current, key) => current?.[key], obj);
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return null;
    }

    function extractItems(rawData) {
        if (Array.isArray(rawData)) return rawData;
        if (!rawData || typeof rawData !== 'object') return [];

        const candidatePaths = [
            'data.records',
            'data.results',
            'data.cases',
            'data.items',
            'data.punishments',
            'data.infractions',
            'data.modlogs',
            'data',
            'items',
            'cases',
            'punishments',
            'infractions',
            'modlogs',
            'results',
            'records'
        ];

        for (const path of candidatePaths) {
            const value = pick(rawData, [path]);
            if (Array.isArray(value)) return value;
        }

        return [rawData];
    }

    function normalizeUserName(user) {
        if (!user || typeof user !== 'object') return null;
        return firstValue(
            user.username,
            user.globalName,
            user.global_name,
            user.displayName,
            user.display_name,
            user.tag,
            user.name
        );
    }

    function normalizePayload(url, rawData) {
        const items = extractItems(rawData);

        return items
            .map((item) => {
                const caseObj = item.case && typeof item.case === 'object' ? item.case : item;
                const punishment = item.punishment && typeof item.punishment === 'object' ? item.punishment : {};
                const target = firstValue(item.target, item.targetUser, item.target_user, item.member, item.user, item.userObj, punishment.target, punishment.targetUser, punishment.member, punishment.user);
                const moderator = firstValue(item.moderator, item.executor, item.author, item.staff, item.mod, punishment.moderator, punishment.executor, punishment.author, punishment.staff);
                const targetObj = (target && typeof target === 'object') ? target : {};
                const moderatorObj = (moderator && typeof moderator === 'object') ? moderator : {};
                const id = firstValue(
                    caseObj.id,
                    caseObj._id,
                    caseObj.caseId,
                    caseObj.case_id,
                    caseObj.caseNumber,
                    caseObj.case_number,
                    punishment.id,
                    punishment.caseId,
                    punishment.case_id,
                    item.id,
                    item.caseId,
                    item.case_id,
                    item.caseNumber,
                    item.case_number
                );

                return {
                    id,
                    caseId: id,
                    userId: firstValue(
                        item.userId,
                        item.user_id,
                        item.targetId,
                        item.target_id,
                        targetObj.id,
                        targetObj.userId,
                        targetObj.user_id,
                        targetObj.discordId,
                        targetObj.discord_id,
                        punishment.userId,
                        punishment.user_id,
                        punishment.targetId,
                        punishment.target_id
                    ),
                    username: firstValue(item.username, item.userName, item.user_name, item.targetName, item.target_name, item.tag, normalizeUserName(targetObj)),
                    moderatorId: firstValue(
                        item.moderatorId,
                        item.moderator_id,
                        item.executorId,
                        item.executor_id,
                        item.authorId,
                        item.author_id,
                        moderatorObj.id,
                        moderatorObj.userId,
                        moderatorObj.user_id,
                        moderatorObj.discordId,
                        moderatorObj.discord_id,
                        punishment.moderatorId,
                        punishment.moderator_id,
                        punishment.executorId,
                        punishment.executor_id,
                        punishment.authorId,
                        punishment.author_id
                    ),
                    moderator: firstValue(
                        item.moderatorUsername,
                        item.moderatorName,
                        item.moderator_name,
                        item.executorUsername,
                        item.executorName,
                        item.executor_name,
                        item.authorName,
                        item.author_name,
                        normalizeUserName(moderatorObj)
                    ),
                    type: firstValue(item.type, item.action, item.punishmentType, item.punishment_type, punishment.type, punishment.action),
                    reason: firstValue(item.reason, item.notes, item.note, item.description, item.comment, punishment.reason, punishment.notes, punishment.note, punishment.description),
                    duration: firstValue(item.duration, item.length, item.expiresAt, item.expires_at, item.expires, punishment.duration, punishment.length, punishment.expiresAt, punishment.expires_at),
                    createdAt: firstValue(item.createdAt, item.created_at, item.timestamp, item.date, item.updatedAt, item.updated_at, punishment.createdAt, punishment.created_at),
                    guildId: firstValue(item.guildId, item.guild_id, item.guild?.id, caseObj.guildId, caseObj.guild_id, punishment.guildId, punishment.guild_id),
                    sourceUrl: url,
                    rawData: item
                };
            })
            .filter(r => r.id !== null || r.userId !== null);
    }

    function deduplicate(records) {
        const fresh = [];
        let changed = false;
        for (const r of records) {
            const normalizedDate = new Date(r.createdAt).getTime();
            const key = `${r.id}:${r.userId}:${r.type}:${normalizedDate}`;
            if (seenIds.has(key)) continue;
            if (seenIds.size >= MAX_SEEN) {
                const first = seenIds.values().next().value;
                seenIds.delete(first);
            }
            seenIds.add(key);
            fresh.push(r);
            changed = true;
        }
        if (changed) {
            chrome.storage.local.set({ lutheus_seen_keys: Array.from(seenIds) }).catch(() => {});
        }
        return fresh;
    }

    window.addEventListener('message', (event) => {
        try {
            if (event.source !== window) return;
            if (event.data?.source !== 'LUTHEUS_INTERCEPTOR') return;
            if (event.data?.type !== 'NETWORK_PAYLOAD') return;
            if (typeof event.data.payload !== 'object' || event.data.payload === null) return;

            const { url, payload } = event.data;
            const normalized = normalizePayload(url, payload);
            const records = deduplicate(normalized);
            if (!records.length) return;

            console.debug('[Lutheus Listener] Captured', records.length, 'records from', url);

            chrome.runtime.sendMessage({
                action: 'INTERCEPTED_PUNISHMENTS',
                records,
                sourceUrl: url,
                capturedAt: Date.now()
            }).catch(() => {});
        } catch (err) {
            console.debug('[Lutheus Listener] error:', err);
        }
    });
})();
