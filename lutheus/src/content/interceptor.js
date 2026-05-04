// FILE: src/content/interceptor.js
// WORLD: MAIN
// PURPOSE: Monkey-patch fetch/XHR to capture Sapphire punishment API responses.
// LUTHEUS v3 - Network Interception Layer
/* eslint-disable no-console */

(function () {
    'use strict';

    if (window.__LUTHEUS_INTERCEPTOR_ACTIVE) return;
    window.__LUTHEUS_INTERCEPTOR_ACTIVE = true;

    const TARGET_PATTERNS = [
        /dashboard\.sapph\.xyz\/api/i,
        /\/api\/v\d+\/guilds\/[^/?#]+/i,
        /\/moderation\/cases/i,
        /\/cases(?:[/?#]|$)/i,
        /\/punishments(?:[/?#]|$)/i,
        /\/infractions(?:[/?#]|$)/i,
        /\/modlogs(?:[/?#]|$)/i,
        /\/audit(?:[/?#]|$)/i,
        /\/bans(?:[/?#]|$)/i,
        /\/mutes(?:[/?#]|$)/i,
        /\/kicks(?:[/?#]|$)/i,
        /\/warns(?:[/?#]|$)/i
    ];

    const ASSET_PATTERN = /\.(?:js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map)(?:[?#]|$)/i;

    function isTargetEndpoint(url) {
        if (!url) return false;
        const str = String(url);
        if (ASSET_PATTERN.test(str)) return false;
        return TARGET_PATTERNS.some(p => p.test(str));
    }

    function dispatchPayload(url, data) {
        try {
            window.postMessage({
                source: 'LUTHEUS_INTERCEPTOR',
                type: 'NETWORK_PAYLOAD',
                url: String(url),
                payload: data,
                timestamp: Date.now()
            }, '*');
        } catch (err) {
            console.debug('[Lutheus Interceptor] dispatch error:', err);
        }
    }

    // ── FETCH INTERCEPTOR ──────────────────────────────────────
    const _originalFetch = window.fetch.bind(window);
    window.fetch = async function (...args) {
        const response = await _originalFetch(...args);
        try {
            const url = args[0] instanceof Request ? args[0].url : String(args[0] || '');
            if (isTargetEndpoint(url)) {
                const clone = response.clone();
                clone.json().then(data => dispatchPayload(url, data)).catch(() => {});
            }
        } catch (err) {
            console.debug('[Lutheus Interceptor] fetch wrap error:', err);
        }
        return response;
    };

    // ── XHR INTERCEPTOR ───────────────────────────────────────
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__lutheus_url = url;
        return _open.call(this, method, url, ...rest);
    };

    const _onReadyStateChange = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'onreadystatechange');
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('readystatechange', function () {
            try {
                if (this.readyState === 4 && this.status === 200 && isTargetEndpoint(this.__lutheus_url)) {
                    const data = JSON.parse(this.responseText);
                    dispatchPayload(this.__lutheus_url, data);
                }
            } catch (err) {
                console.debug('[Lutheus Interceptor] XHR parse error:', err);
            }
        });
        return _send.apply(this, args);
    };

    // SPA navigation: interceptors persist for the tab lifetime - no re-registration needed.
    console.debug('[Lutheus Interceptor] active on', window.location.origin);
})();
