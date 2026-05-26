const {
    ROLE_ORDER,
    ROLES,
    PERMISSIONS,
    canAccessRoute,
    getDefaultRolePolicy,
    getRoleLevel,
    hasPermission,
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

    test('keeps Discord moderator out of privileged management capabilities', () => {
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.REPORTS_VIEW)).toBe(true);
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.STAFF_ASSIGN_ROLE)).toBe(false);
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW)).toBe(false);
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.PENALTY_ACCURACY_UPDATE)).toBe(false);
        expect(hasPermission(ROLES.DISCORD_MODERATORU, PERMISSIONS.REPORTS_CREATE)).toBe(false);
    });

    test('protects admin tabs through route permission map', () => {
        expect(canAccessRoute(ROLES.DISCORD_MODERATORU, 'dashboard')).toBe(true);
        expect(canAccessRoute(ROLES.DISCORD_MODERATORU, 'pointtrain')).toBe(true);
        expect(canAccessRoute(ROLES.DISCORD_MODERATORU, 'management')).toBe(false);
        expect(canAccessRoute(ROLES.DISCORD_MODERATORU, 'auth')).toBe(false);
        expect(canAccessRoute(ROLES.DISCORD_MODERATORU, 'cuk')).toBe(false);
        expect(canAccessRoute(ROLES.KIDEMLI_DISCORD_MODERATORU, 'management')).toBe(false);
        expect(canAccessRoute(ROLES.YONETICI, 'management')).toBe(true);
    });
});
