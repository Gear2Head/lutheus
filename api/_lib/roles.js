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
        admin: 'admin',
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

module.exports = { DEFAULT_GROQ_LIMITS, normalizeRole, canUseAi };
