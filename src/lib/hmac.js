// SECTION: HMAC_SECURITY
// PURPOSE: Browser-side HMAC-SHA256 signing using Web Crypto API (Chrome Extension MV3 compatible).

/**
 * Encode a UTF-8 string to a Uint8Array.
 * @param {string} str
 * @returns {Uint8Array}
 */
function encode(str) {
    return new TextEncoder().encode(str);
}

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Import a raw HMAC-SHA256 key from a string secret.
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
async function importKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns a hex-encoded signature string.
 * @param {string} payload - The string to sign (typically JSON.stringify(body))
 * @param {string} secret - The shared HMAC secret
 * @returns {Promise<string>} Hex-encoded HMAC-SHA256 signature
 */
export async function signPayload(payload, secret) {
    const key = await importKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, encode(payload));
    return bufferToHex(signature);
}

/**
 * Verify a payload against an expected HMAC-SHA256 signature.
 * Uses constant-time verification via SubtleCrypto.verify to prevent timing attacks.
 * @param {string} payload - The string to verify
 * @param {string} signature - Expected hex signature
 * @param {string} secret - The shared HMAC secret
 * @returns {Promise<boolean>}
 */
export async function verifyPayload(payload, signature, secret) {
    try {
        // Convert the provided hex signature back to a Uint8Array for SubtleCrypto.verify
        const sigBytes = new Uint8Array(
            signature.match(/.{2}/g).map((byte) => parseInt(byte, 16))
        );
        const key = await importKey(secret);
        return await crypto.subtle.verify('HMAC', key, sigBytes, encode(payload));
    } catch {
        return false;
    }
}
