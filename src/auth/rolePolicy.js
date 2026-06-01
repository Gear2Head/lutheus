export const ROLES = Object.freeze({
    KURUCU: 'kurucu',
    ADMIN: 'admin',
    YONETICI: 'yonetici',
    GENEL_SORUMLU: 'genel_sorumlu',
    DISCORD_YONETICISI: 'discord_yoneticisi',
    KIDEMLI: 'kidemli',
    KIDEMLI_DISCORD_MODERATORU: 'kidemli_discord_moderatoru',
    SENIOR_MODERATOR: 'senior_moderator',
    MODERATOR: 'moderator',
    DISCORD_MODERATORU: 'discord_moderatoru',
    SUPPORT: 'support',
    DISCORD_DESTEK_EKIBI: 'discord_destek_ekibi',
    VIEWER: 'viewer',
    PENDING: 'pending',
    BLOCKED: 'blocked',
    ESKI_YETKILI: 'eski_yetkili'
});

export const ROLE_LEVELS = Object.freeze({
    [ROLES.KURUCU]: 100,
    [ROLES.ADMIN]: 100,
    [ROLES.YONETICI]: 100,
    [ROLES.GENEL_SORUMLU]: 100,
    [ROLES.DISCORD_YONETICISI]: 100,
    [ROLES.KIDEMLI]: 100,
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: 100,
    [ROLES.SENIOR_MODERATOR]: 100,
    [ROLES.MODERATOR]: 40,
    [ROLES.DISCORD_MODERATORU]: 40,
    [ROLES.SUPPORT]: 20,
    [ROLES.DISCORD_DESTEK_EKIBI]: 20,
    [ROLES.VIEWER]: 10,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: -1
});

export const PERMISSIONS = Object.freeze({
    DASHBOARD_VIEW: 'dashboard:view',
    REPORTS_VIEW: 'reports:view',
    REPORTS_CREATE: 'reports:create',
    REPORTS_REVIEW: 'reports:review',
    PENALTIES_VIEW: 'penalties:view',
    PENALTIES_CREATE: 'penalties:create',
    PENALTIES_UPDATE: 'penalties:update',
    PENALTIES_DELETE: 'penalties:delete',
    PENALTY_ACCURACY_VIEW: 'penalty_accuracy:view',
    PENALTY_ACCURACY_UPDATE: 'penalty_accuracy:update',
    BLACKLIST_VIEW: 'blacklist:view',
    BLACKLIST_CREATE: 'blacklist:create',
    BLACKLIST_UPDATE: 'blacklist:update',
    BLACKLIST_DELETE: 'blacklist:delete',
    STAFF_VIEW: 'staff:view',
    STAFF_UPDATE: 'staff:update',
    STAFF_ASSIGN_ROLE: 'staff:assign_role',
    GOOGLE_ALLOWLIST_VIEW: 'google_allowlist:view',
    GOOGLE_ALLOWLIST_UPDATE: 'google_allowlist:update',
    DISCORD_BOT_VIEW: 'discord_bot:view',
    DISCORD_BOT_UPDATE: 'discord_bot:update',
    SYSTEM_SETTINGS_VIEW: 'system_settings:view',
    SYSTEM_SETTINGS_UPDATE: 'system_settings:update',
    AUDIT_LOGS_VIEW: 'audit_logs:view',
    SECURITY_EVENTS_VIEW: 'security_events:view',
    AI_SETTINGS_VIEW: 'ai_settings:view',
    AI_SETTINGS_UPDATE: 'ai_settings:update'
});

const MANAGEMENT_PERMISSIONS = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_REVIEW,
    PERMISSIONS.PENALTIES_VIEW,
    PERMISSIONS.PENALTIES_CREATE,
    PERMISSIONS.PENALTIES_UPDATE,
    PERMISSIONS.BLACKLIST_VIEW,
    PERMISSIONS.AUDIT_LOGS_VIEW
];

export const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.KURUCU]: ['*'],
    [ROLES.ADMIN]: ['*'],
    [ROLES.YONETICI]: ['*'],
    [ROLES.GENEL_SORUMLU]: ['*'],
    [ROLES.DISCORD_YONETICISI]: ['*'],
    [ROLES.KIDEMLI]: ['*'],
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: ['*'],
    [ROLES.SENIOR_MODERATOR]: ['*'],
    [ROLES.MODERATOR]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW
    ],
    [ROLES.DISCORD_MODERATORU]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW
    ],
    [ROLES.SUPPORT]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    [ROLES.DISCORD_DESTEK_EKIBI]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    [ROLES.PENDING]: [],
    [ROLES.BLOCKED]: []
});

export const ROUTE_PERMISSIONS = Object.freeze({
    dashboard: [PERMISSIONS.DASHBOARD_VIEW],
    management: [PERMISSIONS.STAFF_VIEW],
    yetkililer: [PERMISSIONS.STAFF_VIEW],
    cezalar: [PERMISSIONS.PENALTIES_VIEW],
    cuk: [PERMISSIONS.PENALTY_ACCURACY_UPDATE],
    pointtrain: [PERMISSIONS.REPORTS_REVIEW],
    auth: [PERMISSIONS.GOOGLE_ALLOWLIST_VIEW],
    settings: [PERMISSIONS.SYSTEM_SETTINGS_VIEW],
    profile: [PERMISSIONS.DASHBOARD_VIEW]
});

export const DEFAULT_GROQ_LIMITS = Object.freeze({
    [ROLES.KURUCU]: 500,
    [ROLES.ADMIN]: 350,
    [ROLES.YONETICI]: 250,
    [ROLES.GENEL_SORUMLU]: 225,
    [ROLES.DISCORD_YONETICISI]: 210,
    [ROLES.KIDEMLI]: 175,
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: 160,
    [ROLES.SENIOR_MODERATOR]: 150,
    [ROLES.MODERATOR]: 40,
    [ROLES.DISCORD_MODERATORU]: 40,
    [ROLES.SUPPORT]: 10,
    [ROLES.DISCORD_DESTEK_EKIBI]: 10,
    [ROLES.VIEWER]: 0,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: 0
});

export const ROLE_LABELS = Object.freeze({
    [ROLES.KURUCU]: 'Kurucu',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.YONETICI]: 'Yönetici',
    [ROLES.GENEL_SORUMLU]: 'Genel Sorumlu',
    [ROLES.DISCORD_YONETICISI]: 'Discord Yöneticisi',
    [ROLES.KIDEMLI]: 'Kıdemli',
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: 'Kıdemli Discord Moderatörü',
    [ROLES.SENIOR_MODERATOR]: 'Senior Moderatör',
    [ROLES.MODERATOR]: 'Discord Moderatör',
    [ROLES.DISCORD_MODERATORU]: 'Discord Moderatör',
    [ROLES.SUPPORT]: 'Discord Destek Ekibi',
    [ROLES.DISCORD_DESTEK_EKIBI]: 'Discord Destek Ekibi',
    [ROLES.VIEWER]: 'Viewer',
    [ROLES.PENDING]: 'Beklemede',
    [ROLES.BLOCKED]: 'Engelli'
});

export const ROLE_COLORS = Object.freeze({
    [ROLES.YONETICI]: '#7f1d1d',
    [ROLES.ADMIN]: '#7f1d1d',
    [ROLES.GENEL_SORUMLU]: '#dc2626',
    [ROLES.DISCORD_YONETICISI]: '#ff2da8',
    [ROLES.KIDEMLI]: '#c2410c',
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: '#c2410c',
    [ROLES.SENIOR_MODERATOR]: '#c2410c',
    [ROLES.MODERATOR]: '#fb923c',
    [ROLES.DISCORD_MODERATORU]: '#fb923c',
    [ROLES.SUPPORT]: '#be185d',
    [ROLES.DISCORD_DESTEK_EKIBI]: '#be185d',
    [ROLES.VIEWER]: '#64748b',
    [ROLES.PENDING]: '#71717a',
    [ROLES.BLOCKED]: '#52525b'
});

export const SEEDED_ROLE_MEMBERS = Object.freeze([
    { id: '770612318689165313', role: ROLES.YONETICI, name: 'Yönetici' },
    { id: '202889333563195402', role: ROLES.YONETICI, name: 'Yönetici' },
    { id: '344121374320754709', role: ROLES.YONETICI, name: 'Yönetici' },
    { id: '1109657614968692840', role: ROLES.GENEL_SORUMLU, name: 'Genel Sorumlu' },
    { id: '962062500189331506', role: ROLES.GENEL_SORUMLU, name: 'Genel Sorumlu' },
    { id: '860192567177773076', role: ROLES.DISCORD_YONETICISI, name: 'Discord Yöneticisi' },
    { id: '758769576778661989', role: ROLES.KIDEMLI_DISCORD_MODERATORU, name: 'Gear_Head' },
    { id: '529357404882599966', role: ROLES.DISCORD_MODERATORU, name: 'Discord Moderatör' },
    { id: '1360069068794626139', role: ROLES.DISCORD_DESTEK_EKIBI, name: 'Discord Destek Ekibi' },
    { id: '707582959766732872', role: ROLES.DISCORD_DESTEK_EKIBI, name: 'Discord Destek Ekibi' },
    { id: '1135248585802403901', role: ROLES.DISCORD_DESTEK_EKIBI, name: 'Discord Destek Ekibi' },
    { id: '760895784153251841', role: ROLES.DISCORD_DESTEK_EKIBI, name: 'Discord Destek Ekibi' },
    { id: '1375772029982085184', role: ROLES.DISCORD_DESTEK_EKIBI, name: 'Discord Destek Ekibi' }
]);

export const SEEDED_GOOGLE_ALLOWLIST = Object.freeze([
    { email: 'gearheadd0@gmail.com', role: ROLES.ADMIN, note: 'Lutheus Admin Seed' }
]);

export const OWNER_DISCORD_IDS = Object.freeze(['758769576778661989']);
export const OWNER_EMAILS = Object.freeze(['gearheadd0@gmail.com']);

export const ROLE_ORDER = Object.freeze([
    ROLES.YONETICI,
    ROLES.GENEL_SORUMLU,
    ROLES.DISCORD_YONETICISI,
    ROLES.KIDEMLI_DISCORD_MODERATORU,
    ROLES.DISCORD_MODERATORU,
    ROLES.DISCORD_DESTEK_EKIBI,
    ROLES.VIEWER,
    ROLES.PENDING,
    ROLES.BLOCKED
]);

const ADMIN_ROLES = new Set([
    ROLES.KURUCU,
    ROLES.ADMIN,
    ROLES.YONETICI,
    ROLES.GENEL_SORUMLU,
    ROLES.DISCORD_YONETICISI,
    ROLES.KIDEMLI,
    ROLES.KIDEMLI_DISCORD_MODERATORU,
    ROLES.SENIOR_MODERATOR
]);

function asciiRole(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, '_');
}

export function getDefaultRolePolicy() {
    return {
        version: 1,
        roleHierarchy: ROLE_ORDER,
        roleLabels: ROLE_LABELS,
        roleColors: ROLE_COLORS,
        seededRoleMembers: SEEDED_ROLE_MEMBERS,
        groqLimits: DEFAULT_GROQ_LIMITS,
        dynamicRules: null,
        updatedAt: new Date().toISOString()
    };
}

export function normalizeRole(role) {
    const normalized = String(role || ROLES.PENDING).trim().toLowerCase();
    const ascii = asciiRole(role);
    const aliases = {
        yönetici: ROLES.YONETICI,
        yonetici: ROLES.YONETICI,
        owner: ROLES.KURUCU,
        super_admin: ROLES.ADMIN,
        admin: ROLES.ADMIN,
        manager: ROLES.GENEL_SORUMLU,
        genel_sorumlu: ROLES.GENEL_SORUMLU,
        discord_yoneticisi: ROLES.DISCORD_YONETICISI,
        kıdemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kidemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kidemli_discord_moderatoru: ROLES.KIDEMLI_DISCORD_MODERATORU,
        senior_mod: ROLES.SENIOR_MODERATOR,
        senior_moderator: ROLES.SENIOR_MODERATOR,
        mod: ROLES.DISCORD_MODERATORU,
        moderator: ROLES.DISCORD_MODERATORU,
        discord_mod: ROLES.DISCORD_MODERATORU,
        discord_moderator: ROLES.DISCORD_MODERATORU,
        discord_moderatoru: ROLES.DISCORD_MODERATORU,
        support: ROLES.DISCORD_DESTEK_EKIBI,
        destek: ROLES.DISCORD_DESTEK_EKIBI,
        discord_destek_ekibi: ROLES.DISCORD_DESTEK_EKIBI
    };
    if (aliases[normalized]) return aliases[normalized];
    if (aliases[ascii]) return aliases[ascii];
    if (ROLE_LEVELS[normalized] !== undefined) return normalized;
    if (ROLE_LEVELS[ascii] !== undefined) return ascii;
    return ROLES.PENDING;
}

export function getRoleLevel(role) {
    return ROLE_LEVELS[normalizeRole(role)] ?? ROLE_LEVELS[ROLES.PENDING];
}

export function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || normalizeRole(role);
}

export function getRoleColor(role) {
    return ROLE_COLORS[normalizeRole(role)] || ROLE_COLORS[ROLES.VIEWER];
}

export function isPrivilegedRole(role) {
    return ADMIN_ROLES.has(normalizeRole(role));
}

export function isOwnerIdentity(identity = {}) {
    const discordId = String(identity.discordId || identity.discord_id || '').trim();
    const email = String(identity.email || '').trim().toLowerCase();
    return OWNER_DISCORD_IDS.includes(discordId) || OWNER_EMAILS.includes(email);
}

export function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[normalizeRole(role)] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

export function hasAllPermissions(role, permissions = []) {
    return permissions.every((permission) => hasPermission(role, permission));
}

export function canAccessRoute(role, routeKey) {
    const required = ROUTE_PERMISSIONS[routeKey];
    if (!required) return false;
    return hasAllPermissions(role, required);
}

export function canManageSystem(role) {
    return hasPermission(role, PERMISSIONS.SYSTEM_SETTINGS_UPDATE);
}

export function canEditCuk(role) {
    return hasPermission(role, PERMISSIONS.PENALTY_ACCURACY_UPDATE);
}

export function canAccessAdmin(role) {
    return hasPermission(role, PERMISSIONS.DASHBOARD_VIEW)
        || hasPermission(role, PERMISSIONS.STAFF_VIEW)
        || hasPermission(role, PERMISSIONS.PENALTY_ACCURACY_UPDATE)
        || hasPermission(role, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW)
        || hasPermission(role, PERMISSIONS.SYSTEM_SETTINGS_VIEW)
        || hasPermission(role, PERMISSIONS.AI_SETTINGS_VIEW)
        || hasPermission(role, PERMISSIONS.DISCORD_BOT_VIEW);
}

export function canRunAi(role) {
    return (DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0) > 0;
}

export function getDefaultGroqLimit(role) {
    return DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0;
}

export function getVisibleSections(role) {
    const norm = normalizeRole(role);
    if (norm === ROLES.PENDING || norm === ROLES.BLOCKED || norm === 'eski_yetkili') {
        return [];
    }
    if (isPrivilegedRole(role)) {
        return ['home', 'scan', 'stats', 'pointtrain', 'profile', 'settings'];
    }
    if (norm === ROLES.DISCORD_MODERATORU) {
        return ['home', 'stats', 'cezalar', 'profile'];
    }
    return ['home', 'cezalar', 'profile'];
}
