export const ROLES = Object.freeze({
    KURUCU: 'kurucu',
    ADMIN: 'admin',
    YONETICI: 'yonetici',
    KIDEMLI: 'kidemli',
    SENIOR_MODERATOR: 'senior_moderator',
    MODERATOR: 'moderator',
    SUPPORT: 'support',
    VIEWER: 'viewer',
    PENDING: 'pending',
    BLOCKED: 'blocked'
});

export const ROLE_LEVELS = Object.freeze({
    [ROLES.KURUCU]: 100,
    [ROLES.ADMIN]: 90,
    [ROLES.YONETICI]: 80,
    [ROLES.KIDEMLI]: 70,
    [ROLES.SENIOR_MODERATOR]: 65,
    [ROLES.MODERATOR]: 40,
    [ROLES.SUPPORT]: 20,
    [ROLES.VIEWER]: 10,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: -1
});

export const DEFAULT_GROQ_LIMITS = Object.freeze({
    [ROLES.KURUCU]: 500,
    [ROLES.ADMIN]: 350,
    [ROLES.YONETICI]: 250,
    [ROLES.KIDEMLI]: 175,
    [ROLES.SENIOR_MODERATOR]: 150,
    [ROLES.MODERATOR]: 40,
    [ROLES.SUPPORT]: 10,
    [ROLES.VIEWER]: 0,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: 0
});

const ADMIN_ROLES = new Set([
    ROLES.KURUCU,
    ROLES.ADMIN,
    ROLES.YONETICI,
    ROLES.KIDEMLI,
    ROLES.SENIOR_MODERATOR
]);

export function normalizeRole(role) {
    const normalized = String(role || ROLES.MODERATOR).trim().toLowerCase();
    if (normalized === 'yönetici') return ROLES.YONETICI;
    if (normalized === 'kıdemli') return ROLES.KIDEMLI;
    if (ROLE_LEVELS[normalized] !== undefined) return normalized;
    return ROLES.MODERATOR;
}

export function getRoleLevel(role) {
    return ROLE_LEVELS[normalizeRole(role)] ?? ROLE_LEVELS[ROLES.MODERATOR];
}

export function isPrivilegedRole(role) {
    return ADMIN_ROLES.has(normalizeRole(role));
}

export function canManageSystem(role) {
    return isPrivilegedRole(role);
}

export function canEditCuk(role) {
    return isPrivilegedRole(role);
}

export function canAccessAdmin(role) {
    return isPrivilegedRole(role);
}

export function canRunAi(role) {
    return (DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0) > 0;
}

export function getDefaultGroqLimit(role) {
    return DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0;
}

export function getVisibleSections(role) {
    if (isPrivilegedRole(role)) {
        return ['home', 'scan', 'stats', 'pointtrain', 'profile', 'settings'];
    }
    if (normalizeRole(role) === ROLES.MODERATOR) {
        return ['home', 'stats', 'profile'];
    }
    return ['home', 'profile'];
}
