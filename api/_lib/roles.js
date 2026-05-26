const ROLE_LEVELS = {
    kurucu: 100,
    admin: 90,
    yonetici: 80,
    genel_sorumlu: 76,
    discord_yoneticisi: 74,
    kidemli: 70,
    kidemli_discord_moderatoru: 68,
    senior_moderator: 65,
    moderator: 40,
    discord_moderatoru: 40,
    support: 20,
    discord_destek_ekibi: 20,
    viewer: 10,
    pending: 0,
    blocked: -1
};

const DEFAULT_GROQ_LIMITS = {
    kurucu: 500,
    admin: 350,
    yonetici: 250,
    genel_sorumlu: 225,
    discord_yoneticisi: 210,
    kidemli: 175,
    kidemli_discord_moderatoru: 160,
    senior_moderator: 150,
    moderator: 40,
    discord_moderatoru: 40,
    support: 10,
    discord_destek_ekibi: 10,
    viewer: 0,
    pending: 0,
    blocked: 0
};

const PERMISSIONS = {
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
};

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

const ROLE_PERMISSIONS = {
    kurucu: ['*'],
    admin: ['*'],
    yonetici: ['*'],
    genel_sorumlu: MANAGEMENT_PERMISSIONS,
    discord_yoneticisi: MANAGEMENT_PERMISSIONS,
    kidemli: MANAGEMENT_PERMISSIONS,
    kidemli_discord_moderatoru: MANAGEMENT_PERMISSIONS,
    senior_moderator: MANAGEMENT_PERMISSIONS,
    moderator: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW
    ],
    discord_moderatoru: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW
    ],
    support: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    discord_destek_ekibi: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    viewer: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    pending: [],
    blocked: []
};

function asciiRole(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^\w]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeRole(role) {
    const normalized = String(role || 'pending').trim().toLowerCase();
    const ascii = asciiRole(role);
    const aliases = {
        yonetici: 'yonetici',
        owner: 'kurucu',
        super_admin: 'admin',
        admin: 'admin',
        manager: 'genel_sorumlu',
        genel_sorumlu: 'genel_sorumlu',
        discord_yoneticisi: 'discord_yoneticisi',
        kidemli: 'kidemli_discord_moderatoru',
        kidemli_discord_moderatoru: 'kidemli_discord_moderatoru',
        senior_moderator: 'kidemli_discord_moderatoru',
        moderator: 'discord_moderatoru',
        discord_moderator: 'discord_moderatoru',
        discord_moderatoru: 'discord_moderatoru',
        support: 'discord_destek_ekibi',
        destek: 'discord_destek_ekibi',
        discord_destek_ekibi: 'discord_destek_ekibi',
        viewer: 'viewer',
        pending: 'pending',
        blocked: 'blocked'
    };
    if (aliases[normalized]) return aliases[normalized];
    if (aliases[ascii]) return aliases[ascii];
    if (ROLE_LEVELS[normalized] !== undefined) return normalized;
    if (ROLE_LEVELS[ascii] !== undefined) return ascii;
    return 'pending';
}

function canUseAi(role) {
    return (DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0) > 0;
}

function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[normalizeRole(role)] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

module.exports = { DEFAULT_GROQ_LIMITS, PERMISSIONS, ROLE_PERMISSIONS, normalizeRole, canUseAi, hasPermission };
