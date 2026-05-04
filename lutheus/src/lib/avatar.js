const FALLBACK_AVATAR = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
    ? chrome.runtime.getURL('assets/icon48.png')
    : '/assets/icon48.png';

function getSearchParamUrl(parsed) {
    const candidates = ['url', 'src', 'image', 'avatar'];
    for (const key of candidates) {
        const value = parsed.searchParams.get(key);
        if (value) return value;
    }
    return '';
}

function normalizeAvatarUrl(url, depth = 0) {
    if (!url || typeof url !== 'string' || depth > 2) return '';
    const raw = url.trim();
    if (!raw || /^javascript:/i.test(raw) || /^data:/i.test(raw) || /^blob:/i.test(raw)) return '';

    try {
        const absolute = raw.startsWith('//') ? `https:${raw}` : raw;
        const parsed = new URL(absolute, window.location.href);
        const nestedUrl = getSearchParamUrl(parsed);
        if (nestedUrl) {
            const normalizedNested = normalizeAvatarUrl(nestedUrl, depth + 1);
            if (normalizedNested) return normalizedNested;
        }

        if (parsed.protocol === 'chrome-extension:') return parsed.href;
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';

        const decodedPath = decodeURIComponent(parsed.pathname);
        if (/https?:\/\//i.test(decodedPath)) {
            const embedded = decodedPath.match(/https?:\/\/[^?#\s]+/i)?.[0] || '';
            const normalizedEmbedded = normalizeAvatarUrl(embedded, depth + 1);
            if (normalizedEmbedded) return normalizedEmbedded;
        }

        const host = parsed.hostname.toLowerCase();
        const allowed = host === 'cdn.discordapp.com'
            || host === 'cdn.discordapp.net'
            || host === 'media.discordapp.net'
            || host.endsWith('.discordapp.com')
            || host.endsWith('.discordapp.net')
            || host === 'lh3.googleusercontent.com'
            || host.endsWith('.googleusercontent.com')
            || host === 'dashboard.sapph.xyz'
            || host.endsWith('.sapph.xyz');
        return allowed ? parsed.href : '';
    } catch {
        return '';
    }
}

export function resolveAvatar(url) {
    return normalizeAvatarUrl(url) || FALLBACK_AVATAR;
}

export function bindAvatarFallbacks(root = document) {
    root.querySelectorAll('img[data-avatar-img]').forEach((img) => {
        if (img.dataset.avatarBound === '1') return;
        img.dataset.avatarBound = '1';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => {
            if (img.src === FALLBACK_AVATAR) return;
            img.src = FALLBACK_AVATAR;
            img.classList.add('avatar-fallback');
        });
    });
}

export { FALLBACK_AVATAR };
