import { AuthService } from '../auth/authService.js';
import { APP_CONFIG } from '../config/appConfig.js';

// SECTION: API_CLIENT
// PURPOSE: Handles secure administrative API requests with context-aware URL resolution.

function isExtensionContext() {
    return typeof chrome !== 'undefined'
        && chrome.runtime
        && typeof chrome.runtime.getURL === 'function'
        && typeof window !== 'undefined'
        && window.location?.protocol === 'chrome-extension:';
}

function getApiBaseUrl() {
    try {
        return new URL(APP_CONFIG.vercelAuthBaseUrl || 'https://lutheus.vercel.app').origin;
    } catch (_error) {
        return 'https://lutheus.vercel.app';
    }
}

function resolveApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;

    if (isExtensionContext()) {
        return `${getApiBaseUrl()}${normalized}`;
    }

    if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
        return `${window.location.origin}${normalized}`;
    }

    return `${getApiBaseUrl()}${normalized}`;
}

async function authHeaders() {
    const session = await AuthService.getSession();
    if (!session?.idToken) throw new Error('AUTH_REQUIRED');
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.idToken}`
    };
}

async function request(path, options = {}) {
    const headers = await authHeaders();
    const url = resolveApiUrl(path);

    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || `API_REQUEST_FAILED_${response.status}`);
    }

    return payload;
}

export const AdminApiClient = {
    async listGoogleAllowlist() {
        const payload = await request('/api/admin/google-allowlist');
        return payload.items || [];
    },

    async setGoogleAllowlist(email, data) {
        const payload = await request('/api/admin/google-allowlist', {
            method: 'POST',
            body: JSON.stringify({ email, ...data })
        });
        return payload.item;
    },

    async deleteGoogleAllowlist(email) {
        return request(`/api/admin/google-allowlist?email=${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
    },

    async listRoleCache() {
        const payload = await request('/api/admin/role-cache');
        return payload.items || [];
    },

    async setRoleCache(identityKey, data) {
        const payload = await request('/api/admin/role-cache', {
            method: 'POST',
            body: JSON.stringify({ identityKey, ...data })
        });
        return payload.item;
    },

    async deleteRoleCache(identityKey) {
        return request(`/api/admin/role-cache?identityKey=${encodeURIComponent(identityKey)}`, {
            method: 'DELETE'
        });
    },

    async getRolePolicy() {
        const payload = await request('/api/admin/role-policy');
        return payload.policy || {};
    },

    async saveRolePolicy(policy) {
        const payload = await request('/api/admin/role-policy', {
            method: 'PATCH',
            body: JSON.stringify({ policy })
        });
        return payload.policy || {};
    },

    async listAuditLogs() {
        const payload = await request('/api/admin/audit-logs');
        return payload.items || [];
    },

    async startSapphireScan(payload) {
        return request('/api/scan/sapphire/start', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async ingestSapphireBatch(payload) {
        return request('/api/scan/sapphire/ingest', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getSapphireScanStatus(jobId) {
        const payload = await request(`/api/scan/sapphire/status?jobId=${encodeURIComponent(jobId)}`);
        return payload.job;
    }
};
