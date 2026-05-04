import { FirestoreRest } from './firestoreRest.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeRole, ROLES, getDefaultGroqLimit, getDefaultRolePolicy, SEEDED_ROLE_MEMBERS, SEEDED_GOOGLE_ALLOWLIST } from '../auth/rolePolicy.js';

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function caseDocId(entry, guildId = APP_CONFIG.guildId) {
    return `${guildId}_${String(entry.id || entry.caseId || Date.now()).replace(/[^\w-]/g, '_')}`;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

export const FirebaseRepository = {
    async getUser(uid) {
        if (!uid) return null;
        return FirestoreRest.getDocument(`users/${safeDocId(uid)}`);
    },

    async upsertUser(profile) {
        const uid = profile.uid;
        if (!uid) throw new Error('USER_UID_REQUIRED');
        const previous = await this.getUser(uid).catch(() => null);
        const role = normalizeRole(profile.role || previous?.role || ROLES.MODERATOR);
        const status = profile.status || previous?.status || 'active';
        return FirestoreRest.setDocument(`users/${safeDocId(uid)}`, {
            ...(previous || {}),
            ...profile,
            uid,
            role,
            status,
            lastLogin: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    },

    async getRoleCache(identityKey, token = null) {
        if (!identityKey) return null;
        return FirestoreRest.getDocument(`roleCache/${safeDocId(identityKey)}`, token);
    },

    async setRoleCache(identityKey, data, actor = null) {
        const role = normalizeRole(data.role);
        const payload = {
            identityKey,
            ...data,
            role,
            updatedBy: actor?.uid || actor?.email || 'system',
            updatedAt: new Date().toISOString()
        };
        await this.addAuditLog('role_cache_updated', payload, actor);
        return FirestoreRest.setDocument(`roleCache/${safeDocId(identityKey)}`, payload);
    },

    async getGoogleAllowlist(email, token = null) {
        if (!email) return null;
        return FirestoreRest.getDocument(`googleAllowlist/${safeDocId(email)}`, token);
    },

    async setGoogleAllowlist(email, data, actor = null) {
        const payload = {
            email: String(email || '').trim().toLowerCase(),
            allowed: data.allowed !== false,
            role: normalizeRole(data.role || ROLES.VIEWER),
            note: data.note || '',
            expiresAt: data.expiresAt || null,
            updatedBy: actor?.uid || actor?.email || 'system',
            updatedAt: new Date().toISOString()
        };
        await this.addAuditLog('google_allowlist_updated', payload, actor);
        return FirestoreRest.setDocument(`googleAllowlist/${safeDocId(email)}`, payload);
    },

    async listGoogleAllowlist() {
        return FirestoreRest.listDocuments('googleAllowlist', { pageSize: 100 });
    },

    async listUsers() {
        return FirestoreRest.listDocuments('users', { pageSize: 200 });
    },

    async listRoleCache() {
        return FirestoreRest.listDocuments('roleCache', { pageSize: 200 });
    },

    async saveCases(cases, guildId = APP_CONFIG.guildId, actor = null) {
        const saved = [];
        for (const entry of cases || []) {
            const id = caseDocId(entry, guildId);
            const normalized = {
                ...entry,
                caseKey: id,
                guildId,
                caseId: String(entry.id || entry.caseId || ''),
                updatedAt: new Date().toISOString(),
                source: 'sapphire'
            };
            saved.push(await FirestoreRest.setDocument(`cases/${id}`, normalized));
        }
        if (saved.length) {
            await this.addAuditLog('cases_upserted', { guildId, count: saved.length }, actor);
        }
        return saved;
    },

    async listCases() {
        return FirestoreRest.listDocuments('cases', { pageSize: 500, orderBy: 'updatedAt desc' });
    },

    async saveScanRun(run) {
        const id = run.id || `scan_${Date.now()}`;
        return FirestoreRest.setDocument(`scanRuns/${id}`, {
            ...run,
            id,
            updatedAt: new Date().toISOString()
        });
    },

    async saveAnalysis(caseKey, analysis) {
        return FirestoreRest.setDocument(`analysis/${safeDocId(caseKey)}`, {
            ...analysis,
            caseKey,
            updatedAt: new Date().toISOString()
        });
    },

    async getRolePolicy() {
        const policy = await FirestoreRest.getDocument('rolePolicy/settings').catch(() => null);
        return policy || getDefaultRolePolicy();
    },

    async ensureRolePolicy(actor = null) {
        const existing = await FirestoreRest.getDocument('rolePolicy/settings').catch(() => null);
        if (existing) {
            const defaults = getDefaultRolePolicy();
            return {
                ...defaults,
                ...existing,
                roleHierarchy: existing.roleHierarchy || defaults.roleHierarchy,
                roleLabels: { ...defaults.roleLabels, ...(existing.roleLabels || {}) },
                roleColors: { ...defaults.roleColors, ...(existing.roleColors || {}) },
                seededRoleMembers: existing.seededRoleMembers || defaults.seededRoleMembers,
                groqLimits: { ...defaults.groqLimits, ...(existing.groqLimits || {}) }
            };
        }
        const created = getDefaultRolePolicy();
        await this.addAuditLog('role_policy_seeded', { version: created.version }, actor);
        return FirestoreRest.setDocument('rolePolicy/settings', created);
    },

    async seedRoleCacheMembers(actor = null) {
        const existing = await this.listRoleCache().catch(() => []);
        const existingIds = new Set(existing.map((entry) => entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '')));
        const writes = [];
        for (const member of SEEDED_ROLE_MEMBERS) {
            if (existingIds.has(member.id)) continue;
            writes.push(FirestoreRest.setDocument(`roleCache/${safeDocId(`discord:${member.id}`)}`, {
                identityKey: `discord:${member.id}`,
                discordId: member.id,
                displayName: member.name,
                role: normalizeRole(member.role),
                source: 'lutheus-seed',
                updatedBy: actor?.uid || actor?.email || 'system',
                updatedAt: new Date().toISOString()
            }));
        }
        const result = await Promise.all(writes);
        if (result.length) await this.addAuditLog('role_cache_seeded', { count: result.length }, actor);
        return result;
    },

    async saveRolePolicy(policy, actor = null) {
        const current = await this.getRolePolicy().catch(() => getDefaultRolePolicy());
        await this.addAuditLog('role_policy_updated', policy, actor);
        return FirestoreRest.setDocument('rolePolicy/settings', {
            ...(current || {}),
            ...policy,
            updatedAt: new Date().toISOString()
        });
    },

    async getBotSettings() {
        return FirestoreRest.getDocument('botSettings/main').catch(() => null);
    },

    async saveBotSettings(settings, actor = null) {
        const current = await this.getBotSettings().catch(() => ({}));
        const payload = {
            ...(current || {}),
            ...(settings || {}),
            updatedBy: actor?.uid || actor?.email || 'system',
            updatedAt: new Date().toISOString()
        };
        await this.addAuditLog('bot_settings_updated', payload, actor);
        return FirestoreRest.setDocument('botSettings/main', payload);
    },

    async getGroqLimit(role) {
        const policy = await this.getRolePolicy();
        const normalized = normalizeRole(role);
        return Number(policy?.groqLimits?.[normalized] ?? getDefaultGroqLimit(normalized));
    },

    async addAuditLog(action, details = {}, actor = null) {
        return FirestoreRest.createDocument('auditLogs', {
            action,
            details,
            actorUid: actor?.uid || null,
            actorRole: actor?.role || null,
            createdAt: new Date().toISOString()
        }).catch(() => null);
    },

    async listAuditLogs() {
        return FirestoreRest.listDocuments('auditLogs', { pageSize: 100, orderBy: 'createdAt desc' });
    },

    async deleteGoogleAllowlist(email, actor = null) {
        await this.addAuditLog('google_allowlist_deleted', { email }, actor);
        return FirestoreRest.deleteDocument(`googleAllowlist/${safeDocId(email)}`);
    },

    async deleteRoleCache(identityKey, actor = null) {
        await this.addAuditLog('role_cache_deleted', { identityKey }, actor);
        return FirestoreRest.deleteDocument(`roleCache/${safeDocId(identityKey)}`);
    },

    async seedGoogleAllowlist(actor = null) {
        const existing = await this.listGoogleAllowlist().catch(() => []);
        const existingEmails = new Set(existing.map((entry) => String(entry.email || entry.id || '').toLowerCase()));
        const writes = [];
        for (const member of SEEDED_GOOGLE_ALLOWLIST) {
            if (existingEmails.has(member.email.toLowerCase())) continue;
            writes.push(this.setGoogleAllowlist(member.email, {
                role: member.role,
                allowed: true,
                note: member.note
            }, actor));
        }
        const result = await Promise.all(writes);
        if (result.length) await this.addAuditLog('google_allowlist_seeded', { count: result.length }, actor);
        return result;
    },

    dailyQuotaDocId(uid, dateKey = todayKey()) {
        return `${safeDocId(uid)}_${dateKey}`;
    }
};
