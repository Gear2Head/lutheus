// Lutheus CezaRapor - Storage Module v2.2
// Boho integration + Pointtrain persistence layer

import { escapeHtml } from './utils.js';
import { FirebaseRepository } from './firebaseRepository.js';
import { getStoredSession } from '../auth/sessionStore.js';

const LUTHEUS_GUILD_ID = '1223431616081166336';

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
        chrome.storage.local.get([key], (result) => resolve(result[key]));
    });
}

function storageSet(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

function syncGet(key) {
    return new Promise((resolve) => {
        if (!chrome.storage.sync) return resolve(storageGet(key));
        chrome.storage.sync.get([key], (result) => resolve(result[key]));
    });
}

function syncSet(key, value) {
    return new Promise((resolve) => {
        if (!chrome.storage.sync) return resolve(storageSet(key, value));
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

export { escapeHtml };

export const Storage = {
    async get(key) { return storageGet(key); },
    async set(key, value) { return storageSet(key, value); },
    async getSync(key) { return syncGet(key); },
    async setSync(key, value) { return syncSet(key, value); },

    async updateCases(newCases, append = true) {
        let existing = [];
        if (append) {
            existing = await this.get('cases') || [];
        }

        const caseMap = new Map(existing.map((item) => [item.id, item]));

        for (const entry of newCases) {
            const previous = caseMap.get(entry.id);
            if (previous) {
                entry.note = previous.note;
                entry.reviewStatus = previous.reviewStatus;
                entry.manualOverride = previous.manualOverride;
                entry.assignee = previous.assignee;
                if (!entry.validationStatus) entry.validationStatus = previous.validationStatus;
                if (!entry.validationReason) entry.validationReason = previous.validationReason;
            }
            caseMap.set(entry.id, entry);
        }

        const allCases = Array.from(caseMap.values());
        await this.set('cases', allCases);
        await this.setSyncCases(allCases);
        await this.updateUserRegistry(newCases);
        await this.upsertStaffDirectoryFromCases(newCases);
        await FirebaseRepository.saveCases(newCases, undefined, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore case sync failed:', error.message);
        });
        return allCases.length;
    },

    async saveCases(cases) {
        if (!Array.isArray(cases)) {
            throw new TypeError('saveCases: cases must be an array');
        }
        await this.set('cases', cases);
        await this.setSyncCases(cases);
        await this.upsertStaffDirectoryFromCases(cases);
        await FirebaseRepository.saveCases(cases, undefined, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore case save failed:', error.message);
        });
    },

    async updateCaseMetadata(caseId, metadata) {
        const cases = await this.getCases();
        const index = cases.findIndex((item) => item.id === caseId);
        if (index === -1) return false;
        cases[index] = { ...cases[index], ...metadata };
        await this.set('cases', cases);
        return true;
    },

    async getCases() {
        const [localCases, syncCases] = await Promise.all([
            this.get('cases').then((value) => value || []),
            this.getSyncCases()
        ]);
        const remoteCases = await FirebaseRepository.listCases().catch(() => []);

        const caseMap = new Map();
        for (const entry of localCases) caseMap.set(entry.id, entry);
        for (const entry of syncCases) {
            const existing = caseMap.get(entry.id);
            caseMap.set(entry.id, existing ? { ...existing, ...entry } : entry);
        }
        for (const entry of remoteCases) {
            const key = entry.caseId || entry.id;
            const existing = caseMap.get(key);
            caseMap.set(key, existing ? { ...existing, ...entry, id: key } : { ...entry, id: key });
        }

        return Array.from(caseMap.values()).sort((left, right) => (right.id || 0) - (left.id || 0));
    },

    async setSyncCases(cases) {
        if (!chrome.storage.sync) return;

        const syncSubset = cases.slice(0, 300);
        const json = JSON.stringify(syncSubset);
        const chunkSize = 7500;
        const chunks = [];

        for (let index = 0; index < json.length; index += chunkSize) {
            chunks.push(json.substring(index, index + chunkSize));
        }

        const syncData = { cases_chunk_count: chunks.length };
        chunks.forEach((chunk, index) => {
            syncData[`cases_c${index}`] = chunk;
        });

        return new Promise((resolve) => chrome.storage.sync.set(syncData, resolve));
    },

    async getSyncCases() {
        if (!chrome.storage.sync) return [];

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
        if (!chrome.storage.sync) return;

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
                if (!registry[entry.authorId] || (entry.authorAvatar && !registry[entry.authorId].avatar)) {
                    registry[entry.authorId] = {
                        id: entry.authorId,
                        name: entry.authorName,
                        avatar: entry.authorAvatar || registry[entry.authorId]?.avatar || null,
                        role: registry[entry.authorId]?.role || 'moderator',
                        aliases: registry[entry.authorId]?.aliases || [],
                        lastSeen: Date.now()
                    };
                    changed = true;
                }
            }

            if (entry.userId && entry.user) {
                if (!registry[entry.userId] || (entry.userAvatar && !registry[entry.userId].avatar)) {
                    registry[entry.userId] = {
                        id: entry.userId,
                        name: entry.user,
                        avatar: entry.userAvatar || registry[entry.userId]?.avatar || null,
                        lastSeen: Date.now()
                    };
                    changed = true;
                }
            }
        }

        const managementIds = ['860192567177773076', '758769576778661989'];
        for (const id of managementIds) {
            if (!registry[id]) {
                registry[id] = { id, name: 'Yönetim', role: 'admin', aliases: [], lastSeen: Date.now() };
                changed = true;
            } else if (registry[id].role !== 'admin') {
                registry[id].role = 'admin';
                changed = true;
            }
        }

        if (changed) await this.setSync('userRegistry', registry);
    },

    async getUserRegistry() {
        return (await this.getSync('userRegistry')) || {};
    },

    async updateUserRole(id, role, manualAccuracy = null, name = null) {
        const registry = (await this.getSync('userRegistry')) || {};
        registry[id] = {
            ...(registry[id] || {}),
            id,
            name: name || registry[id]?.name || 'Bilinmiyor',
            avatar: registry[id]?.avatar || null,
            role,
            aliases: registry[id]?.aliases || [],
            manualAccuracy,
            lastSeen: Date.now()
        };
        await this.setSync('userRegistry', registry);
        await this.upsertStaffDirectoryEntry(id, {
            discordUserId: id,
            sapphireAuthorId: id,
            displayName: registry[id].name,
            role,
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
        return (await this.getSync('dynamicRules')) || { categories: {}, autoInvalid: { keywords: [] } };
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

        snapshots[key] = {
            ...data,
            savedAt: new Date().toISOString()
        };

        const sortedKeys = Object.keys(snapshots).sort().reverse();
        const trimmed = {};
        sortedKeys.slice(0, 12).forEach((snapshotKey) => {
            trimmed[snapshotKey] = snapshots[snapshotKey];
        });

        await this.set('weeklySnapshots', trimmed);
        return key;
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
        return (await this.getSync('staffDirectory')) || {};
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
                role: directory[key]?.role || 'moderator',
                aliases: Array.from(new Set([...(directory[key]?.aliases || []), ...aliases])),
                updatedAt: new Date().toISOString()
            };
            changed = true;
        }

        if (changed) await this.saveStaffDirectory(directory);
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
