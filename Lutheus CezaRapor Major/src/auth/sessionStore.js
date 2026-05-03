const SESSION_KEY = 'lutheusAuthSession';

function storageGet(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result[key] || null));
    });
}

function storageSet(key, value) {
    return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
}

function storageRemove(key) {
    return new Promise((resolve) => chrome.storage.local.remove([key], resolve));
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
