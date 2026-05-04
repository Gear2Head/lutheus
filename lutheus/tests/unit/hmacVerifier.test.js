const { createHmac, timingSafeEqual } = require('crypto');

const EXPECTED_HEX_LEN = 64;
const MAX_AGE_MS = 60_000;
const MAX_FUTURE_MS = 10_000;

function sign(secret, timestamp, body) {
    return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function verify(secret, signature, timestamp, body) {
    if (!signature || !timestamp) return 'MISSING_HEADERS';

    const numericTimestamp = parseInt(timestamp, 10);
    if (Number.isNaN(numericTimestamp)) return 'INVALID_TIMESTAMP_FORMAT';

    const age = Date.now() - numericTimestamp;
    if (age > MAX_AGE_MS) return 'EXPIRED_TIMESTAMP';
    if (age < -MAX_FUTURE_MS) return 'FUTURE_TIMESTAMP';
    if (signature.length !== EXPECTED_HEX_LEN) return 'INVALID_SIGNATURE_LENGTH';

    const expected = sign(secret, timestamp, body);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length) return 'INVALID_SIGNATURE_LENGTH';

    return timingSafeEqual(sigBuffer, expectedBuffer) ? 'OK' : 'INVALID_PAYLOAD_SIGNATURE';
}

const SECRET = 'test-secret-32-chars-minimum!!';

describe('hmac verifier signing logic', () => {
    test('accepts valid signature', () => {
        const timestamp = Date.now().toString();
        const signature = sign(SECRET, timestamp, '{"foo":"bar"}');
        expect(verify(SECRET, signature, timestamp, '{"foo":"bar"}')).toBe('OK');
    });

    test('rejects bad payload', () => {
        const timestamp = Date.now().toString();
        const signature = sign(SECRET, timestamp, '{"foo":"bar"}');
        expect(verify(SECRET, signature, timestamp, '{"foo":"baz"}')).toBe('INVALID_PAYLOAD_SIGNATURE');
    });

    test('rejects invalid signature length', () => {
        expect(verify(SECRET, 'abc123', Date.now().toString(), '{}')).toBe('INVALID_SIGNATURE_LENGTH');
    });
});
