const ROLES = Object.freeze({
    KURUCU: 'kurucu',
    ADMIN: 'admin',
    YONETICI: 'yonetici',
    GENEL_SORUMLU: 'genel_sorumlu',
    DISCORD_YONETICISI: 'discord_yoneticisi',
    KIDEMLI_DISCORD_MODERATORU: 'kidemli_discord_moderatoru',
    DISCORD_MODERATORU: 'discord_moderatoru',
    DISCORD_DESTEK_EKIBI: 'discord_destek_ekibi',
    VIEWER: 'viewer',
    PENDING: 'pending',
    BLOCKED: 'blocked'
});

const PERMISSIONS = Object.freeze({
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
    PERMISSIONS.AUDIT_LOGS_VIEW,
    PERMISSIONS.DISCORD_BOT_VIEW
];

const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.KURUCU]: ['*'],
    [ROLES.ADMIN]: ['*'],
    [ROLES.YONETICI]: ['*'],
    [ROLES.GENEL_SORUMLU]: MANAGEMENT_PERMISSIONS,
    [ROLES.DISCORD_YONETICISI]: [...MANAGEMENT_PERMISSIONS, PERMISSIONS.DISCORD_BOT_UPDATE],
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: MANAGEMENT_PERMISSIONS,
    [ROLES.DISCORD_MODERATORU]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW
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

function asciiRole(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, '_');
}

function normalizeRole(role) {
    const normalized = String(role || ROLES.PENDING).trim().toLowerCase();
    const ascii = asciiRole(role);

    const aliases = {
        owner: ROLES.KURUCU,
        kurucu: ROLES.KURUCU,
        super_admin: ROLES.ADMIN,
        admin: ROLES.ADMIN,
        yonetici: ROLES.YONETICI,
        yönetici: ROLES.YONETICI,
        manager: ROLES.GENEL_SORUMLU,
        genel_sorumlu: ROLES.GENEL_SORUMLU,
        discord_yoneticisi: ROLES.DISCORD_YONETICISI,
        kidemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kıdemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kidemli_discord_moderatoru: ROLES.KIDEMLI_DISCORD_MODERATORU,
        senior_mod: ROLES.KIDEMLI_DISCORD_MODERATORU,
        senior_moderator: ROLES.KIDEMLI_DISCORD_MODERATORU,
        mod: ROLES.DISCORD_MODERATORU,
        moderator: ROLES.DISCORD_MODERATORU,
        discord_mod: ROLES.DISCORD_MODERATORU,
        discord_moderator: ROLES.DISCORD_MODERATORU,
        discord_moderatoru: ROLES.DISCORD_MODERATORU,
        support: ROLES.DISCORD_DESTEK_EKIBI,
        destek: ROLES.DISCORD_DESTEK_EKIBI,
        discord_destek_ekibi: ROLES.DISCORD_DESTEK_EKIBI,
        viewer: ROLES.VIEWER,
        pending: ROLES.PENDING,
        blocked: ROLES.BLOCKED
    };

    if (aliases[normalized]) return aliases[normalized];
    if (aliases[ascii]) return aliases[ascii];
    if (ROLE_PERMISSIONS[normalized]) return normalized;
    if (ROLE_PERMISSIONS[ascii]) return ascii;
    return ROLES.PENDING;
}

function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[normalizeRole(role)] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    normalizeRole,
    hasPermission
};
