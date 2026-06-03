import { AuthService } from '../auth/authService.js';
import { APP_CONFIG } from '../config/appConfig.js';

// SECTION: API_CLIENT
// PURPOSE: Handles secure administrative API requests with context-aware URL resolution,
// structured error codes, and proper credential handling for both web and extension contexts.

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

const failedUntil = new Map();
const inFlight = new Map();
const FAILURE_TTL_MS = 60_000;

async function authHeaders() {
    const session = await AuthService.getSession();
    if (!session?.idToken) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_MISSING_SESSION', status: 401 });
    }
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Authorization: `Bearer ${session.idToken}`
    };
}

/**
 * Parse the response body safely. Returns null if parsing fails.
 * Handles both JSON and non-JSON responses without crashing.
 */
async function safeParseBody(response) {
    const contentType = response.headers.get('content-type') || '';
    try {
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        // Non-JSON body (HTML error page, plain text, etc.)
        const text = await response.text();
        return text ? { _rawText: text } : null;
    } catch {
        return null;
    }
}

/**
 * Create a structured API error with code, status and body attached.
 */
function makeApiError(body, status, path) {
    const code = body?.error || `API_REQUEST_FAILED_${status}`;
    const message = body?.message || body?.error || `Admin API error (${status}) on ${path}`;
    const err = new Error(message);
    err.code = code;
    err.status = status;
    err.body = body;

    // Map HTTP status to semantic codes when no structured code in body
    if (!body?.error) {
        if (status === 401) err.code = 'AUTH_MISSING_SESSION';
        else if (status === 403) err.code = body?.error || 'AUTH_FORBIDDEN_ROLE';
        else if (status === 404) err.code = 'ADMIN_ENDPOINT_NOT_FOUND';
        else if (status >= 500) err.code = 'ADMIN_SERVER_ERROR';
    }

    return err;
}

async function request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const cacheKey = `${method}:${path}`;
    const now = Date.now();

    if ((failedUntil.get(cacheKey) || 0) > now) {
        throw Object.assign(new Error('ADMIN_API_UNAVAILABLE'), { code: 'ADMIN_API_UNAVAILABLE', status: 503 });
    }

    if (method === 'GET' && inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey);
    }

    const run = (async () => {
        const headers = await authHeaders();
        const url = resolveApiUrl(path);

        const response = await fetch(url, {
            ...options,
            // credentials:'include' ensures cookies are sent in web context (no-op in extension)
            credentials: 'include',
            headers: {
                ...headers,
                ...(options.headers || {})
            }
        });

        const body = await safeParseBody(response);

        if (!response.ok || body?.ok === false) {
            if (response.status >= 500 || response.status === 429) {
                failedUntil.set(cacheKey, Date.now() + FAILURE_TTL_MS);
            }

            const err = makeApiError(body, response.status, path);

            console.warn('[adminApiClient] Request failed', {
                path,
                method,
                status: response.status,
                code: err.code
            });

            throw err;
        }

        failedUntil.delete(cacheKey);
        return body;
    })();

    if (method !== 'GET') return run;
    inFlight.set(cacheKey, run);
    try {
        return await run;
    } finally {
        inFlight.delete(cacheKey);
    }
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

    async listStaffProfiles() {
        const payload = await request('/api/admin/staff-profiles');
        return payload.items || [];
    },

    async upsertStaffProfiles(profiles) {
        const payload = await request('/api/admin/staff-profiles', {
            method: 'POST',
            body: JSON.stringify({ profiles })
        });
        return payload.items || [];
    },

    async listStaffRoleConfig() {
        const payload = await request('/api/admin/staff-role-config');
        return payload.items || [];
    },

    async saveStaffRoleConfig(roles) {
        const payload = await request('/api/admin/staff-role-config', {
            method: 'PATCH',
            body: JSON.stringify({ roles })
        });
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
    },

    // SECTION: STAFF_ACCESS_REQUESTS
    // PURPOSE: Admin approval workflow for pending staff access requests.
    async listStaffAccessRequests() {
        const payload = await request('/api/admin/staff-access-requests');
        return payload.items || [];
    },

    async approveStaffAccess(discordId, action, role, rejectionReason) {
        return request('/api/admin/staff-access-requests', {
            method: 'PATCH',
            body: JSON.stringify({ discordId, action, role, rejectionReason })
        });
    },

    // SECTION: ANNOUNCEMENTS
    // PURPOSE: Create and publish admin announcements to Discord staff via bot DM.
    async listAnnouncements() {
        const payload = await request('/api/admin/announcements');
        return payload.items || [];
    },

    async createAnnouncement(title, body_markdown, target_roles) {
        const payload = await request('/api/admin/announcements', {
            method: 'POST',
            body: JSON.stringify({ title, body_markdown, target_roles })
        });
        return payload.item;
    },

    async publishAnnouncement(id, targetRoles) {
        return request('/api/admin/announcements', {
            method: 'PATCH',
            body: JSON.stringify({ id, action: 'publish', target_roles: targetRoles })
        });
    },

    // SECTION: DISCORD_BOT_DASHBOARD
    // PURPOSE: Control Discord bot settings, channel mappings, and trigger diagnostics/actions.
    async listDiscordBotGuilds() {
        const payload = await request('/api/admin/discord-bot-guilds');
        return payload.guilds || [];
    },

    async getDiscordBotDashboard(guildId) {
        return request(`/api/admin/discord-bot-dashboard?guildId=${encodeURIComponent(guildId)}`);
    },

    async saveDiscordBotConfig(guildId, config) {
        return request('/api/admin/discord-bot-dashboard', {
            method: 'POST',
            body: JSON.stringify({ guildId, config })
        });
    },

    async triggerDiscordBotAction(guildId, action, payload = {}) {
        return request('/api/admin/discord-bot-action', {
            method: 'POST',
            body: JSON.stringify({ guildId, action, payload })
        });
    }
};
