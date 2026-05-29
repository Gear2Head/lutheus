import { SupabaseRest as FirestoreRest } from './supabaseRest.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeRole, ROLES, getDefaultGroqLimit, getDefaultRolePolicy, SEEDED_ROLE_MEMBERS, SEEDED_GOOGLE_ALLOWLIST } from '../auth/rolePolicy.js';
import { AdminApiClient } from './adminApiClient.js';

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function caseDocId(entry, guildId = APP_CONFIG.guildId) {
    return `${guildId}_${String(entry.id || entry.caseId || Date.now()).replace(/[^\w-]/g, '_')}`;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function isRemoteKeyError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('no suitable key') || message.includes('wrong key type') || message.includes('401') || message.includes('unauthorized');
}

// Legacy repository wrapper; currently backed by Supabase REST, not Firebase.
export const FirebaseRepository = {
    async getUser(uid) {
        if (!uid) return null;
        return null;
    },

    async upsertUser(profile) {
        const uid = profile.uid;
        if (!uid) throw new Error('USER_UID_REQUIRED');
        const previous = await this.getUser(uid).catch(() => null);
        const role = normalizeRole(profile.role || previous?.role || ROLES.PENDING);
        const status = profile.status || previous?.status || 'active';

        try {
            return { ...(previous || {}), ...profile, uid, role, status };
        } catch (error) {
            if (isRemoteKeyError(error)) return { ...profile, role, status };
            console.error('[Lutheus Auth] upsertUser failed:', error);
            const msg = String(error.message || '').toUpperCase();
            if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('FORBIDDEN')) {
                throw new Error('USER_UPSERT_FORBIDDEN');
            }
            throw error;
        }
    },

    async getRoleCache(identityKey, token = null) {
        if (!identityKey) return null;
        return null;
    },

    async setRoleCache(identityKey, data, actor = null) {
        try {
            return await AdminApiClient.setRoleCache(identityKey, data);
        } catch (_) {
            return null;
        }
    },

    async getGoogleAllowlist(email, token = null) {
        if (!email) return null;
        return null;
    },

    async setGoogleAllowlist(email, data, actor = null) {
        try {
            return await AdminApiClient.setGoogleAllowlist(email, data);
        } catch (_) {
            return null;
        }
    },

    async listGoogleAllowlist() {
        try {
            return await AdminApiClient.listGoogleAllowlist();
        } catch (_) {
            return [];
        }
    },

    async listUsers() {
        return [];
    },

    async listUserRegistry() {
        try {
            return await AdminApiClient.listStaffProfiles();
        } catch (_) {
            return [];
        }
    },

    async listRoleCache() {
        try {
            const rows = await AdminApiClient.listRoleCache();
            return rows.length ? rows : SEEDED_ROLE_MEMBERS.map((member) => ({
                id: `discord:${member.id}`,
                identityKey: `discord:${member.id}`,
                discordId: member.id,
                displayName: member.name,
                role: normalizeRole(member.role),
                isActiveStaff: true,
                source: 'lutheus-seed'
            }));
        } catch (_) {
            return SEEDED_ROLE_MEMBERS.map((member) => ({
                id: `discord:${member.id}`,
                identityKey: `discord:${member.id}`,
                discordId: member.id,
                displayName: member.name,
                role: normalizeRole(member.role),
                isActiveStaff: true,
                source: 'lutheus-seed'
            }));
        }
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
            saved.push(normalized);
        }
        if (saved.length) {
            await AdminApiClient.ingestSapphireBatch({
                jobId: generateUUID(),
                guildId,
                source: 'dashboard-storage',
                items: saved,
                finished: true
            }).catch(() => null);
            await this.addAuditLog('cases_upserted', { guildId, count: saved.length }, actor).catch(() => null);
            await this.saveUserProfilesFromCases(cases, actor).catch((error) => {
                console.warn('Lutheus: Failed to persist scan profile avatars:', error.message);
            });
        }
        return saved;
    },

    // SECTION: FIRESTORE_SYNC
    // PURPOSE: Sapphire taramasında görülen Discord avatar linklerini DB'ye kalıcı yazar.
    async saveUserProfilesFromCases(cases, actor = null) {
        const profiles = new Map();
        const collect = (id, name, avatar, source) => {
            const discordId = String(id || '').trim();
            if (!/^\d{17,20}$/.test(discordId)) return;
            const previous = profiles.get(discordId) || {};
            profiles.set(discordId, {
                ...previous,
                id: discordId,
                discordId,
                identityKey: `discord:${discordId}`,
                name: name || previous.name || 'Bilinmiyor',
                displayName: name || previous.displayName || previous.name || 'Bilinmiyor',
                avatar: avatar || previous.avatar || null,
                source: previous.source || source,
                updatedAt: new Date().toISOString(),
                lastSeen: Date.now()
            });
        };

        for (const entry of cases || []) {
            collect(entry.authorId, entry.authorName, entry.authorAvatar, 'sapphire-issuer');
            collect(entry.userId, entry.user, entry.userAvatar, 'sapphire-target');
        }

        if (!profiles.size) return [];

        const roleCache = await this.listRoleCache().catch(() => []);
        const roleByDiscordId = new Map(roleCache.map((entry) => [
            entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, ''),
            entry
        ]));

        const writes = [];
        const profileWrites = [];
        for (const profile of profiles.values()) {
            profileWrites.push(profile);
            const roleEntry = roleByDiscordId.get(profile.discordId);
            if (roleEntry?.identityKey && profile.avatar) {
                writes.push(
                    AdminApiClient.setRoleCache(roleEntry.identityKey, {
                        ...roleEntry,
                        avatar: profile.avatar,
                        displayName: roleEntry.displayName || profile.displayName,
                        avatarUpdatedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }).catch(() => null)
                );
            }
        }

        if (profileWrites.length) {
            writes.push(AdminApiClient.upsertStaffProfiles(profileWrites).catch(() => null));
        }
        const result = await Promise.all(writes);
        await this.addAuditLog('profile_avatars_synced', { count: profiles.size }, actor).catch(() => null);
        return result;
    },

    async listCases() {
        try {
            return await FirestoreRest.listDocuments('cases', { orderBy: 'createdAt desc', pageSize: 500 });
        } catch (error) {
            const prefix = isRemoteKeyError(error)
                ? 'Lutheus: Failed to list cases due to Supabase auth key mismatch'
                : 'Lutheus: Failed to list cases';
            console.warn(`${prefix}:`, error.message);
            window.LutheusCasesSyncError = error.message; // Propagate warning globally
            return [];
        }
    },

    async saveScanRun(run) {
        const id = run.id || `scan_${Date.now()}`;
        return {
            ...run,
            id,
            updatedAt: new Date().toISOString()
        };
    },

    async saveAnalysis(caseKey, analysis) {
        return null;
    },

    async getRolePolicy() {
        try {
            return await AdminApiClient.getRolePolicy();
        } catch (_) {
            return getDefaultRolePolicy();
        }
    },

    async ensureRolePolicy(_actor = null) {
        try {
            const existing = await AdminApiClient.getRolePolicy();
            if (existing && Object.keys(existing).length > 0) {
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
        } catch (_) {
            return getDefaultRolePolicy();
        }
        return getDefaultRolePolicy();
    },

    async seedRoleCacheMembers(actor = null) {
        const existing = await this.listRoleCache().catch(() => []);
        const existingIds = new Set(existing.map((entry) => entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '')));
        const writes = [];
        for (const member of SEEDED_ROLE_MEMBERS) {
            if (existingIds.has(member.id)) continue;
            writes.push(AdminApiClient.setRoleCache(`discord:${member.id}`, {
                identityKey: `discord:${member.id}`,
                discordId: member.id,
                displayName: member.name,
                role: normalizeRole(member.role),
                source: 'lutheus-seed',
                updatedBy: actor?.uid || actor?.email || 'system',
                updatedAt: new Date().toISOString()
            }).catch(() => null));
        }
        const result = await Promise.all(writes);
        if (result.length) await this.addAuditLog('role_cache_seeded', { count: result.length }, actor).catch(() => null);
        return result;
    },

    async saveRolePolicy(policy, actor = null) {
        return AdminApiClient.saveRolePolicy(policy).catch(() => null);
    },

    async getGroqLimit(role) {
        const policy = await this.getRolePolicy();
        const normalized = normalizeRole(role);
        return Number(policy?.groqLimits?.[normalized] ?? getDefaultGroqLimit(normalized));
    },

    async addAuditLog(action, details = {}, actor = null) {
        return null;
    },

    async listAuditLogs() {
        return AdminApiClient.listAuditLogs().catch(() => []);
    },

    async deleteGoogleAllowlist(email, actor = null) {
        try {
            return await AdminApiClient.deleteGoogleAllowlist(email);
        } catch (_) {
            return { deleted: false };
        }
    },

    async deleteRoleCache(identityKey, actor = null) {
        try {
            return await AdminApiClient.deleteRoleCache(identityKey);
        } catch (_) {
            return { deleted: false };
        }
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
        if (result.length) await this.addAuditLog('google_allowlist_seeded', { count: result.length }, actor).catch(() => null);
        return result;
    },

    dailyQuotaDocId(uid, dateKey = todayKey()) {
        return `${safeDocId(uid)}_${dateKey}`;
    }
};
