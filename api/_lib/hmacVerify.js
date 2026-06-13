// SECTION: HMAC_SECURITY
// PURPOSE: Server-side HMAC-SHA256 signature verification using Node.js built-in crypto.
// Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks.

'use strict';

const crypto = require('crypto');

/**
 * Compute an HMAC-SHA256 hex digest of a raw body string using the given secret.
 * @param {string} rawBody - The raw request body string
 * @param {string} secret - The shared HMAC secret
 * @returns {string} Lowercase hex-encoded HMAC-SHA256 signature
 */
function computeHmac(rawBody, secret) {
    return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/**
 * Verify a raw body string against a provided HMAC-SHA256 hex signature.
 * Always uses crypto.timingSafeEqual to prevent timing attacks.
 * Returns false (never throws) if the signature is malformed or lengths mismatch.
 * @param {string} rawBody - The raw request body string to verify
 * @param {string} signature - The hex signature from the X-Lutheus-Sig header
 * @param {string} secret - The shared HMAC secret
 * @returns {boolean}
 */
function verifyHmacSignature(rawBody, signature, secret) {
    if (!rawBody || !signature || !secret) return false;
    try {
        const expected = computeHmac(rawBody, secret);
        const expectedBuf = Buffer.from(expected, 'hex');
        // Normalise incoming to raw hex; reject if length differs
        const providedHex = String(signature).toLowerCase().replace(/[^0-9a-f]/g, '');
        if (providedHex.length !== expected.length) return false;
        const providedBuf = Buffer.from(providedHex, 'hex');
        return crypto.timingSafeEqual(expectedBuf, providedBuf);
    } catch {
        return false;
    }
}

/**
 * Middleware-style HMAC signature enforcement.
 *
 * Behaviour:
 * - If LUTHEUS_HMAC_SECRET env var is NOT set → silently skips (dev / legacy routes).
 * - If env var IS set AND X-Lutheus-Sig header is present → verifies and throws on mismatch.
 * - If env var IS set but header is MISSING → throws 401 (unsigned requests rejected).
 *
 * Usage inside an API route handler (after parsing body):
 *   await requireHmacSignature(req, body);
 *
 * @param {import('http').IncomingMessage} req - The Next.js / Vercel API request object
 * @param {object|string} body - The already-parsed request body (object or raw string)
 * @throws {{ statusCode: number, code: string }} on signature mismatch
 */
async function requireHmacSignature(req, body) {
    const secret = process.env.LUTHEUS_HMAC_SECRET;

    // No secret configured → skip (dev / backward-compat mode)
    if (!secret) return;

    const provided = req.headers['x-lutheus-sig'];

    // Secret is set but header is absent → reject
    if (!provided) {
        throw { statusCode: 401, code: 'INVALID_SIGNATURE', message: 'Missing X-Lutheus-Sig header' };
    }

    // Serialise body consistently, matching client-side signPayload logic
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);

    const valid = verifyHmacSignature(rawBody, String(provided), secret);
    if (!valid) {
        throw { statusCode: 401, code: 'INVALID_SIGNATURE', message: 'HMAC signature mismatch' };
    }
}

module.exports = { verifyHmacSignature, requireHmacSignature };
