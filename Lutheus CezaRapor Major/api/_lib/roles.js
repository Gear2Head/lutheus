const ROLE_LEVELS = {
    kurucu: 100,
    admin: 90,
    yonetici: 80,
    kidemli: 70,
    senior_moderator: 65,
    moderator: 40,
    support: 20,
    viewer: 10,
    pending: 0,
    blocked: -1
};

const DEFAULT_GROQ_LIMITS = {
    kurucu: 500,
    admin: 350,
    yonetici: 250,
    kidemli: 175,
    senior_moderator: 150,
    moderator: 40,
    support: 10,
    viewer: 0,
    pending: 0,
    blocked: 0
};

function normalizeRole(role) {
    const normalized = String(role || 'moderator').trim().toLowerCase();
    if (normalized === 'yönetici') return 'yonetici';
    if (normalized === 'kıdemli') return 'kidemli';
    return ROLE_LEVELS[normalized] === undefined ? 'moderator' : normalized;
}

function canUseAi(role) {
    return (DEFAULT_GROQ_LIMITS[normalizeRole(role)] || 0) > 0;
}

module.exports = { DEFAULT_GROQ_LIMITS, normalizeRole, canUseAi };
