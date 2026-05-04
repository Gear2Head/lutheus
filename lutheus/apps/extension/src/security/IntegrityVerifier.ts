/**
 * AMAÇ: Tarayıcı uzantısının Hostile Environment (Kötü niyetli kullanıcı ortamında) çalışırken manipüle edilip edilmediğini doğrulamak.
 * MANTIK: Gömülü script imzalarını kontrol eder, global native objelerin override edilip edilmediğini araştırır (Anti-Tamper).
 */

export class IntegrityVerifier {
    private static readonly IS_PRODUCTION = process.env.NODE_ENV === 'production';

    public static runSelfDiagnostics(): boolean {
        if (!this.IS_PRODUCTION) return true;

        const isTampered = this.checkNativeOverrides() || this.checkPrototypePollution();

        if (isTampered) {
            this.triggerSelfDestruct();
            return false;
        }

        return true;
    }

    private static checkNativeOverrides(): boolean {
        // Fetch, Promise veya MutationObserver objeleri override edildiyse, 
        // stringification'da "[native code]" dönmez, proxy dönme riski vardır.
        const nativeFunctions = [window.fetch, window.XMLHttpRequest, window.MutationObserver];

        for (const fn of nativeFunctions) {
            if (fn && !fn.toString().includes('[native code]')) {
                console.warn('[Security] Native function override detected!');
                return true;
            }
        }
        return false;
    }

    private static checkPrototypePollution(): boolean {
        // En basit Object.prototype kirliliği kontrolü
        return Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')
            || (Object.prototype as Record<string, unknown>).polluted !== undefined;
    }

    private static triggerSelfDestruct(): void {
        console.error('[CRITICAL] Runtime Integrity Violation Detected. Extension logic is halted.');

        // Background script'e bildir ve token'ları sil (API mevcudiyet var sayımı ile)
        try {
            chrome.runtime.sendMessage({ type: 'INTEGRITY_COMPROMISED' });
        } catch (e) {
            // Chrome namespace might not be available in all contexts, ignore
        }

        // DOM'u dondur ve execution akışını boz
        Object.freeze(document);
        Object.freeze(window);

        // Hata fırlatarak mevcut Callstack'i kır
        throw new Error('SEC_001_RUNTIME_TAMPERED');
    }
}
