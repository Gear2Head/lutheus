global.chrome = {
    runtime: {
        getURL: jest.fn((path) => `chrome-extension://test/${path}`)
    }
};

global.window = {
    location: {
        href: 'chrome-extension://test/src/dashboard/admin.html'
    }
};

const { FALLBACK_AVATAR, resolveAvatar } = require('../../src/lib/avatar.js');

describe('resolveAvatar', () => {
    test('accepts Discord CDN avatars', () => {
        const url = 'https://cdn.discordapp.com/avatars/123/hash.webp?size=128';
        expect(resolveAvatar(url)).toBe(url);
    });

    test('unwraps proxied Sapphire image urls', () => {
        const nested = encodeURIComponent('https://cdn.discordapp.com/avatars/123/hash.png?size=128');
        expect(resolveAvatar(`https://dashboard.sapph.xyz/_next/image?url=${nested}`))
            .toBe('https://cdn.discordapp.com/avatars/123/hash.png?size=128');
    });

    test('rejects unsafe avatar urls', () => {
        expect(resolveAvatar('javascript:alert(1)')).toBe(FALLBACK_AVATAR);
    });
});
