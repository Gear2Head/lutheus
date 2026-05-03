import { FirestoreRest } from './firestoreRest.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeRole, ROLES, getDefaultGroqLimit } from '../auth/rolePolicy.js';

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
        return FirestoreRest.getDocument('rolePolicy/settings').catch(() => null);
    },

    async saveRolePolicy(policy, actor = null) {
        await this.addAuditLog('role_policy_updated', policy, actor);
        return FirestoreRest.setDocument('rolePolicy/settings', {
            ...policy,
            updatedAt: new Date().toISOString()
        });
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

    dailyQuotaDocId(uid, dateKey = todayKey()) {
        return `${safeDocId(uid)}_${dateKey}`;
    }
};
