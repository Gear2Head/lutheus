const ROLES = Object.freeze({
    KURUCU: 'kurucu',
    ADMIN: 'admin',
    YONETICI: 'yonetici',
    GENEL_SORUMLU: 'genel_sorumlu',
    DISCORD_YONETICISI: 'discord_yoneticisi',
    KIDEMLI: 'kidemli',
    KIDEMLI_DISCORD_MODERATORU: 'kidemli_discord_moderatoru',
    SENIOR_MODERATOR: 'senior_moderator',
    DISCORD_MODERATORU: 'discord_moderatoru',
    DISCORD_DESTEK_EKIBI: 'discord_destek_ekibi',
    VIEWER: 'viewer',
    PENDING: 'pending',
    BLOCKED: 'blocked',
    ESKI_YETKILI: 'eski_yetkili'
});

const OWNER_DISCORD_IDS = Object.freeze(['758769576778661989']);
const OWNER_EMAILS = Object.freeze(['gearheadd0@gmail.com']);

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
    AI_SETTINGS_UPDATE: 'ai_settings:update',
    // SECTION: ACCESS_APPROVAL
    // PURPOSE: Separate permission for approving/rejecting staff access requests.
    STAFF_ACCESS_APPROVE: 'staff:access_approve',
    // SECTION: ANNOUNCEMENTS
    // PURPOSE: Separate permission for creating and publishing Discord announcements.
    ANNOUNCEMENT_MANAGE: 'announcement:manage'
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
    [ROLES.GENEL_SORUMLU]: ['*'],
    [ROLES.DISCORD_YONETICISI]: ['*'],
    [ROLES.KIDEMLI]: ['*'],
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: ['*'],
    [ROLES.SENIOR_MODERATOR]: ['*'],
    [ROLES.DISCORD_MODERATORU]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_REVIEW,
        PERMISSIONS.PENALTIES_VIEW,
        PERMISSIONS.BLACKLIST_VIEW,
        PERMISSIONS.AUDIT_LOGS_VIEW
    ],
    [ROLES.DISCORD_DESTEK_EKIBI]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.AUDIT_LOGS_VIEW
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.REPORTS_VIEW
    ],
    [ROLES.PENDING]: [],
    [ROLES.BLOCKED]: [],
    [ROLES.ESKI_YETKILI]: []
});

const DEFAULT_GROQ_LIMITS = Object.freeze({
    [ROLES.KURUCU]: 500,
    [ROLES.ADMIN]: 350,
    [ROLES.YONETICI]: 250,
    [ROLES.GENEL_SORUMLU]: 225,
    [ROLES.DISCORD_YONETICISI]: 210,
    [ROLES.KIDEMLI]: 175,
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: 160,
    [ROLES.SENIOR_MODERATOR]: 150,
    [ROLES.DISCORD_MODERATORU]: 40,
    [ROLES.DISCORD_DESTEK_EKIBI]: 10,
    [ROLES.VIEWER]: 0,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: 0,
    [ROLES.ESKI_YETKILI]: 0
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
        senior_mod: ROLES.SENIOR_MODERATOR,
        senior_moderator: ROLES.SENIOR_MODERATOR,
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
        blocked: ROLES.BLOCKED,
        eski_yetkili: ROLES.ESKI_YETKILI
    };

    if (aliases[normalized]) return aliases[normalized];
    if (aliases[ascii]) return aliases[ascii];
    if (ROLE_PERMISSIONS[normalized]) return normalized;
    if (ROLE_PERMISSIONS[ascii]) return ascii;
    return ROLES.PENDING;
}

function isOwnerIdentity(identity = {}) {
    const discordId = String(identity.discordId || identity.discord_id || '').trim();
    const email = String(identity.email || '').trim().toLowerCase();
    return OWNER_DISCORD_IDS.includes(discordId) || OWNER_EMAILS.includes(email);
}

function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[normalizeRole(role)] || [];
    return permissions.includes('*') || permissions.includes(permission);
}

const UST_YONETIM_ROLLERI = Object.freeze([
    ROLES.KURUCU,
    ROLES.ADMIN,
    ROLES.YONETICI,
    ROLES.GENEL_SORUMLU,
    ROLES.DISCORD_YONETICISI,
    ROLES.KIDEMLI,
    ROLES.KIDEMLI_DISCORD_MODERATORU,
    ROLES.SENIOR_MODERATOR
]);

function isUstYonetim(role) {
    const normalized = normalizeRole(role);
    return UST_YONETIM_ROLLERI.includes(normalized);
}

function getPermissionForRole(role) {
    const r = normalizeRole(role);
    if (r === ROLES.KURUCU) return { group: 'owner', level: 100 };
    if (r === ROLES.ADMIN) return { group: 'admin', level: 100 };
    if ([
        ROLES.YONETICI,
        ROLES.GENEL_SORUMLU,
        ROLES.DISCORD_YONETICISI,
        ROLES.SENIOR_MODERATOR,
        ROLES.KIDEMLI,
        ROLES.KIDEMLI_DISCORD_MODERATORU
    ].includes(r)) {
        return { group: 'management', level: 100 };
    }
    if (r === ROLES.DISCORD_MODERATORU) return { group: 'moderation', level: 50 };
    if (r === ROLES.DISCORD_DESTEK_EKIBI) return { group: 'support', level: 25 };
    if (r === ROLES.VIEWER) return { group: 'viewer', level: 10 };
    return { group: 'pending', level: 0 };
}

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    DEFAULT_GROQ_LIMITS,
    UST_YONETIM_ROLLERI,
    normalizeRole,
    isOwnerIdentity,
    hasPermission,
    isUstYonetim,
    getPermissionForRole
};

