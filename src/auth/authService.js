import { APP_CONFIG } from '../config/appConfig.js';
import {
    clearStoredSession,
    getStoredSession,
    isSessionExpired,
    setStoredSession
} from './sessionStore.js';
import { canAccessAdmin, isOwnerIdentity, normalizeRole, ROLES } from './rolePolicy.js';
import { FirebaseRepository } from '../lib/firebaseRepository.js';

// SECTION: AUTH_SERVICE
// PURPOSE: Lightweight, dependency-free Supabase Auth and Session manager for dashboard and sidepanel.

const isExtensionRuntime = () =>
    typeof chrome !== 'undefined'
    && chrome.identity
    && typeof chrome.identity.getRedirectURL === 'function';

function getURL(path) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL(path);
    }
    return `${window.location.origin}/${path.replace(/^\/+/, '')}`;
}

function getSafeReturnTo() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('returnTo') || '/';
    try {
        const parsed = new URL(raw, window.location.origin);
        return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : '/';
    } catch (_error) {
        return '/';
    }
}

function parseHashOrQuery(url) {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    if (parsed.hash) {
        const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
        new URLSearchParams(hash).forEach((value, key) => params.set(key, value));
    }
    return params;
}

function parseJwtPayload(token) {
    try {
        const payload = String(token || '').split('.')[1];
        if (!payload) return {};
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return JSON.parse(atob(padded));
    } catch (_error) {
        return {};
    }
}

function getJwtAppRole(tokenClaims = {}) {
    const claimRole = tokenClaims.user_metadata?.custom_claims?.role
        || tokenClaims.app_metadata?.custom_claims?.role
        || tokenClaims.app_metadata?.role;
    const normalized = normalizeRole(claimRole);
    return normalized !== ROLES.PENDING ? normalized : null;
}

function extensionRedirectUrl(path) {
    return chrome.identity.getRedirectURL(path);
}

function authFlow(url) {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!redirectUrl) {
                reject(new Error('AUTH_REDIRECT_MISSING'));
                return;
            }
            resolve(redirectUrl);
        });
    });
}

function roleIdentityKeys(profile) {
    return [
        profile.discordId ? `discord:${profile.discordId}` : null,
        profile.email ? `google:${profile.email.toLowerCase()}` : null,
        profile.email ? `email:${profile.email.toLowerCase()}` : null,
        profile.uid || null
    ].filter(Boolean);
}

async function resolveRole(profile, token = null) {
    if (isOwnerIdentity(profile)) return ROLES.KURUCU;
    if (profile.provider === 'google') {
        const allow = await FirebaseRepository.getGoogleAllowlist(profile.email, token);
        if (!allow?.allowed) {
            throw new Error('GOOGLE_EMAIL_NOT_ALLOWLISTED');
        }
        return normalizeRole(allow.role || ROLES.VIEWER);
    }

    for (const key of roleIdentityKeys(profile)) {
        const cached = await FirebaseRepository.getRoleCache(key, token).catch(() => null);
        if (cached?.role) return normalizeRole(cached.role);
    }
    return ROLES.PENDING;
}

async function signInWithCustomToken(customToken, oauthProfile = {}) {
    const tokenClaims = parseJwtPayload(customToken);

    const rawAvatar = oauthProfile.avatar || null;
    const discordId = oauthProfile.discordId || oauthProfile.id || null;
    const discordAvatarUrl = rawAvatar && /^https?:\/\//i.test(rawAvatar)
        ? rawAvatar
        : (rawAvatar && discordId ? `https://cdn.discordapp.com/avatars/${discordId}/${rawAvatar}.png?size=128` : rawAvatar);

    const uid = oauthProfile.uid || (discordId ? `discord:${discordId}` : null);
    if (!uid) {
        throw new Error('USER_UID_REQUIRED');
    }

    const profile = {
        uid,
        provider: oauthProfile.provider || 'discord',
        discordId,
        username: oauthProfile.username || null,
        globalName: oauthProfile.globalName || oauthProfile.global_name || null,
        displayName: oauthProfile.globalName || oauthProfile.global_name || oauthProfile.username || uid,
        avatar: discordAvatarUrl,
        email: oauthProfile.email || null,
        status: tokenClaims.status || oauthProfile.status || 'active'
    };
    const serverRole = getJwtAppRole(tokenClaims) || oauthProfile.role || null;
    const role = isOwnerIdentity(profile)
        ? ROLES.KURUCU
        : serverRole
        ? normalizeRole(serverRole)
        : await resolveRole(profile, customToken).catch((error) => {
            if (error.message === 'GOOGLE_EMAIL_NOT_ALLOWLISTED') throw error;
            return ROLES.PENDING;
        });

    const session = {
        uid,
        provider: profile.provider,
        idToken: customToken,
        refreshToken: null,
        expiresAt: tokenClaims.exp ? (tokenClaims.exp * 1000) : (Date.now() + (7 * 24 * 60 * 60 * 1000)),
        profile: { ...profile, role, status: profile.status },
        role
    };
    await setStoredSession(session);
    try {
        await FirebaseRepository.upsertUser(session.profile);
    } catch (error) {
        console.warn("upsertUser skipped after server-issued custom token:", error);
    }
    return session;
}

async function signInWithGoogleAccessToken(accessToken) {
    const callbackEndpoint = new URL('/api/auth/google/exchange', APP_CONFIG.vercelAuthBaseUrl);
    const response = await fetch(callbackEndpoint.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || 'GOOGLE_AUTH_FAILED');
    }
    return signInWithCustomToken(payload.supabaseToken, payload.profile);
}

async function refreshSession(session) {
    // Custom Supabase JWTs do not need manual SecureToken refresh
    return session;
}

// SECTION: AUTH_SERVICE
// PURPOSE: Session guards and auth redirects shared by web and extension contexts.
function redirectToLogin(returnTo = null, reason = null) {
    const url = new URL(getURL('src/auth/login.html'));
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    if (reason) url.searchParams.set('reason', reason);
    window.location.href = url.toString();
}

export const AuthService = {
    signInWithCustomToken,
    signInWithGoogleAccessToken,

    async getSession({ refresh = true } = {}) {
        const session = await getStoredSession();
        if (!session) return null;
        if (isOwnerIdentity(session.profile)) {
            session.role = ROLES.KURUCU;
            session.profile = { ...(session.profile || {}), role: ROLES.KURUCU, status: 'active' };
        }
        if (refresh && isSessionExpired(session) && session.refreshToken) {
            return refreshSession(session).catch(async () => {
                await clearStoredSession();
                return null;
            });
        }
        return session;
    },

    async requireSession(options = {}) {
        const session = await AuthService.getSession();
        if (!session) {
            redirectToLogin(options.returnTo);
            const err = new Error('AUTH_MISSING_SESSION');
            err.code = 'AUTH_MISSING_SESSION';
            throw err;
        }
        if (!isOwnerIdentity(session.profile) && (session.profile?.status === 'blocked' || session.role === ROLES.BLOCKED)) {
            redirectToLogin(options.returnTo, 'blocked');
            const err = new Error('AUTH_BLOCKED');
            err.code = 'AUTH_BLOCKED';
            throw err;
        }
        if (options.admin && !canAccessAdmin(session.role)) {
            // Distinguish: pending (never had staff role) vs has role but insufficient
            const code = session.role === ROLES.PENDING
                ? 'AUTH_STAFF_NOT_FOUND'
                : 'AUTH_FORBIDDEN_ROLE';
            // Do NOT redirect to login — show forbidden state in place
            const err = new Error(code);
            err.code = code;
            err.message = code === 'AUTH_STAFF_NOT_FOUND'
                ? 'Bu Discord hesabının admin panel yetkisi yok.'
                : 'Bu işlem için yeterli yetkiniz yok.';
            throw err;
        }
        return session;
    },


    async loginWithDiscord() {
        if (!isExtensionRuntime()) {
            const startUrl = new URL('/api/auth/discord/start', window.location.origin);
            startUrl.searchParams.set('source', 'web');
            startUrl.searchParams.set('returnTo', getSafeReturnTo());
            window.location.href = startUrl.toString();
            return new Promise(() => {});
        }
        const redirectUri = chrome.identity.getRedirectURL();
        const clientId = APP_CONFIG.discordClientId || '1500551629768888542';
        const scopes = (APP_CONFIG.discordOAuthScopes || ['identify', 'guilds']).join(' ');

        const authUrl = new URL('https://discord.com/oauth2/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('prompt', 'consent');

        console.log('[Lutheus Auth] Discord auth URL:', authUrl.toString());

        const finalUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true
            }, (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!redirectUrl) {
                    reject(new Error('AUTH_REDIRECT_MISSING'));
                    return;
                }
                resolve(redirectUrl);
            });
        });

        console.log('[Lutheus Auth] launchWebAuthFlow final URL:', finalUrl);

        const params = parseHashOrQuery(finalUrl);
        const code = params.get('code');
        if (!code) {
            const err = params.get('error') || 'DISCORD_CODE_MISSING';
            throw new Error(err);
        }

        const callbackEndpoint = new URL('/api/auth/discord/exchange', APP_CONFIG.vercelAuthBaseUrl);

        const response = await fetch(callbackEndpoint.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                redirectUri
            })
        });
        const responseBody = await response.text();

        let payload;
        try {
            payload = JSON.parse(responseBody);
        } catch (jsonErr) {
            console.error('[Lutheus Auth] Failed to parse backend response as JSON. Raw body:', responseBody);
            throw new Error(`BACKEND_RESPONSE_PARSE_FAILED: ${responseBody}`);
        }

        if (!response.ok) {
            console.error('[Lutheus Auth] Backend token exchange error payload:', JSON.stringify(payload, null, 2));
            const err = payload.error || 'DISCORD_AUTH_FAILED';
            const stage = payload.error_stage;
            const detail = payload.detail;
            const errorMsg = stage ? `${err} (stage: ${stage}${detail ? `, detail: ${detail}` : ''})` : err;
            throw new Error(errorMsg);
        }

        const { supabaseToken, profile } = payload;
        if (!supabaseToken) {
            throw new Error('DISCORD_TOKEN_MISSING');
        }

        return signInWithCustomToken(supabaseToken, profile);
    },

    async loginWithGoogle() {
        if (!APP_CONFIG.googleClientId) {
            throw new Error('GOOGLE_CLIENT_ID_NOT_CONFIGURED');
        }
        if (!isExtensionRuntime()) {
            const startUrl = new URL('/api/auth/google/start', window.location.origin);
            startUrl.searchParams.set('returnTo', getSafeReturnTo());
            window.location.href = startUrl.toString();
            return new Promise(() => {});
        }
        const redirectUri = extensionRedirectUrl('google');
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', APP_CONFIG.googleClientId);
        url.searchParams.set('response_type', 'token');
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', 'openid email profile');
        url.searchParams.set('prompt', 'select_account');
        const redirectUrl = await authFlow(url.toString());
        const params = parseHashOrQuery(redirectUrl);
        const accessToken = params.get('access_token');
        if (!accessToken) throw new Error(params.get('error') || 'GOOGLE_ACCESS_TOKEN_MISSING');
        return signInWithGoogleAccessToken(accessToken);
    },

    async logout() {
        await clearStoredSession();
    },

    redirectToLogin,

    getPostLoginUrl(session) {
        if (canAccessAdmin(session?.role)) {
            if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return `${window.location.origin}/dashboard`;
            return getURL('src/dashboard-v2/dist/index.html');
        }
        if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return `${window.location.origin}/dashboard`;
        return getURL('src/dashboard-v2/dist/index.html');
    }
};
