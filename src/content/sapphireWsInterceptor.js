// FILE: src/content/sapphireWsInterceptor.js
// WORLD: MAIN
// PURPOSE: Safely observe Sapphire moderation cases Engine.IO/Socket.IO packets over WebSocket.
// LUTHEUS v3 - WebSocket Interception Layer

(function () {
    'use strict';

    if (window.__LUTHEUS_WS_INTERCEPTOR_ACTIVE) return;
    window.__LUTHEUS_WS_INTERCEPTOR_ACTIVE = true;

    console.debug('[Lutheus WS Interceptor] Activating on', window.location.origin);

    const NativeWebSocket = window.WebSocket;

    function isTargetSapphireSocket(url) {
        const text = String(url || '');
        return text.includes('user-ws.sapph.xyz') || text.includes('sapph.xyz/socket.io');
    }

    function parseSocketIoFrame(frame) {
        if (typeof frame !== 'string') return null;
        if (!frame.startsWith('42')) return null;

        let rest = frame.slice(2);
        let namespace = null;

        if (rest.startsWith('/')) {
            const commaIndex = rest.indexOf(',');
            if (commaIndex === -1) return null;
            namespace = rest.slice(0, commaIndex);
            rest = rest.slice(commaIndex + 1);
        }

        let parsed;
        try {
            parsed = JSON.parse(rest);
        } catch (_e) {
            return null;
        }

        if (!Array.isArray(parsed)) return null;

        const eventName = parsed[0];
        const payload = parsed[1];

        if (eventName !== 'cases') return null;
        if (!payload || typeof payload !== 'object') return null;
        if (!Array.isArray(payload.data)) return null;

        return {
            namespace,
            eventName,
            payload
        };
    }

    function observeFrame(data, url) {
        try {
            const parsed = parseSocketIoFrame(data);
            if (parsed) {
                console.debug('[Lutheus WS Interceptor] Captured cases event from WebSocket.');
                window.postMessage({
                    source: 'LUTHEUS_WS_INTERCEPTOR',
                    type: 'SAPPHIRE_CASES',
                    payload: parsed.payload,
                    url: String(url),
                    capturedAt: new Date().toISOString()
                }, window.location.origin);
            }
        } catch (err) {
            console.debug('[Lutheus WS Interceptor] Frame processing skipped:', err.message);
        }
    }

    function LutheusWebSocket(url, protocols) {
        const socket = protocols
            ? new NativeWebSocket(url, protocols)
            : new NativeWebSocket(url);

        if (isTargetSapphireSocket(url)) {
            console.debug('[Lutheus WS Interceptor] WebSocket constructor proxy hooked for target URL:', url);
            
            socket.addEventListener('message', (event) => {
                observeFrame(event?.data, url);
            });
        }

        return socket;
    }

    LutheusWebSocket.prototype = NativeWebSocket.prototype;
    LutheusWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    LutheusWebSocket.OPEN = NativeWebSocket.OPEN;
    LutheusWebSocket.CLOSING = NativeWebSocket.CLOSING;
    LutheusWebSocket.CLOSED = NativeWebSocket.CLOSED;
    
    Object.setPrototypeOf(LutheusWebSocket, NativeWebSocket);
    window.WebSocket = LutheusWebSocket;

    console.debug('[Lutheus WS Interceptor] Active and routing.');
})();
