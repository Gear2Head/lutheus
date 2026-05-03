const FALLBACK_AVATAR = chrome.runtime.getURL('assets/icon48.png');

function isAllowedAvatarUrl(url) {
    if (!url || typeof url !== 'string' || /^javascript:/i.test(url)) return false;

    try {
        const parsed = new URL(url, window.location.href);
        if (parsed.protocol === 'chrome-extension:') return true;
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

        const host = parsed.hostname.toLowerCase();
        return host === 'cdn.discordapp.com'
            || host === 'media.discordapp.net'
            || host === 'lh3.googleusercontent.com'
            || host.endsWith('.googleusercontent.com')
            || host === 'dashboard.sapph.xyz'
            || host.endsWith('.sapph.xyz');
    } catch {
        return false;
    }
}

export function resolveAvatar(url) {
    return isAllowedAvatarUrl(url) ? url : FALLBACK_AVATAR;
}

export function bindAvatarFallbacks(root = document) {
    root.querySelectorAll('img[data-avatar-img]').forEach((img) => {
        if (img.dataset.avatarBound === '1') return;
        img.dataset.avatarBound = '1';
        img.addEventListener('error', () => {
            img.src = FALLBACK_AVATAR;
            img.classList.add('avatar-fallback');
        });
    });
}

export { FALLBACK_AVATAR };
