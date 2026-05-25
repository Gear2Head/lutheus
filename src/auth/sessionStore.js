const SESSION_KEY = 'lutheusAuthSession';
const hasChromeStorage = () => typeof chrome !== 'undefined' && chrome.storage?.local;

function storageGet(key) {
    return new Promise((resolve) => {
        if (!hasChromeStorage()) {
            const raw = window.localStorage.getItem(key);
            resolve(raw ? JSON.parse(raw) : null);
            return;
        }
        chrome.storage.local.get([key], (result) => resolve(result[key] || null));
    });
}

function storageSet(key, value) {
    return new Promise((resolve) => {
        if (!hasChromeStorage()) {
            window.localStorage.setItem(key, JSON.stringify(value));
            resolve();
            return;
        }
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

function storageRemove(key) {
    return new Promise((resolve) => {
        if (!hasChromeStorage()) {
            window.localStorage.removeItem(key);
            resolve();
            return;
        }
        chrome.storage.local.remove([key], resolve);
    });
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
