const crypto = require('crypto');

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload) {
    const secret = process.env.OAUTH_STATE_SECRET || process.env.DISCORD_CLIENT_SECRET || 'lutheus-dev-state';
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createState(data) {
    const payload = base64UrlEncode(JSON.stringify({
        ...data,
        createdAt: Date.now()
    }));
    return `${payload}.${sign(payload)}`;
}

function readState(state) {
    const [payload, signature] = String(state || '').split('.');
    if (!payload || !signature || sign(payload) !== signature) {
        throw new Error('INVALID_OAUTH_STATE');
    }
    const parsed = JSON.parse(base64UrlDecode(payload));
    if (Date.now() - Number(parsed.createdAt || 0) > 10 * 60 * 1000) {
        throw new Error('OAUTH_STATE_EXPIRED');
    }
    return parsed;
}

module.exports = { createState, readState };
