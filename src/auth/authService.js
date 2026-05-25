import { APP_CONFIG, FIREBASE_CONFIG } from '../config/appConfig.js';
import {
    clearStoredSession,
    getStoredSession,
    isSessionExpired,
    setStoredSession
} from './sessionStore.js';
import { canAccessAdmin, normalizeRole, ROLES } from './rolePolicy.js';
import { FirebaseRepository } from '../lib/firebaseRepository.js';

const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

function authEndpoint(path) {
    return `${IDENTITY_TOOLKIT_BASE}/${path}?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
}

async function postJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error?.message || `AUTH_REQUEST_FAILED_${response.status}`);
    }
    return payload;
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
    const payload = await postJson(authEndpoint('accounts:signInWithCustomToken'), {
        token: customToken,
        returnSecureToken: true
    });

    const rawAvatar = oauthProfile.avatar || null;
    const discordId = oauthProfile.discordId || oauthProfile.id || null;
    const discordAvatarUrl = rawAvatar && /^https?:\/\//i.test(rawAvatar)
        ? rawAvatar
        : (rawAvatar && discordId ? `https://cdn.discordapp.com/avatars/${discordId}/${rawAvatar}.png?size=128` : rawAvatar);

    const profile = {
        uid: payload.localId,
        provider: oauthProfile.provider || 'discord',
        discordId,
        username: oauthProfile.username || null,
        globalName: oauthProfile.globalName || oauthProfile.global_name || null,
        displayName: oauthProfile.globalName || oauthProfile.global_name || oauthProfile.username || payload.localId,
        avatar: discordAvatarUrl,
        email: oauthProfile.email || null
    };
    const role = await resolveRole(profile, payload.idToken).catch((error) => {
        if (error.message === 'GOOGLE_EMAIL_NOT_ALLOWLISTED') throw error;
        return ROLES.PENDING;
    });

    const session = {
        uid: payload.localId,
        provider: profile.provider,
        idToken: payload.idToken,
        refreshToken: payload.refreshToken,
        expiresAt: Date.now() + (Number(payload.expiresIn || 3600) * 1000),
        profile: { ...profile, role, status: 'active' },
        role
    };
    await setStoredSession(session);
    try {
        await FirebaseRepository.upsertUser(session.profile);
    } catch (error) {
        console.error("upsertUser failed during custom token sign-in:", error);
        throw error;
    }
    return session;
}

async function signInWithGoogleAccessToken(accessToken) {
    const payload = await postJson(authEndpoint('accounts:signInWithIdp'), {
        postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
        requestUri: extensionRedirectUrl('google'),
        returnIdpCredential: true,
        returnSecureToken: true
    });

    const profile = {
        uid: payload.localId,
        provider: 'google',
        email: payload.email?.toLowerCase() || '',
        displayName: payload.displayName || payload.email || 'Google User',
        avatar: payload.photoUrl || null
    };
    const provisionalSession = {
        uid: payload.localId,
        provider: 'google',
        idToken: payload.idToken,
        refreshToken: payload.refreshToken,
        expiresAt: Date.now() + (Number(payload.expiresIn || 3600) * 1000),
        profile: { ...profile, role: ROLES.PENDING, status: 'pending' },
        role: ROLES.PENDING
    };
    await setStoredSession(provisionalSession);

    let role;
    try {
        role = await resolveRole(profile, payload.idToken);
    } catch (error) {
        await clearStoredSession();
        throw error;
    }

    const session = {
        ...provisionalSession,
        profile: { ...profile, role, status: 'active' },
        role
    };
    await setStoredSession(session);
    try {
        await FirebaseRepository.upsertUser(session.profile);
    } catch (error) {
        console.error("upsertUser failed during Google sign-in:", error);
        throw error;
    }
    return session;
}

async function refreshSession(session) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken
        })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || 'TOKEN_REFRESH_FAILED');

    const next = {
        ...session,
        idToken: payload.id_token,
        refreshToken: payload.refresh_token || session.refreshToken,
        expiresAt: Date.now() + (Number(payload.expires_in || 3600) * 1000)
    };
    await setStoredSession(next);
    return next;
}

export const AuthService = {
    async getSession({ refresh = true } = {}) {
        const session = await getStoredSession();
        if (!session) return null;
        if (refresh && isSessionExpired(session) && session.refreshToken) {
            return refreshSession(session).catch(async () => {
                await clearStoredSession();
                return null;
            });
        }
        return session;
    },

    async requireSession(options = {}) {
        const session = await this.getSession();
        if (!session) {
            this.redirectToLogin(options.returnTo);
            throw new Error('AUTH_REQUIRED');
        }
        if (session.profile?.status === 'blocked' || session.role === ROLES.BLOCKED) {
            this.redirectToLogin(options.returnTo, 'blocked');
            throw new Error('AUTH_BLOCKED');
        }
        if (options.admin && !canAccessAdmin(session.role)) {
            this.redirectToLogin(options.returnTo, 'forbidden');
            throw new Error('AUTH_FORBIDDEN');
        }
        return session;
    },

    async loginWithDiscord() {
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

        const { firebaseToken, profile } = payload;
        if (!firebaseToken) {
            throw new Error('DISCORD_TOKEN_MISSING');
        }

        return signInWithCustomToken(firebaseToken, profile);
    },

    async loginWithGoogle() {
        if (!APP_CONFIG.googleClientId) {
            throw new Error('GOOGLE_CLIENT_ID_NOT_CONFIGURED');
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

    redirectToLogin(returnTo = null, reason = null) {
        const url = new URL(chrome.runtime.getURL('src/auth/login.html'));
        if (returnTo) url.searchParams.set('returnTo', returnTo);
        if (reason) url.searchParams.set('reason', reason);
        window.location.href = url.toString();
    },

    getPostLoginUrl(session) {
        if (canAccessAdmin(session?.role)) {
            return chrome.runtime.getURL('src/dashboard/admin.html');
        }
        return chrome.runtime.getURL('src/sidepanel/sidepanel.html');
    }
};
