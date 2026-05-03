const {
    ROLE_ORDER,
    ROLES,
    getDefaultRolePolicy,
    getRoleLevel,
    normalizeRole
} = require('../../src/auth/rolePolicy.js');

describe('rolePolicy', () => {
    test('normalizes new Lutheus role aliases', () => {
        expect(normalizeRole('Genel Sorumlu')).toBe(ROLES.GENEL_SORUMLU);
        expect(normalizeRole('Discord Yöneticisi')).toBe(ROLES.DISCORD_YONETICISI);
        expect(normalizeRole('kıdemli')).toBe(ROLES.KIDEMLI_DISCORD_MODERATORU);
        expect(normalizeRole('moderator')).toBe(ROLES.DISCORD_MODERATORU);
        expect(normalizeRole('support')).toBe(ROLES.DISCORD_DESTEK_EKIBI);
    });

    test('keeps requested rank ordering', () => {
        expect(ROLE_ORDER.slice(0, 6)).toEqual([
            ROLES.YONETICI,
            ROLES.GENEL_SORUMLU,
            ROLES.DISCORD_YONETICISI,
            ROLES.KIDEMLI_DISCORD_MODERATORU,
            ROLES.DISCORD_MODERATORU,
            ROLES.DISCORD_DESTEK_EKIBI
        ]);
        expect(getRoleLevel(ROLES.YONETICI)).toBeGreaterThan(getRoleLevel(ROLES.GENEL_SORUMLU));
        expect(getRoleLevel(ROLES.DISCORD_MODERATORU)).toBeGreaterThan(getRoleLevel(ROLES.DISCORD_DESTEK_EKIBI));
    });

    test('default policy contains seeded Discord IDs', () => {
        const policy = getDefaultRolePolicy();
        const seededIds = policy.seededRoleMembers.map((entry) => entry.id);
        expect(seededIds).toContain('758769576778661989');
        expect(seededIds).toContain('529357404882599966');
        expect(seededIds).toContain('1375772029982085184');
    });
});
