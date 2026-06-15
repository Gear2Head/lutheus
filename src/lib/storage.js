// Lutheus CezaRapor - Storage Module v2.2
// Boho integration + Pointtrain persistence layer

import { escapeHtml } from './utils.js';
import { DbRepository } from './dbRepository.js';
import { getStoredSession } from '../auth/sessionStore.js';
import { CUK_RULES } from './cukEngine.js';
import { SEEDED_ROLE_MEMBERS, normalizeRole } from '../auth/rolePolicy.js';

const LUTHEUS_GUILD_ID = '1223431616081166336';
const hasChromeLocal = () => typeof chrome !== 'undefined' && chrome.storage?.local;
const hasChromeSync = () => typeof chrome !== 'undefined' && chrome.storage?.sync;

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
        if (!key) {
            resolve(undefined);
            return;
        }
        if (!hasChromeLocal()) {
            const raw = window.localStorage.getItem(`lutheus:${key}`);
            resolve(raw ? JSON.parse(raw) : undefined);
            return;
        }
        const queryKey = Array.isArray(key) ? key : [key];
        chrome.storage.local.get(queryKey, (result) => {
            if (Array.isArray(key)) {
                resolve(result);
            } else {
                resolve(result[key]);
            }
        });
    });
}

function storageSet(key, value) {
    return new Promise((resolve) => {
        if (!hasChromeLocal()) {
            window.localStorage.setItem(`lutheus:${key}`, JSON.stringify(value));
            resolve();
            return;
        }
        chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime?.lastError) {
                console.warn(`Lutheus: chrome.storage.local write skipped for ${key}:`, chrome.runtime.lastError.message);
            }
            resolve();
        });
    });
}

function syncGet(key) {
    return new Promise((resolve) => {
        if (!hasChromeSync()) return resolve(storageGet(key));
        chrome.storage.sync.get([key], (result) => resolve(result[key]));
    });
}

function syncSet(key, value) {
    return new Promise((resolve) => {
        if (!hasChromeSync()) return resolve(storageSet(key, value));
        chrome.storage.sync.set({ [key]: value }, () => {
            if (chrome.runtime?.lastError) {
                console.warn(`Lutheus: chrome.storage.sync write skipped for ${key}:`, chrome.runtime.lastError.message);
                storageSet(key, value).then(resolve);
                return;
            }
            resolve();
        });
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

function hasBetterAvatar(nextAvatar, previousAvatar) {
    return Boolean(nextAvatar) && (!previousAvatar || String(previousAvatar).includes('/assets/icon'));
}

function isCaseIdLike(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (text.includes('_') || text.includes('-')) return false;
    if (/^\d{4,24}$/.test(text)) return true;
    if (!/^[A-Za-z0-9]{4,24}$/.test(text)) return false;
    if (/^\d{17,20}$/.test(text)) return false;
    if (/^(mute|ban|warn|kick|timeout|user|reason|author|duration|created|bilinmiyor|sunucu|discord|yetkili)$/i.test(text)) return false;
    return /[A-Za-z]/.test(text) && /\d/.test(text);
}

function isDiscordId(value) {
    return /^\d{17,20}$/.test(String(value || '').trim());
}

function isReasonLike(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (isDiscordId(text) || isCaseIdLike(text)) return false;
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(text)) return false;
    if (/^(mute|ban|warn|kick|timeout|permanent|süresiz|suresiz)$/i.test(text)) return false;
    return true;
}

function normalizeDurationMs(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return null;

    const compact = text.match(/^(\d+(?:[.,]\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|gün|gun|saat|dakika)$/i);
    if (!compact) return null;

    const amount = Number(compact[1].replace(',', '.'));
    if (!Number.isFinite(amount)) return null;

    const unit = compact[2].toLowerCase();
    const multipliers = {
        ms: 1,
        s: 1000,
        sec: 1000,
        secs: 1000,
        second: 1000,
        seconds: 1000,
        m: 60 * 1000,
        min: 60 * 1000,
        mins: 60 * 1000,
        minute: 60 * 1000,
        minutes: 60 * 1000,
        dakika: 60 * 1000,
        h: 60 * 60 * 1000,
        hr: 60 * 60 * 1000,
        hrs: 60 * 60 * 1000,
        hour: 60 * 60 * 1000,
        hours: 60 * 60 * 1000,
        saat: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        gün: 24 * 60 * 60 * 1000,
        gun: 24 * 60 * 60 * 1000
    };

    return Math.round(amount * multipliers[unit]);
}

function getDurationText(duration) {
    if (duration == null) return '';
    if (typeof duration === 'string') return duration.trim();
    if (typeof duration === 'object') {
        return String(
            duration.raw ||
            duration.normalized ||
            duration.text ||
            duration.label ||
            duration.duration ||
            ''
        ).trim();
    }
    return String(duration).trim();
}

function getReasonText(reason) {
    if (reason == null) return '';

    if (typeof reason === 'string') {
        return reason.trim();
    }

    if (typeof reason === 'object') {
        return String(
            reason.raw ||
            reason.normalized ||
            reason.text ||
            reason.label ||
            reason.category ||
            reason.reason ||
            ''
        ).trim();
    }

    return String(reason).trim();
}

function validateCaseEntry(entry = {}) {
    const id = String(entry.id || entry.caseId || '').trim();
    if (!id) return { valid: false, reason: 'missing_case_id' };
    if (!entry.userId && !entry.user && !entry.authorId && !entry.authorName) {
        return { valid: false, reason: 'missing_identity' };
    }
    const reasonText = getReasonText(entry.reason);
    if (reasonText && !isReasonLike(reasonText)) return { valid: false, reason: 'shifted_reason' };
    if (entry.userId && !isDiscordId(entry.userId)) return { valid: false, reason: 'invalid_user_id' };
    if (entry.authorId && !isDiscordId(entry.authorId)) return { valid: false, reason: 'invalid_author_id' };
    return { valid: true };
}

function buildSourceMismatch(previous, next) {
    if (!previous || previous.capturedVia === next.capturedVia) return null;
    const fields = ['userId', 'authorId', 'reason', 'type', 'duration'];
    const mismatches = fields.filter((field) => previous[field] && next[field] && String(previous[field]) !== String(next[field]));
    return mismatches.length
        ? { previousSource: previous.capturedVia, nextSource: next.capturedVia, fields: mismatches, detectedAt: new Date().toISOString() }
        : null;
}

// SECTION: CASE_NORMALIZATION
// PURPOSE: Canonical case shape and metadata-preserving merge for DOM/network records.
function normalizeCaseEntry(entry = {}, previous = null) {
    const id = String(entry.id || entry.caseId || '').trim();
    const embeddedAuthorId = String(entry.authorId || entry.moderatorId || entry.authorName || '').match(/\d{17,20}/)?.[0] || '';
    const rawAuthorId = String(entry.authorId || entry.moderatorId || embeddedAuthorId || '').trim();
    const authorId = isDiscordId(rawAuthorId) ? rawAuthorId : (previous?.authorId || '');
    const cleanedAuthorName = String(entry.authorName || entry.moderator || '').replace(authorId, '').trim();
    
    const incomingReasonObj = typeof entry.reason === 'object' && entry.reason ? entry.reason : null;
    const incomingReasonText = getReasonText(entry.reason);
    const safeReason = isReasonLike(incomingReasonText)
        ? (incomingReasonObj || incomingReasonText)
        : (previous?.reason || '');

    const duration = getDurationText(entry.duration || previous?.duration || '');
    const durationMs = Number.isFinite(Number(entry.durationMs))
        ? Number(entry.durationMs)
        : (normalizeDurationMs(duration) ?? previous?.durationMs ?? null);
    const merged = {
        ...(previous || {}),
        ...entry,
        id,
        caseId: id,
        guildId: String(entry.guildId || previous?.guildId || LUTHEUS_GUILD_ID),
        authorId,
        userId: isDiscordId(entry.userId) ? String(entry.userId).trim() : (previous?.userId || ''),
        authorName: cleanedAuthorName || previous?.authorName || (entry.authorMissing ? 'Bilinmeyen Yetkili' : 'Bilinmiyor'),
        authorMissing: Boolean(entry.authorMissing || (!authorId && (!cleanedAuthorName || cleanedAuthorName === 'Bilinmeyen Yetkili'))),
        user: entry.user || previous?.user || 'Unknown',
        reason: safeReason,
        duration,
        durationMs,
        type: entry.type || previous?.type || 'unknown',
        createdRaw: entry.createdRaw || previous?.createdRaw || '',
        sourceUrl: entry.sourceUrl || previous?.sourceUrl || '',
        capturedVia: entry.capturedVia || previous?.capturedVia || 'dom_scraper',
        rawData: entry.rawData || previous?.rawData || null,
        scrapedAt: entry.scrapedAt || Date.now(),
        lastSeen: Date.now(),
        source: entry.source || 'sapphire-dashboard'
    };
    const mismatch = buildSourceMismatch(previous, merged);
    if (mismatch) merged.sourceMismatch = mismatch;
    else if (previous?.sourceMismatch) merged.sourceMismatch = previous.sourceMismatch;

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
        const quarantinedEntries = [];
        for (const entry of newCases) {
            const id = String(entry.id || entry.caseId || '');
            const validation = validateCaseEntry(entry);
            if (!validation.valid) {
                quarantinedEntries.push({ entry, reason: validation.reason, quarantinedAt: new Date().toISOString() });
                continue;
            }
            const previous = caseMap.get(id);
            const normalized = normalizeCaseEntry(entry, previous);
            normalizedEntries.push(normalized);
            caseMap.set(id, normalized);
        }
        if (quarantinedEntries.length) await this.addQuarantinedCases(quarantinedEntries);

        const allCases = Array.from(caseMap.values()).sort(compareCases);
        await this.setCasesLocal(allCases);
        await this.setSyncCases(allCases);
        await this.updateUserRegistry(normalizedEntries);
        await this.upsertStaffDirectoryFromCases(normalizedEntries);
        // Throttle: only push to Firebase if batch is >= 1 entry (fire-and-forget)
        const actor = await getActor();
        if (actor && newCases.length > 0) {
            DbRepository.saveCases(normalizedEntries, undefined, actor).catch((error) => {
                console.warn('Lutheus: Firestore case sync failed:', error.message);
            });
        }
        return allCases.length;
    },

    async saveCases(cases) {
        if (!Array.isArray(cases)) {
            throw new TypeError('saveCases: cases must be an array');
        }
        const quarantinedEntries = [];
        const normalized = cases
            .filter((entry) => {
                const validation = validateCaseEntry(entry);
                if (validation.valid) return true;
                quarantinedEntries.push({ entry, reason: validation.reason, quarantinedAt: new Date().toISOString() });
                return false;
            })
            .map((entry) => normalizeCaseEntry(entry))
            .sort(compareCases);
        if (quarantinedEntries.length) await this.addQuarantinedCases(quarantinedEntries);
        await this.setCasesLocal(normalized);
        await this.setSyncCases(normalized);
        await this.upsertStaffDirectoryFromCases(normalized);
        const actor = await getActor();
        if (actor) {
            await DbRepository.saveCases(normalized, undefined, actor).catch((error) => {
                console.warn('Lutheus: Firestore case save failed:', error.message);
            });
        }
    },

    async updateCaseMetadata(caseId, metadata) {
        const cases = await this.getCases();
        const index = cases.findIndex((item) => item.id === caseId);
        if (index === -1) return false;
        cases[index] = { ...cases[index], ...metadata };
        await this.setCasesLocal(cases);
        await DbRepository.saveCases([cases[index]], undefined, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore case metadata save failed:', error.message);
        });
        return true;
    },

    async getCases() {
        const localCases = await this.get('cases').then((value) => (Array.isArray(value) ? value : []));
        const caseMap = new Map();
        
        // Load local entries as initial state (preserves notes, reviewStatus, assignee, overrides)
        for (const entry of localCases) {
            const id = String(entry.id || entry.caseId || '');
            if (id) caseMap.set(id, normalizeCaseEntry(entry));
        }

        try {
            const remoteCases = await DbRepository.listCases();
            if (Array.isArray(remoteCases)) {
                for (const entry of remoteCases) {
                    const id = String(entry.caseId || entry.id || '');
                    if (!id) continue;
                    const existing = caseMap.get(id);
                    if (existing) {
                        // Merge remote data into existing local data to preserve local-only metadata
                        caseMap.set(id, normalizeCaseEntry({ ...entry, ...existing, id }, existing));
                    } else {
                        caseMap.set(id, normalizeCaseEntry({ ...entry, id }));
                    }
                }
                const allCases = Array.from(caseMap.values()).sort(compareCases);
                await this.setCasesLocal(allCases);
                await this.updateUserRegistry(allCases);
                await this.upsertStaffDirectoryFromCases(allCases);
                return allCases;
            }
        } catch (error) {
            console.warn('Lutheus: Failed to fetch remote cases from Firestore, falling back to local cache:', error.message);
        }

        const allCases = Array.from(caseMap.values()).sort(compareCases);
        await this.updateUserRegistry(allCases);
        await this.upsertStaffDirectoryFromCases(allCases);
        return allCases;
    },

    async setSyncCases(cases) {
        if (!hasChromeSync()) return;

        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (all) => {
                const keys = Object.keys(all || {}).filter((key) => key.startsWith('cases_'));
                const writeMeta = () => syncSet('cases_meta', {
                    count: Array.isArray(cases) ? cases.length : 0,
                    updatedAt: new Date().toISOString()
                }).then(() => syncSet('cases_chunk_count', 0)).then(resolve);
                if (keys.length) chrome.storage.sync.remove(keys, writeMeta);
                else writeMeta();
            });
        });
    },

    async setCasesLocal(cases) {
        const compact = (cases || []).map((entry) => ({
            id: entry.id,
            caseId: entry.caseId,
            guildId: entry.guildId,
            type: entry.type,
            reason: entry.reason,
            authorId: entry.authorId,
            authorName: entry.authorName,
            authorAvatar: entry.authorAvatar,
            userId: entry.userId,
            user: entry.user,
            duration: entry.duration,
            durationMs: entry.durationMs,
            createdAt: entry.createdAt,
            createdRaw: entry.createdRaw,
            scrapedAt: entry.scrapedAt,
            updatedAt: entry.updatedAt,
            validationStatus: entry.validationStatus,
            reviewStatus: entry.reviewStatus,
            manualOverride: entry.manualOverride,
            sourceUrl: entry.sourceUrl,
            capturedVia: entry.capturedVia
        }));
        await this.set('cases', compact);
    },

    async getSyncCases() {
        if (!hasChromeSync()) return [];

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
        if (!hasChromeSync()) return;

        return new Promise((resolve) => {
            chrome.storage.sync.get(null, (all) => {
                const keys = Object.keys(all).filter((key) => key.startsWith('cases_'));
                chrome.storage.sync.remove(keys, resolve);
            });
        });
    },

    async updateUserRegistry(cases) {
        const registry = await this.getSync('userRegistry') || {};
        const roleCache = await this.getRoleCache();
        let changed = false;

        for (const entry of cases) {
            let authorId = entry.authorId || '';
            const authorName = entry.authorName || '';

            // ASSUME: If authorId is missing (fast scan), attempt resolution via exact name or alias match
            if (!authorId && authorName) {
                const normalizedSearch = authorName.trim().toLowerCase();
                const matchedId = Object.keys(registry).find((id) => {
                    const reg = registry[id];
                    return reg.name?.trim().toLowerCase() === normalizedSearch ||
                           reg.aliases?.some((alias) => alias.trim().toLowerCase() === normalizedSearch);
                });
                if (matchedId) authorId = matchedId;
            }

            if (authorId) {
                const previous = registry[authorId] || {};
                const currentName = entry.authorName || previous.name || `Unknown Moderator (${authorId})`;
                const aliases = Array.from(new Set([
                    ...(previous.aliases || []),
                    previous.name,
                    entry.authorName
                ].filter(Boolean)));
                const roleEntry = roleCache.find(r => {
                    const rcId = r.discordId || String(r.identityKey || r.id || '').replace(/^discord:/, '');
                    return rcId === authorId;
                });
                registry[authorId] = {
                    ...previous,
                    id: authorId,
                    name: currentName,
                    avatar: hasBetterAvatar(entry.authorAvatar, previous.avatar)
                        ? entry.authorAvatar
                        : (previous.avatar || entry.authorAvatar || null),
                    role: roleEntry ? normalizeRole(roleEntry.role) : (previous.role || null),
                    aliases,
                    source: previous.source || 'sapphire-admin-scan',
                    scanCount: Number(previous.scanCount || 0) + 1,
                    lastSeen: Date.now()
                };
                changed = true;
            }

            if (entry.userId) {
                const previous = registry[entry.userId] || {};
                const currentName = entry.user || previous.name || `Unknown User (${entry.userId})`;
                const roleEntry = roleCache.find(r => {
                    const rcId = r.discordId || String(r.identityKey || r.id || '').replace(/^discord:/, '');
                    return rcId === entry.userId;
                });
                registry[entry.userId] = {
                    ...previous,
                    id: entry.userId,
                    name: currentName,
                    avatar: hasBetterAvatar(entry.userAvatar, previous.avatar)
                        ? entry.userAvatar
                        : (previous.avatar || entry.userAvatar || null),
                    role: roleEntry ? normalizeRole(roleEntry.role) : (previous.role || null),
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

    async updateUserRole(id, role, manualAccuracy = null, name = null, options = {}) {
        const isActiveStaff = options.isActiveStaff !== false && normalizeRole(role) !== 'blocked';
        const registry = (await this.get('userRegistry')) || {};
        registry[id] = {
            ...(registry[id] || {}),
            id,
            name: name || registry[id]?.name || 'Bilinmiyor',
            avatar: registry[id]?.avatar || null,
            role: normalizeRole(role),
            isActiveStaff,
            formerStaff: !isActiveStaff,
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
            isActiveStaff,
            formerStaff: !isActiveStaff,
            aliases: registry[id].aliases || []
        });
        await DbRepository.setRoleCache(`discord:${id}`, {
            discordId: id,
            displayName: registry[id].name,
            role,
            manualAccuracy,
            isActiveStaff,
            removalReason: isActiveStaff ? null : 'no_longer_staff'
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
            autoValidate: false,
            autoOpenHourly: false
        };
    },

    async saveSettings(settings) {
        await this.setSync('settings', settings);
    },

    async getDynamicRules() {
        const localRules = await this.getSync('dynamicRules');
        if (localRules?.categories && Object.keys(localRules.categories).length) return localRules;

        const policy = await DbRepository.getRolePolicy().catch(() => null);
        if (policy?.dynamicRules?.categories && Object.keys(policy.dynamicRules.categories).length) {
            await this.setSync('dynamicRules', policy.dynamicRules);
            return policy.dynamicRules;
        }

        const defaults = cloneDefaultRules();
        await this.setSync('dynamicRules', defaults);
        await DbRepository.saveRolePolicy({ dynamicRules: defaults }, await getActor()).catch((error) => {
            console.warn('Lutheus: Firestore default CUK seed failed:', error.message);
        });
        return defaults;
    },

    async saveDynamicRules(rules) {
        await this.setSync('dynamicRules', rules);
        try {
            await DbRepository.saveRolePolicy({ dynamicRules: rules }, await getActor());
            return { synced: true };
        } catch (error) {
            console.warn('Lutheus: Firestore CUK policy update failed:', error.message);
            return { synced: false, error: error.message };
        }
    },

    async addScanLog(entry) {
        const logs = (await this.get('scanLogs')) || [];
        logs.unshift({ ...entry, timestamp: new Date().toISOString() });
        await this.set('scanLogs', logs.slice(0, 100));
    },

    async getScanLogs() {
        return (await this.get('scanLogs')) || [];
    },

    async addQuarantinedCases(entries) {
        const current = (await this.get('caseQuarantine')) || [];
        await this.set('caseQuarantine', [...entries, ...current].slice(0, 100));
    },

    async getQuarantinedCases() {
        return (await this.get('caseQuarantine')) || [];
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

            const reason = getReasonText(entry.reason) || 'Bilinmiyor';
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
        const directory = (await this.get('staffDirectory')) || (await this.getSync('staffDirectory')) || {};
        const roleCache = await this.getRoleCache();
        let changed = false;

        for (const member of roleCache) {
            const memberId = member.discordId || String(member.identityKey || member.id || '').replace(/^discord:/, '');
            if (!memberId) continue;
            const current = directory[memberId];
            const next = {
                discordUserId: memberId,
                sapphireAuthorId: memberId,
                displayName: member.displayName || member.name || current?.displayName || 'Yetkili',
                avatar: member.avatar || current?.avatar || null,
                role: normalizeRole(member.role),
                aliases: Array.from(new Set([...(current?.aliases || []), member.displayName || member.name].filter(Boolean))),
                source: current?.source || 'lutheus-rolecache',
                updatedAt: new Date().toISOString()
            };
            if (!current || JSON.stringify(current) !== JSON.stringify(next)) {
                directory[memberId] = next;
                changed = true;
            }
        }

        if (changed) await this.saveStaffDirectory(directory);
        return directory;
    },

    async saveStaffDirectory(directory) {
        await this.set('staffDirectory', directory || {});
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
        const registry = (await this.get('userRegistry')) || {};
        let changed = false;

        for (const entry of cases) {
            let authorId = entry.authorId || '';
            const authorName = entry.authorName || '';

            // ASSUME: Resolve missing authorId from registry via exact name or alias match
            if (!authorId && authorName) {
                const normalizedSearch = authorName.trim().toLowerCase();
                const matchedId = Object.keys(registry).find((id) => {
                    const reg = registry[id];
                    return reg.name?.trim().toLowerCase() === normalizedSearch ||
                           reg.aliases?.some((alias) => alias.trim().toLowerCase() === normalizedSearch);
                });
                if (matchedId) authorId = matchedId;
            }

            if (!authorId && !authorName) continue;

            const key = authorId || `name:${authorName}`;
            const aliases = [authorName].filter(Boolean);
            directory[key] = {
                ...(directory[key] || {}),
                sapphireAuthorId: authorId || directory[key]?.sapphireAuthorId || '',
                discordUserId: directory[key]?.discordUserId || authorId || '',
                displayName: authorName || directory[key]?.displayName || 'Bilinmiyor',
                avatar: hasBetterAvatar(entry.authorAvatar, directory[key]?.avatar)
                    ? entry.authorAvatar
                    : (directory[key]?.avatar || entry.authorAvatar || null),
                role: directory[key]?.role || 'discord_destek_ekibi',
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
        await DbRepository.saveScanRun({
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

    async getRoleCache() {
        try {
            const remoteCache = await DbRepository.listRoleCache();
            if (Array.isArray(remoteCache) && remoteCache.length) {
                await this.set('roleCache', remoteCache);
                return remoteCache;
            }
        } catch (err) {
            console.warn('Lutheus: Failed to fetch remote roleCache, falling back to local cache:', err.message);
        }
        const cached = await this.get('roleCache');
        return Array.isArray(cached) ? cached : [];
    },

    async saveRoleCache(roleCache) {
        await this.set('roleCache', roleCache);
    },

    async clear() {
        return new Promise((resolve) => {
            if (!hasChromeLocal()) {
                Object.keys(window.localStorage)
                    .filter((key) => key.startsWith('lutheus:'))
                    .forEach((key) => window.localStorage.removeItem(key));
                resolve();
                return;
            }
            chrome.storage.local.clear(() => {
                if (hasChromeSync()) {
                    chrome.storage.sync.clear(resolve);
                } else {
                    resolve();
                }
            });
        });
    }
};
