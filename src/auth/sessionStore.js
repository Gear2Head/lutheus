const SESSION_KEY = 'lutheusAuthSession';
const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

function storageGet(key) {
    if (isExtension) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => resolve(result[key] || null));
        });
    } else {
        const item = localStorage.getItem(key);
        try {
            return Promise.resolve(item ? JSON.parse(item) : null);
        } catch (_) {
            return Promise.resolve(item);
        }
    }
}

function storageSet(key, value) {
    if (isExtension) {
        return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
    } else {
        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
        return Promise.resolve();
    }
}

function storageRemove(key) {
    if (isExtension) {
        return new Promise((resolve) => chrome.storage.local.remove([key], resolve));
    } else {
        localStorage.removeItem(key);
        return Promise.resolve();
    }
}

export async function getStoredSession() {
    return storageGet(SESSION_KEY);
}

export async function setStoredSession(session) {
    await storageSet(SESSION_KEY, {
        ...session,
        savedAt: Date.now()
    });
    return session;
}

export async function clearStoredSession() {
    await storageRemove(SESSION_KEY);
}

export function isSessionExpired(session, skewMs = 60_000) {
    if (!session?.expiresAt) return true;
    return Date.now() + skewMs >= Number(session.expiresAt);
}

export function isSessionNearExpiry(session, bufferMs = 5 * 60_000) {
    if (!session?.expiresAt) return false;
    return Date.now() + bufferMs >= Number(session.expiresAt);
}
