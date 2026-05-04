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
    BLOCKED: 'blocked'
});

export const ROLE_LEVELS = Object.freeze({
    [ROLES.KURUCU]: 100,
    [ROLES.ADMIN]: 90,
    [ROLES.YONETICI]: 80,
    [ROLES.GENEL_SORUMLU]: 76,
    [ROLES.DISCORD_YONETICISI]: 74,
    [ROLES.KIDEMLI]: 70,
    [ROLES.KIDEMLI_DISCORD_MODERATORU]: 68,
    [ROLES.SENIOR_MODERATOR]: 65,
    [ROLES.MODERATOR]: 40,
    [ROLES.DISCORD_MODERATORU]: 40,
    [ROLES.SUPPORT]: 20,
    [ROLES.DISCORD_DESTEK_EKIBI]: 20,
    [ROLES.VIEWER]: 10,
    [ROLES.PENDING]: 0,
    [ROLES.BLOCKED]: -1
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
    { email: 'kadirbakis45@gmail.com', role: ROLES.ADMIN, note: 'Lutheus Owner' }
]);

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
    const normalized = String(role || ROLES.MODERATOR).trim().toLowerCase();
    const ascii = asciiRole(role);
    const aliases = {
        yönetici: ROLES.YONETICI,
        yonetici: ROLES.YONETICI,
        admin: ROLES.ADMIN,
        genel_sorumlu: ROLES.GENEL_SORUMLU,
        discord_yoneticisi: ROLES.DISCORD_YONETICISI,
        kıdemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kidemli: ROLES.KIDEMLI_DISCORD_MODERATORU,
        kidemli_discord_moderatoru: ROLES.KIDEMLI_DISCORD_MODERATORU,
        senior_moderator: ROLES.KIDEMLI_DISCORD_MODERATORU,
        moderator: ROLES.DISCORD_MODERATORU,
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
    return ROLES.DISCORD_MODERATORU;
}

export function getRoleLevel(role) {
    return ROLE_LEVELS[normalizeRole(role)] ?? ROLE_LEVELS[ROLES.DISCORD_MODERATORU];
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
    if (normalizeRole(role) === ROLES.DISCORD_MODERATORU) {
        return ['home', 'stats', 'profile'];
    }
    return ['home', 'profile'];
}
