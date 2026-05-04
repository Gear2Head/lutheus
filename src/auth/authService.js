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
    if (typeof chrome === 'undefined' || !chrome.identity) {
        return new URL(`/src/auth/login.html?provider=${encodeURIComponent(path)}`, window.location.origin).toString();
    }
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

function runtimeUrl(path) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path);
    }
    return new URL(`/${path.replace(/^\/+/, '')}`, window.location.origin).toString();
}

async function signInWithWebFirebase(kind) {
    const [
        { initializeApp },
        { getApps },
        { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup }
    ] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const provider = kind === 'discord' ? new OAuthProvider('oidc.discord') : new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const idToken = await user.getIdToken();
    const providerData = user.providerData?.[0] || {};
    const providerId = providerData.providerId || user.providerId || kind;
    const profile = {
        uid: user.uid,
        provider: kind === 'discord' || providerId.includes('discord') ? 'discord' : 'google',
        email: user.email?.toLowerCase() || '',
        displayName: user.displayName || providerData.displayName || user.email || user.uid,
        username: providerData.displayName || user.displayName || null,
        avatar: user.photoURL || providerData.photoURL || null,
        discordId: providerData.uid && providerId.includes('discord') ? providerData.uid : null
    };
    const role = await resolveRole(profile, idToken).catch((error) => {
        if (error.message === 'GOOGLE_EMAIL_NOT_ALLOWLISTED') throw error;
        return ROLES.MODERATOR;
    });
    const session = {
        uid: user.uid,
        provider: profile.provider,
        idToken,
        refreshToken: user.refreshToken,
        expiresAt: Date.now() + 55 * 60 * 1000,
        profile: { ...profile, role, status: 'active' },
        role
    };
    await setStoredSession(session);
    await FirebaseRepository.upsertUser(session.profile).catch(() => null);
    return session;
}

function webAuthBaseUrl() {
    return APP_CONFIG.vercelAuthBaseUrl || window.location.origin;
}

function beginWebDiscordOAuth() {
    const redirectUri = new URL('/src/auth/login.html', window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo) redirectUri.searchParams.set('returnTo', returnTo);
    redirectUri.searchParams.set('provider', 'discord');

    const startUrl = new URL('/api/auth/discord/start', webAuthBaseUrl());
    startUrl.searchParams.set('redirect_uri', redirectUri.toString());
    startUrl.searchParams.set('source', 'web');
    window.location.href = startUrl.toString();
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
    return ROLES.MODERATOR;
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
        return ROLES.MODERATOR;
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
    await FirebaseRepository.upsertUser(session.profile).catch(() => null);
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
    await FirebaseRepository.upsertUser(session.profile).catch(() => null);
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
        if (typeof chrome === 'undefined' || !chrome.identity) {
            beginWebDiscordOAuth();
            return new Promise(() => {});
        }
        const redirectUri = extensionRedirectUrl('discord');
        const startUrl = new URL('/api/auth/discord/start', APP_CONFIG.vercelAuthBaseUrl);
        startUrl.searchParams.set('redirect_uri', redirectUri);
        startUrl.searchParams.set('source', 'extension');
        const redirectUrl = await authFlow(startUrl.toString());
        const params = parseHashOrQuery(redirectUrl);
        const token = params.get('firebaseToken') || params.get('token');
        if (!token) throw new Error(params.get('error') || 'DISCORD_TOKEN_MISSING');
        const profileEncoded = params.get('profile');
        const profile = profileEncoded
            ? JSON.parse(decodeURIComponent(atob(profileEncoded)))
            : { provider: 'discord' };
        return signInWithCustomToken(token, { ...profile, provider: 'discord' });
    },

    async completeDiscordRedirect(url = window.location.href) {
        const params = parseHashOrQuery(url);
        const token = params.get('firebaseToken') || params.get('token');
        const sessionToken = params.get('sessionToken');
        if (!token && !sessionToken) return null;
        const profileEncoded = params.get('profile');
        const profile = profileEncoded
            ? JSON.parse(decodeURIComponent(atob(profileEncoded)))
            : { provider: 'discord' };
        if (token) return signInWithCustomToken(token, { ...profile, provider: 'discord' });

        const role = normalizeRole(profile.role || ROLES.MODERATOR);
        const session = {
            uid: profile.uid || `discord:${profile.discordId || profile.id || profile.username || Date.now()}`,
            provider: 'discord',
            idToken: sessionToken,
            refreshToken: null,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            profile: { ...profile, provider: 'discord', role, status: profile.status || 'active' },
            role
        };
        await setStoredSession(session);
        await FirebaseRepository.upsertUser(session.profile).catch(() => null);
        return session;
    },

    async loginWithGoogle() {
        if (typeof chrome === 'undefined' || !chrome.identity) {
            return signInWithWebFirebase('google');
        }
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
        const url = new URL(runtimeUrl('src/auth/login.html'));
        if (returnTo) url.searchParams.set('returnTo', returnTo);
        if (reason) url.searchParams.set('reason', reason);
        window.location.href = url.toString();
    },

    getPostLoginUrl(session) {
        if (canAccessAdmin(session?.role)) {
            return runtimeUrl('src/dashboard/admin.html');
        }
        return runtimeUrl('src/sidepanel/sidepanel.html');
    }
};
