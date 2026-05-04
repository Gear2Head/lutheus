// Lutheus CezaRapor - Storage Module v2.2
// Boho integration + Pointtrain persistence layer

import { escapeHtml } from './utils.js';
import { FirebaseRepository } from './firebaseRepository.js';
import { getStoredSession } from '../auth/sessionStore.js';
import { CUK_RULES } from './cukEngine.js';
import { SEEDED_ROLE_MEMBERS, normalizeRole } from '../auth/rolePolicy.js';

const LUTHEUS_GUILD_ID = '1354854696874938590';

function cloneDefaultRules() {
    return JSON.parse(JSON.stringify(CUK_RULES));
}

function seededRegistryEntry(member, previous = {}) {
    const role = normalizeRole(member.role);
    return {
        ...previous,
        id: member.id,
        name: previous.name || member.name,
        avatar: previous.avatar || null,
        role,
        aliases: Array.from(new Set([...(previous.aliases || []), member.name].filter(Boolean))),
        source: previous.source || 'lutheus-seed',
        seeded: true,
        scanCount: Number(previous.scanCount || 0),
        lastSeen: previous.lastSeen || Date.now()
    };
}

export const DEFAULT_POINTTRAIN_CHANNELS = [
    { id: 'genel-sohbet', label: '💬genel-sohbet', weight: 1.0 },
    { id: 'gorsel-video-odasi', label: '📷görsel-video-odası', weight: 0.8 },
    { id: 'konu-disi', label: '💭konu-dışı', weight: 0.6 }
];

export const DEFAULT_POINT_WEIGHTS = {
    punishmentWeight: 1,
    messageWeight: 0.15,
    channelDiversityBonus: 3,
    activeDayBonus: 1.5,
    penaltyFlags: 0
};

function storageGet(key) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            const raw = window.localStorage.getItem(key);
            resolve(raw ? JSON.parse(raw) : null);
            return;
        }
        chrome.storage.local.get([key], (result) => resolve(result[key]));
    });
}

function storageSet(key, value) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            window.localStorage.setItem(key, JSON.stringify(value));
            resolve();
            return;
        }
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

function syncGet(key) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) return resolve(storageGet(key));
        chrome.storage.sync.get([key], (result) => resolve(result[key]));
    });
}

function syncSet(key, value) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) return resolve(storageSet(key, value));
        chrome.storage.sync.set({ [key]: value }, resolve);
    });
}

async function getActor() {
    const session = await getStoredSession().catch(() => null);
    return session?.profile || null;
}

function clonePointSettings(settings = {}) {
    return {
        guildId: settings.guildId || LUTHEUS_GUILD_ID,
        datePreset: settings.datePreset || 'last7',
        startDate: settings.startDate || '',
        endDate: settings.endDate || '',
        discordGuildId: settings.discordGuildId || LUTHEUS_GUILD_ID,
        channels: Array.isArray(settings.channels) && settings.channels.length
            ? settings.channels
            : DEFAULT_POINTTRAIN_CHANNELS.map((channel) => ({ ...channel }))
    };
}

function parseCaseTime(entry = {}) {
    const candidates = [entry.createdRaw, entry.createdAt, entry.scrapedAt, entry.updatedAt, entry.lastSeen];
    for (const value of candidates) {
        if (!value) continue;
        if (typeof value === 'number') return value;
        const text = String(value);
        const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        const date = dmy
            ? new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00`)
            : new Date(text);
        if (!Number.isNaN(date.getTime())) return date.getTime();
    }
    return 0;
}

function isFallbackAvatar(value) {
    const text = String(value || '');
    return !text || text.includes('/assets/icon') || text.includes('icon48.png') || text.startsWith('chrome-extension://');
}

function hasBetterAvatar(nextAvatar, previousAvatar) {
    if (!nextAvatar) return false;
    if (isFallbackAvatar(previousAvatar)) return true;
    if (isFallbackAvatar(nextAvatar)) return false;
    return String(nextAvatar) !== String(previousAvatar);
}

function normalizeCaseEntry(entry = {}, previous = null) {
    const id = String(entry.id || entry.caseId || '').trim();
    const embeddedAuthorId = String(entry.authorId || entry.moderatorId || entry.authorName || '').match(/\d{17,20}/)?.[0] || '';
    const authorId = String(entry.authorId || entry.moderatorId || previous?.authorId || embeddedAuthorId || '').trim();
    const cleanedAuthorName = String(entry.authorName || entry.moderator || '').replace(authorId, '').trim();
    const merged = {
        ...(previous || {}),
        ...entry,
        id,
        caseId: id,
        authorId,
        userId: String(entry.userId || previous?.userId || '').trim(),
        authorName: cleanedAuthorName || previous?.authorName || (entry.authorMissing ? 'Bilinmeyen Yetkili' : 'Bilinmiyor'),
        authorMissing: Boolean(entry.authorMissing || (!authorId && (!cleanedAuthorName || cleanedAuthorName === 'Bilinmeyen Yetkili'))),
        user: entry.user || previous?.user || 'Unknown',
        reason: entry.reason || previous?.reason || '',
        duration: entry.duration || previous?.duration || '',
        type: entry.type || previous?.type || 'unknown',
        createdRaw: entry.createdRaw || previous?.createdRaw || '',
        sourceUrl: entry.sourceUrl || previous?.sourceUrl || '',
        scrapedAt: entry.scrapedAt || Date.now(),
        lastSeen: Date.now(),
        source: entry.source || 'sapphire-dashboard'
    };

    merged.authorAvatar = hasBetterAvatar(entry.authorAvatar, previous?.authorAvatar)
        ? entry.authorAvatar
        : (previous?.authorAvatar || entry.authorAvatar || null);
    merged.userAvatar = hasBetterAvatar(entry.userAvatar, previous?.userAvatar)
        ? entry.userAvatar
        : (previous?.userAvatar || entry.userAvatar || null);

    if (previous) {
        merged.note = previous.note;
        merged.reviewStatus = previous.reviewStatus;
        merged.manualOverride = previous.manualOverride;
        merged.assignee = previous.assignee;
        if (!merged.validationStatus) merged.validationStatus = previous.validationStatus;
        if (!merged.validationReason) merged.validationReason = previous.validationReason;
    }

    return merged;
}

function compareCases(left, right) {
    const timeDiff = parseCaseTime(right) - parseCaseTime(left);
    if (timeDiff) return timeDiff;

    const leftId = Number(left.id || left.caseId);
    const rightId = Number(right.id || right.caseId);
    if (!Number.isNaN(leftId) && !Number.isNaN(rightId) && rightId !== leftId) {
        return rightId - leftId;
    }

    return Number(right.lastSeen || 0) - Number(left.lastSeen || 0);
}

export { escapeHtml };

export const Storage = {
    async get(key) { return storageGet(key); },
    async set(key, value) { return storageSet(key, value); },
    async getSync(key) { return syncGet(key); },
    async setSync(key, value) { return syncSet(key, value); },

    async updateCases(newCases, append = true) {
        if (!Array.isArray(newCases) || newCases.length === 0) return 0;
        let existing = [];
        if (append) {
            existing = (await this.get('cases')) || [];
        }

        const caseMap = new Map(existing.map((item) => [String(item.id || item.caseId || ''), item]));

        const normalizedEntries = [];
        for (const entry of newCases) {
            const id = String(entry.id || entry.caseId || '');
            if (!id) continue;
            const previous = caseMap.get(id);
            const normalized = normalizeCaseEntry(entry, previous);
            normalizedEntries.push(normalized);
            caseMap.set(id, normalized);
        }

        const allCases = Array.from(caseMap.values()).sort(compareCases);
        await this.set('cases', allCases);
        await this.setSyncCases(allCases);
        await this.updateUserRegistry(normalizedEntries);
        await this.upsertStaffDirectoryFromCases(normalizedEntries);
        // Throttle: only push to Firebase if batch is >= 1 entry (fire-and-forget)
        const actor = await getActor();
        if (actor && newCases.length > 0) {
            FirebaseRepository.saveCases(normalizedEntries, undefined, actor).catch((error) => {
                console.warn('Lutheus: Firestore case sync failed:', error.message);
            });
        }
        return allCases.length;
    },

    async saveCases(cases) {
        if (!Array.isArray(cases)) {
            throw new TypeError('saveCases: cases must be an array');
        }
        const normalized = cases.map((entry) => normalizeCaseEntry(entry)).sort(compareCases);
        await this.set('cases', normalized);
        await this.setSyncCases(normalized);
        await this.upsertStaffDirectoryFromCases(normalized);
        const actor = await getActor();
        if (actor) {
            await FirebaseRepository.saveCases(normalized, undefined, actor).catch((error) => {
                console.warn('Lutheus: Firestore case save failed:', error.message);
            });
        }
    },

    async updateCaseMetadata(caseId, metadata) {
        const cases = await this.getCases();
        const index = cases.findIndex((item) => item.id === caseId);
        if (index === -1) return false;
        cases[index] = { ...cases[index], ...metadata };
        await this.set('cases', cases);
        await FirebaseRepository.saveCases([cases[index]], undefined, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore case metadata save failed:', error.message);
        });
        return true;
    },

    async getCases() {
        // ASSUME: Local storage is source of truth; remote merges on top without clobbering local metadata
        const localCases = await this.get('cases').then((value) => (Array.isArray(value) ? value : []));
        const syncCases = [];

        const caseMap = new Map();
        // Local has priority
        for (const entry of localCases) {
            const id = String(entry.id || entry.caseId || '');
            if (id) caseMap.set(id, normalizeCaseEntry(entry));
        }
        // Sync layer: only fills missing fields
        for (const entry of syncCases) {
            const id = String(entry.id || entry.caseId || '');
            if (!id) continue;
            const existing = caseMap.get(id);
            caseMap.set(id, existing ? normalizeCaseEntry({ ...entry, ...existing, id }, existing) : normalizeCaseEntry({ ...entry, id }));
        }
        // Firebase: only fill missing, never overwrite local metadata (note/reviewStatus)
        const remoteCases = await FirebaseRepository.listCases().catch(() => []);
        for (const entry of remoteCases) {
            const id = String(entry.caseId || entry.id || '');
            if (!id) continue;
            const existing = caseMap.get(id);
            if (existing) {
                // Preserve local-only fields
                caseMap.set(id, normalizeCaseEntry({ ...entry, ...existing, id }, existing));
            } else {
                caseMap.set(id, normalizeCaseEntry({ ...entry, id }));
            }
        }

        return Array.from(caseMap.values()).sort(compareCases);
    },

    async setSyncCases(cases) {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;

        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (all) => {
                const keys = Object.keys(all || {}).filter((key) => key.startsWith('cases_'));
                const writeMeta = () => chrome.storage.sync.set({
                    cases_chunk_count: 0,
                    cases_meta: {
                        count: Array.isArray(cases) ? cases.length : 0,
                        updatedAt: new Date().toISOString()
                    }
                }, resolve);
                if (keys.length) chrome.storage.sync.remove(keys, writeMeta);
                else writeMeta();
            });
        });
    },

    async getSyncCases() {
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) return [];

        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (allData) => {
                const count = allData.cases_chunk_count;
                if (!count) return resolve([]);

                let json = '';
                for (let index = 0; index < count; index++) {
                    json += allData[`cases_c${index}`] || '';
                }

                try {
                    resolve(JSON.parse(json));
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    },

    async clearCases() {
        await this.set('cases', []);
        await this.set('scanLogs', []);
        await this.set('sessionSnapshot', { timestamp: Date.now(), caseCount: 0 });
        if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;

        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (all) => {
                const keys = Object.keys(all).filter((key) => key.startsWith('cases_'));
                chrome.storage.sync.remove(keys, resolve);
            });
        });
    },

    async updateUserRegistry(cases) {
        const registry = await this.getSync('userRegistry') || {};
        let changed = false;

        for (const entry of cases) {
            if (entry.authorId && entry.authorName) {
                const previous = registry[entry.authorId] || {};
                const aliases = Array.from(new Set([
                    ...(previous.aliases || []),
                    previous.name,
                    entry.authorName
                ].filter(Boolean)));
                registry[entry.authorId] = {
                    ...previous,
                    id: entry.authorId,
                    name: entry.authorName || previous.name || 'Bilinmiyor',
                    avatar: hasBetterAvatar(entry.authorAvatar, previous.avatar)
                        ? entry.authorAvatar
                        : (previous.avatar || entry.authorAvatar || null),
                    role: previous.role || 'moderator',
                    aliases,
                    source: previous.source || 'sapphire-admin-scan',
                    scanCount: Number(previous.scanCount || 0) + 1,
                    lastSeen: Date.now()
                };
                changed = true;
            }

            if (entry.userId && entry.user) {
                const previous = registry[entry.userId] || {};
                registry[entry.userId] = {
                    ...previous,
                    id: entry.userId,
                    name: entry.user || previous.name || 'Bilinmiyor',
                    avatar: hasBetterAvatar(entry.userAvatar, previous.avatar)
                        ? entry.userAvatar
                        : (previous.avatar || entry.userAvatar || null),
                    role: previous.role,
                    aliases: Array.from(new Set([...(previous.aliases || []), previous.name, entry.user].filter(Boolean))),
                    source: previous.source || 'sapphire-case-target',
                    scanCount: Number(previous.scanCount || 0) + 1,
                    lastSeen: Date.now()
                };
                changed = true;
            }
        }

        for (const member of SEEDED_ROLE_MEMBERS) {
            const previous = registry[member.id] || {};
            const next = seededRegistryEntry(member, previous);
            if (JSON.stringify(previous) !== JSON.stringify(next)) {
                registry[member.id] = next;
                changed = true;
            }
        }

        if (changed) {
            await this.set('userRegistry', registry);
            await this.seedStaffDirectory();
        }
    },

    async getUserRegistry() {
        const registry = (await this.get('userRegistry')) || {};
        let changed = false;
        for (const member of SEEDED_ROLE_MEMBERS) {
            if (!registry[member.id]) {
                registry[member.id] = seededRegistryEntry(member);
                changed = true;
            }
        }
        if (changed) await this.set('userRegistry', registry);
        return registry;
    },

    async updateUserRole(id, role, manualAccuracy = null, name = null) {
        const registry = (await this.get('userRegistry')) || {};
        registry[id] = {
            ...(registry[id] || {}),
            id,
            name: name || registry[id]?.name || 'Bilinmiyor',
            avatar: registry[id]?.avatar || null,
            role: normalizeRole(role),
            aliases: registry[id]?.aliases || [],
            manualAccuracy,
            lastSeen: Date.now()
        };
        await this.set('userRegistry', registry);
        await this.upsertStaffDirectoryEntry(id, {
            discordUserId: id,
            sapphireAuthorId: id,
            displayName: registry[id].name,
            role: normalizeRole(role),
            aliases: registry[id].aliases || []
        });
        await FirebaseRepository.setRoleCache(`discord:${id}`, {
            discordId: id,
            displayName: registry[id].name,
            role,
            manualAccuracy
        }, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore role cache update failed:', error.message);
        });
        return true;
    },

    async setUserInfo(info) {
        if (info) await this.set('activeUser', info);
    },

    async getUserInfo() {
        return (await this.get('activeUser')) || null;
    },

    async setSessionSnapshot(data) {
        await this.set('sessionSnapshot', data);
    },

    async getSessionSnapshot() {
        return (await this.get('sessionSnapshot')) || { timestamp: 0, caseCount: 0 };
    },

    async getSettings() {
        return (await this.getSync('settings')) || {
            guildId: LUTHEUS_GUILD_ID,
            autoSaveWeekly: true,
            scanDelay: 1500,
            theme: 'lutheus',
            cukEnabled: true,
            autoValidate: false
        };
    },

    async saveSettings(settings) {
        await this.setSync('settings', settings);
    },

    async getDynamicRules() {
        const localRules = await this.getSync('dynamicRules');
        if (localRules?.categories && Object.keys(localRules.categories).length) return localRules;

        const policy = await FirebaseRepository.getRolePolicy().catch(() => null);
        if (policy?.dynamicRules?.categories && Object.keys(policy.dynamicRules.categories).length) {
            await this.setSync('dynamicRules', policy.dynamicRules);
            return policy.dynamicRules;
        }

        const defaults = cloneDefaultRules();
        await this.setSync('dynamicRules', defaults);
        await FirebaseRepository.saveRolePolicy({ dynamicRules: defaults }, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore default CUK seed failed:', error.message);
        });
        return defaults;
    },

    async saveDynamicRules(rules) {
        await this.setSync('dynamicRules', rules);
        await FirebaseRepository.saveRolePolicy({ dynamicRules: rules }, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore CUK policy update failed:', error.message);
        });
    },

    async addScanLog(entry) {
        const logs = (await this.get('scanLogs')) || [];
        logs.unshift({ ...entry, timestamp: new Date().toISOString() });
        await this.set('scanLogs', logs.slice(0, 100));
    },

    async getScanLogs() {
        return (await this.get('scanLogs')) || [];
    },

    async getWeeklySnapshots() {
        return (await this.get('weeklySnapshots')) || {};
    },

    getWeekKey(date = new Date()) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    },

    async saveWeeklySnapshot(weekKey = null, data = null) {
        const key = weekKey || this.getWeekKey();
        const snapshots = await this.get('weeklySnapshots') || {};
        if (!data) {
            const cases = await this.getCases();
            data = this.calculateWeeklyStats(cases);
        }
        snapshots[key] = { ...data, savedAt: new Date().toISOString() };
        
        const sortedKeys = Object.keys(snapshots).sort().reverse();
        const trimmed = {};
        sortedKeys.slice(0, 12).forEach((snapshotKey) => {
            trimmed[snapshotKey] = snapshots[snapshotKey];
        });

        await this.set('weeklySnapshots', trimmed);
        return trimmed[key];
    },

    async getWeeklySnapshot(weekKey) {
        const snapshots = await this.get('weeklySnapshots') || {};
        return snapshots[weekKey] || null;
    },

    async getPreviousWeekSnapshot() {
        const currentWeek = this.getWeekKey();
        const snapshots = await this.get('weeklySnapshots') || {};
        const sortedKeys = Object.keys(snapshots).sort().reverse();
        const previousIndex = sortedKeys.indexOf(currentWeek);

        if (previousIndex >= 0 && previousIndex < sortedKeys.length - 1) {
            return { key: sortedKeys[previousIndex + 1], data: snapshots[sortedKeys[previousIndex + 1]] };
        }

        if (sortedKeys.length >= 2) {
            return { key: sortedKeys[1], data: snapshots[sortedKeys[1]] };
        }

        return null;
    },

    async getAllWeeklySnapshots() {
        return (await this.get('weeklySnapshots')) || {};
    },

    calculateWeeklyStats(cases) {
        const moderatorStats = {};
        const reasonStats = {};

        for (const entry of cases) {
            const moderatorKey = entry.authorName || 'Unknown';
            if (!moderatorStats[moderatorKey]) {
                moderatorStats[moderatorKey] = {
                    name: moderatorKey,
                    id: entry.authorId || '',
                    count: 0,
                    reasons: {}
                };
            }

            moderatorStats[moderatorKey].count++;

            const reason = entry.reason || 'Bilinmiyor';
            moderatorStats[moderatorKey].reasons[reason] = (moderatorStats[moderatorKey].reasons[reason] || 0) + 1;
            reasonStats[reason] = (reasonStats[reason] || 0) + 1;
        }

        const sortedModerators = Object.values(moderatorStats).sort((left, right) => right.count - left.count);
        const sortedReasons = Object.entries(reasonStats).sort((left, right) => right[1] - left[1]);

        return {
            totalCases: cases.length,
            totalModerators: Object.keys(moderatorStats).length,
            topModerator: sortedModerators[0] ? { name: sortedModerators[0].name, count: sortedModerators[0].count } : null,
            topReason: sortedReasons[0] ? { reason: sortedReasons[0][0], count: sortedReasons[0][1] } : null,
            moderatorStats,
            reasonStats
        };
    },

    async getPointtrainSettings() {
        return clonePointSettings(await this.getSync('pointtrainSettings'));
    },

    async savePointtrainSettings(settings) {
        await this.setSync('pointtrainSettings', clonePointSettings(settings));
    },

    async getPointWeights() {
        return {
            ...DEFAULT_POINT_WEIGHTS,
            ...((await this.getSync('pointWeights')) || {})
        };
    },

    async savePointWeights(weights) {
        await this.setSync('pointWeights', { ...DEFAULT_POINT_WEIGHTS, ...(weights || {}) });
    },

    async getStaffDirectory() {
        const directory = (await this.getSync('staffDirectory')) || {};
        let changed = false;
        for (const member of SEEDED_ROLE_MEMBERS) {
            if (!directory[member.id]) {
                directory[member.id] = {
                    discordUserId: member.id,
                    sapphireAuthorId: member.id,
                    displayName: member.name,
                    role: normalizeRole(member.role),
                    aliases: [member.name],
                    source: 'lutheus-seed',
                    seeded: true,
                    updatedAt: new Date().toISOString()
                };
                changed = true;
            }
        }
        if (changed) await this.saveStaffDirectory(directory);
        return directory;
    },

    async saveStaffDirectory(directory) {
        await this.setSync('staffDirectory', directory || {});
    },

    async upsertStaffDirectoryEntry(key, entry) {
        const directory = await this.getStaffDirectory();
        const current = directory[key] || {};
        directory[key] = {
            ...current,
            ...entry,
            aliases: Array.from(new Set([...(current.aliases || []), ...(entry.aliases || [])].filter(Boolean))),
            updatedAt: new Date().toISOString()
        };
        await this.saveStaffDirectory(directory);
        return directory[key];
    },

    async upsertStaffDirectoryFromCases(cases) {
        const directory = await this.getStaffDirectory();
        let changed = false;

        for (const entry of cases) {
            if (!entry.authorId && !entry.authorName) continue;
            const key = entry.authorId || `name:${entry.authorName}`;
            const aliases = [entry.authorName].filter(Boolean);
            directory[key] = {
                ...(directory[key] || {}),
                sapphireAuthorId: entry.authorId || directory[key]?.sapphireAuthorId || '',
                discordUserId: directory[key]?.discordUserId || entry.authorId || '',
                displayName: entry.authorName || directory[key]?.displayName || 'Bilinmiyor',
                avatar: hasBetterAvatar(entry.authorAvatar, directory[key]?.avatar)
                    ? entry.authorAvatar
                    : (directory[key]?.avatar || entry.authorAvatar || null),
                role: directory[key]?.role || 'moderator',
                aliases: Array.from(new Set([...(directory[key]?.aliases || []), ...aliases])),
                source: directory[key]?.source || 'sapphire-admin-scan',
                scanCount: Number(directory[key]?.scanCount || 0) + 1,
                lastSeen: Date.now(),
                updatedAt: new Date().toISOString()
            };
            changed = true;
        }

        if (changed) await this.saveStaffDirectory(directory);
        return directory;
    },

    async seedStaffDirectory() {
        const directory = await this.getStaffDirectory();
        await this.saveStaffDirectory(directory);
        return directory;
    },

    async getMessageCountCache() {
        return (await this.get('messageCountCache')) || {};
    },

    async getCachedMessageCount(cacheKey) {
        const cache = await this.getMessageCountCache();
        return cache[cacheKey] || null;
    },

    async cacheMessageCount(cacheKey, payload) {
        const cache = await this.getMessageCountCache();
        cache[cacheKey] = {
            ...payload,
            cachedAt: new Date().toISOString()
        };
        await this.set('messageCountCache', cache);
        return cache[cacheKey];
    },

    async getPointtrainRuns() {
        return (await this.get('pointtrainRuns')) || [];
    },

    async savePointtrainRun(run) {
        const runs = await this.getPointtrainRuns();
        runs.unshift(run);
        await this.set('pointtrainRuns', runs.slice(0, 30));
        await FirebaseRepository.saveScanRun({
            ...run,
            type: 'pointtrain'
        }).catch((error) => {
            console.warn('Lutheus: Firestore pointtrain save failed:', error.message);
        });
        return run;
    },

    async getLatestPointtrainRun() {
        const runs = await this.getPointtrainRuns();
        return runs[0] || null;
    },

    async clear() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            window.localStorage.clear();
            return;
        }
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => {
                if (chrome.storage.sync) {
                    chrome.storage.sync.clear(resolve);
                } else {
                    resolve();
                }
            });
        });
    }
};
