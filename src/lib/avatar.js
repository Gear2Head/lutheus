const FALLBACK_AVATAR = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('assets/icon48.png')
    : '/assets/icon48.png';

function isAllowedAvatarUrl(url) {
    if (!url || typeof url !== 'string' || /^javascript:/i.test(url)) return false;

    try {
        const parsed = new URL(url, window.location.href);
        if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'data:') return true;
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
        if (/https?:/i.test(decodeURIComponent(parsed.pathname))) return false;

        const host = parsed.hostname.toLowerCase();
        return host === 'cdn.discordapp.com'
            || host === 'media.discordapp.net'
            || host === 'lh3.googleusercontent.com'
            || host.endsWith('.googleusercontent.com')
            || host === 'dashboard.sapph.xyz'
            || host.endsWith('.sapph.xyz')
            || host.endsWith('.discordapp.com')
            || host.endsWith('.discordapp.net')
            || host.endsWith('.discord.com')
            || host.endsWith('.discord.net');
    } catch {
        return false;
    }
}

export function resolveAvatar(url) {
    if (!url || typeof url !== 'string') return FALLBACK_AVATAR;
    let normalized = url.trim();
    if (normalized.startsWith('//')) {
        normalized = 'https:' + normalized;
    }
    return isAllowedAvatarUrl(normalized) ? normalized : FALLBACK_AVATAR;
}

export function bindAvatarFallbacks(root = document) {
    const isDoc = root === document;
    const targetEl = isDoc ? document.body : root;
    if (!targetEl || targetEl.dataset?.avatarDelegated === '1') return;
    targetEl.dataset.avatarDelegated = '1';

    targetEl.addEventListener('error', (event) => {
        const target = event.target;
        if (target && target.tagName === 'IMG' && (target.hasAttribute('data-avatar-img') || target.dataset.avatarImg)) {
            if (target.src !== FALLBACK_AVATAR) {
                target.src = FALLBACK_AVATAR;
                target.classList.add('avatar-fallback');
            }
        }
    }, true); // error events do not bubble, capturing listener is required
}

export { FALLBACK_AVATAR };
