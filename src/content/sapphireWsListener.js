// FILE: src/content/sapphireWsListener.js
// WORLD: ISOLATED
// PURPOSE: Safely listen to window postMessage events sent by sapphireWsInterceptor.js, validate and forward to Service Worker.
// LUTHEUS v3 - WebSocket Interception Layer

(function () {
    'use strict';

    if (window.__LUTHEUS_WS_LISTENER_ACTIVE) return;
    window.__LUTHEUS_WS_LISTENER_ACTIVE = true;

    console.debug('[Lutheus WS Listener] Activating in ISOLATED world at document_start.');

    const seenKeys = new Set();
    const MAX_SEEN = 500;

    function getWsSeenKey(item) {
        const id = item.id || item.caseId || 'no-id';
        const timestamp = item.timestamp || item.createdAt || 'no-ts';
        const closedTimestamp = item.closed?.timestamp || 'open';
        return `${id}:${timestamp}:${closedTimestamp}`;
    }

    function extractRecords(payload) {
        if (!payload || typeof payload !== 'object') return [];
        if (!Array.isArray(payload.data)) return [];

        return payload.data
            .map(group => Array.isArray(group) ? group[0] : group)
            .filter(item => item && typeof item === 'object')
            .filter(item => item.id || item.caseId);
    }

    function deduplicate(records) {
        const fresh = [];
        for (const r of records) {
            const key = getWsSeenKey(r);
            if (seenKeys.has(key)) continue;
            
            if (seenKeys.size >= MAX_SEEN) {
                const first = seenKeys.values().next().value;
                seenKeys.delete(first);
            }
            seenKeys.add(key);
            fresh.push(r);
        }
        return fresh;
    }

    window.addEventListener('message', (event) => {
        try {
            if (event.source !== window) return;
            if (event.data?.source !== 'LUTHEUS_WS_INTERCEPTOR') return;
            if (event.data?.type !== 'SAPPHIRE_CASES') return;
            if (typeof event.data.payload !== 'object' || event.data.payload === null) return;

            const envelope = event.data;
            const rawRecords = extractRecords(envelope.payload);
            const freshRecords = deduplicate(rawRecords);

            if (!freshRecords.length) return;

            console.debug('[Lutheus WS Listener] Routing', freshRecords.length, 'fresh cases to background SW.');

            // Extract guildId dynamically from URL
            const urlMatch = window.location.href.match(/https:\/\/dashboard\.sapph.xyz\/(\d+)/);
            const guildId = urlMatch ? urlMatch[1] : '1223431616081166336';

            chrome.runtime.sendMessage({
                action: 'SAPPHIRE_WS_CASES',
                records: freshRecords,
                meta: {
                    guildId,
                    count: envelope.payload.count,
                    start: envelope.payload.start,
                    limit: envelope.payload.limit,
                    update: envelope.payload.update,
                    filter: envelope.payload.filter,
                    executionTime: envelope.payload.executionTime,
                    sourceUrl: envelope.url,
                    capturedAt: envelope.capturedAt,
                    pageUrl: window.location.href
                }
            }).catch((_err) => {
                // Extensions context may get invalidated during updates/swaps, log silently
                console.debug('[Lutheus WS Listener] Message dispatch skipped (extension context may be inactive).');
            });
        } catch (err) {
            console.debug('[Lutheus WS Listener] Message handler exception:', err.message);
        }
    });

    console.debug('[Lutheus WS Listener] Active and awaiting interceptor frames.');
})();
