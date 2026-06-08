import {
    matchesKeyword,
    normalizeMatchText,
    pickBestScoredCategory,
    scoreKeywordMatches
} from './ruleMatching.js';

export const CUK_VERSION = '1.0.0';

export const CUK_RULES = {
    autoInvalid: {
        emptyReason: true,
        keywords: [
            'hatalı ceza',
            'ceza değiştirildi',
            'yanlış ceza',
            'iptal edildi',
            'ceza iptali'
        ]
    },
    categories: {
        'Yetkililere Saygısızlık': {
            keywords: ['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'üst yönetim', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'],
            repeats: {
                1: { duration: 720, type: 'mute' },
                2: { duration: 1440, type: 'mute' },
                3: { duration: 2880, type: 'mute' },
                4: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Oyunculara Saygısızlık': {
            keywords: ['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret'],
            degrees: [
                {
                    degree: 1,
                    keywords: ['şahsa hakaret', '1. derece saygısızlık', 'sahsa edilmis hakaret'],
                    repeats: {
                        1: { duration: 180, type: 'mute' },
                        2: { duration: 360, type: 'mute' },
                        3: { duration: 720, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2,
                    keywords: ['ailevi', '2. derece saygısızlık', 'aileye'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },
                        2: { duration: 720, type: 'mute' },
                        3: { duration: 1440, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 3,
                    keywords: ['rahatsız edici', 'troll', '3. derece saygısızlık', 'trol', 'huzur bozma', 'rahatsızlık'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },
                        2: { duration: 720, type: 'mute' },
                        3: { duration: 1440, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 4,
                    keywords: ['kitleye hakaret', '4. derece saygısızlık'],
                    repeats: {
                        1: { duration: 720, type: 'mute' },
                        2: { duration: 1440, type: 'mute' },
                        3: { duration: 2880, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Küfür/Hakaret': {
            keywords: ['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik'],
            degrees: [
                {
                    degree: 1,
                    keywords: ['yöneltme olmayan', '1. derece küfür'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2,
                    keywords: ['cinsellik', '2. derece küfür', 'sex', 'nsfw', 'cinsel'],
                    repeats: {
                        1: { duration: 720, type: 'mute' },
                        2: { duration: 1440, type: 'mute' },
                        3: { duration: 2880, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Dini/Milli Değerler': {
            keywords: ['dini değer', 'milli değer', 'kutsal', 'atatürk', 'din', 'milli', 'kutsala'],
            repeats: {
                1: { duration: 10080, type: 'mute' },
                2: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Sunucu Dinamiği': {
            keywords: ['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', ' flood', 'flood', 'spam', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'bütünlüğünü bozacak'],
            degrees: [
                {
                    degree: 1,
                    keywords: ['amacı dışında', 'görsel odası', '1. derece dinamik', 'kanalın amacı'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2,
                    keywords: ['markasına zarar', 'adalances zarar', '2. derece dinamik', 'markaya', 'marka'],
                    repeats: {
                        1: { duration: 1440, type: 'mute' },
                        2: { duration: 2880, type: 'mute' },
                        3: { duration: 5760, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 3,
                    keywords: ['yanlış bilgi', 'yanıltıcı bilgi', '3. derece dinamik', 'yanlış'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },
                        2: { duration: 720, type: 'mute' },
                        3: { duration: 1440, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 4,
                    keywords: ['polemik', 'siyasi', 'ırki', '4. derece dinamik', 'ırki', 'politika', 'siyaset'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },
                        2: { duration: 720, type: 'mute' },
                        3: { duration: 1440, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 5,
                    keywords: ['flood', 'latin alfabesi dışı', 'embed', '5. derece dinamik', 'bütünlüğü', 'harf uzatma', 'capstalk', 'spam', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'bütünlüğünü bozacak'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 6,
                    keywords: ['kampanya', '6. derece dinamik', 'kampanya başlatmak'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },
                        2: { duration: 720, type: 'mute' },
                        3: { duration: 1440, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 7,
                    keywords: ['yönetime etiket', 'admin etiket', '7. derece dinamik', 'yetkiliye etiket', 'etiketleme'],
                    repeats: {
                        1: { duration: 180, type: 'mute' },
                        2: { duration: 360, type: 'mute' },
                        3: { duration: 720, type: 'mute' },
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Reklam': {
            keywords: ['reklam', 'davet linki', 'discord.gg', 'youtube.com', 'üye çekme', 'minecraft sunucusu'],
            repeats: {
                1: { duration: 1440, type: 'mute' },
                2: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Destek Talebi': {
            keywords: ['destek talebi', 'bilet', 'ticket', 'ticket troll', 'tekrarlı bilet'],
            degrees: [
                {
                    degree: 1,
                    keywords: ['tekrarlı bilet', 'aynı konu', 'bilet açımı'],
                    repeats: { 1: { duration: 60, type: 'mute' } }
                },
                {
                    degree: 2,
                    keywords: ['uygunsuz üslup', 'üslup', 'troll', 'destek troll'],
                    repeats: { 1: { duration: 1440, type: 'mute' } }
                }
            ]
        },
        'Yönetim': {
            keywords: ['yönetim kararı', 'yönetim onaylı', 'üst yönetim', 'admin kararı'],
            type: 'approved',
            notes: 'Yönetim onayı ile verilmiş özel ceza. Otomatik doğrulanmış sayılır.'
        },
        'Discord ToS': {
            type: 'ban',
            keywords: ['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör', '3. parti'],
            notes: 'Süresiz Kısıtlama'
        }
    }
};

// Ceza durumları
export const PenaltyStatus = {
    VALID: 'valid',       // ✅ Doğru
    INVALID: 'invalid',   // ❌ Hatalı
    PENDING: 'pending',   // ❓ İncelenmemiş
    LOCKED: 'locked',     // 🔒 Kilitli (Manuel)
    UNKNOWN: 'unknown'    // Belirsiz
};

export const PenaltyTypes = {
    BAN: { id: 'ban', name: 'Ban', icon: '⛔', color: '#ff4757' },
    KICK: { id: 'kick', name: 'Kick', icon: '👢', color: '#ffa502' },
    WARN: { id: 'warn', name: 'Warn', icon: '⚠️', color: '#ffdd59' },
    MUTE: { id: 'mute', name: 'Mute', icon: '🔇', color: '#5352ed' },
    TIMEOUT: { id: 'timeout', name: 'Timeout', icon: '⏰', color: '#3742fa' }
};

// Rütbe Tanımları (Hierarchy)
export const LUTHEUS_RANKS = {
    'kurucu': { id: 'kurucu', name: 'Kurucu', level: 100, color: '#ff4757', icon: '👑' },
    'admin': { id: 'admin', name: 'Yönetici', level: 80, color: '#ffa502', icon: '🛡️' },
    'senior_moderator': { id: 'senior_moderator', name: 'Kıdemli Moderatör', level: 60, color: '#2ed573', icon: '⚖️' },
    'moderator': { id: 'moderator', name: 'Moderatör', level: 40, color: '#70a1ff', icon: '👮' },
    'support': { id: 'support', name: 'Destek', level: 20, color: '#a4b0be', icon: '🤝' }
};

// Süre çevirici (string -> dakika)
export function parseDuration(durationStr) {
    if (durationStr === null || durationStr === undefined || durationStr === '') return null;
    if (typeof durationStr === 'number') return durationStr;

    let str = String(durationStr).toLowerCase().trim();

    // Strip out remaining time indicator like "in 3 hours" or "kalan 5 dk" or "(in 3 hours)"
    const index = str.search(/\b(in|kalan)\b/i);
    if (index !== -1) {
        str = str.substring(0, index).trim();
    }
    // Also remove any trailing open parenthesis left behind, e.g. "1 day ("
    str = str.replace(/\s*\(\s*$/, '').trim();

    // Özel durum: Süresiz / Ban
    if (str.includes('süresiz') || str.includes('perma') || str.includes('sonsuz') || str.includes('perm') || str.includes('belirsiz') || str.includes('kalıcı') || str.includes('kalici') || str.includes('permanent')) {
        return Infinity;
    }

    const patterns = [
        { regex: /(\d+)\s*(saniye|sec|seconds?|sn|s)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 1 / 60 },
        { regex: /(\d+)\s*(dakika|min|minutes?|dk|m)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 1 },
        { regex: /(\d+)\s*(saat|hours?|hour|sa|h)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 },
        { regex: /(\d+)\s*(gün|gun|days?|day|g|d)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 },
        { regex: /(\d+)\s*(hafta|weeks?|week|hf|w)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 7 },
        { regex: /(\d+)\s*(ay|months?|month)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 30 },
        { regex: /(\d+)\s*(yıl|yil|sene|years?|year|y)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 365 }
    ];

    let totalMinutes = 0;
    let found = false;

    for (const { regex, multiplier } of patterns) {
        const matches = [...str.matchAll(new RegExp(regex.source, 'gi'))];
        for (const match of matches) {
            totalMinutes += parseInt(match[1]) * multiplier;
            found = true;
        }
    }

    // fallback: if "99 years" etc. is given but not caught by simple patterns due to complex string
    if (str.includes('99 year') || str.includes('99 yıl') || str.includes('99 sene') || str.includes('99y')) return Infinity;

    return found ? totalMinutes : null;
}

// Süre formatlayıcı (dakika -> okunabilir string)
export function formatDuration(minutes) {
    if (minutes === null || minutes === undefined) return 'Belirsiz';
    if (minutes === Infinity || minutes > 50000000) return 'Süresiz';

    if (minutes < 1) return `${Math.round(minutes * 60)} saniye`;
    if (minutes < 60) return `${Math.round(minutes)} dakika`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)} saat`;
    if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))} gün`;
    if (minutes < 60 * 24 * 30) return `${Math.round(minutes / (60 * 24 * 7))} hafta`;
    if (minutes < 60 * 24 * 365) return `${Math.round(minutes / (60 * 24 * 30))} ay`;
    return `${Math.round(minutes / (60 * 24 * 365))} yıl`;
}

function normalizeTurkishText(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/I/g, 'ı')
        .replace(/İ/g, 'i')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .trim()
        .replace(/\s+/g, ' ');
}

export function getRuleDetails(reasonRaw) {
    const reason = normalizeTurkishText(reasonRaw);
    const match = (kwList) => kwList.some((k) => reason.includes(normalizeTurkishText(k)));

    // 1. Yönetim kararı
    if (match(['yönetim kararı', 'yönetim onaylı', 'üst yönetim', 'admin kararı'])) {
        return { category: 'Yönetim', degree: null, allowedMinutes: [] };
    }

    // Teyit Sistemi / Teyite Gelmemek
    if (match(['teyit', 'teyite gelmemek', 'teyitten kacmak', 'teyitten kaçmak'])) {
        return { category: 'Teyit', degree: null, allowedMinutes: [0] };
    }

    // Cezadan Kaçma
    if (match(['cezadan kacmak', 'cezadan kaçmak'])) {
        return { category: 'Cezadan Kaçma', degree: null, allowedMinutes: [0] };
    }

    // Yan Hesap Kullanımı
    if (match(['yan hesap', 'alt account', 'yanhesap'])) {
        return { category: 'Yan Hesap Kullanımı', degree: null, allowedMinutes: [0] };
    }

    // 2. Discord ToS
    if (match(['tos', 'discord terms', 'kural dışı', '13 yaş', 'terör', '3. parti', 'doxx', 'nsfw'])) {
        return { category: 'Discord ToS', degree: null, allowedMinutes: [0] };
    }

    // 3. Dini / Milli Değerler
    if (['dini', 'milli', 'kutsal', 'atatürk', 'kutsala', 'allah', 'peygamber', 'bayrak'].some((k) => {
        const normK = normalizeTurkishText(k);
        if (normK === 'din' && (reason.includes('dinamik') || reason.includes('dinamig') || reason.includes('dinamiğ') || reason.includes('dinamik'))) {
            return false;
        }
        return reason.includes(normK);
    })) {
        return { category: 'Dini/Milli Değerler', degree: null, allowedMinutes: [10080, 0] };
    }

    // 4. Reklam
    if (match(['reklam', 'davet linki', 'discord.gg', 'üye çekme'])) {
        return { category: 'Reklam', degree: null, allowedMinutes: [1440, 0] };
    }

    // 5. Destek Talebi
    if (match(['destek talebi', 'bilet', 'ticket'])) {
        if (match(['üslup', 'uygunsuz', 'troll'])) {
            return { category: 'Destek Talebi', degree: 2, allowedMinutes: [1440, 0] };
        }
        if (match(['tekrarlı', 'aynı konu', 'bilet açımı'])) {
            return { category: 'Destek Talebi', degree: 1, allowedMinutes: [60, 0] };
        }
        return { category: 'Destek Talebi', degree: null, allowedMinutes: [60, 1440, 0] };
    }

    // 6. Yetkililere Saygısızlık
    if (match(['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'])) {
        return { category: 'Yetkililere Saygısızlık', degree: null, allowedMinutes: [720, 1440, 2880, 0] };
    }

    // 7. Oyunculara Saygısızlık
    if (match(['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret', 'aptal', 'mal', 'salak', 'beyin yok', 'geri zekâlı', 'aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu', 'troll', 'toxic', 'toksik', 'rahatsız', 'kitle', 'topluluk', 'herkes'])) {
        if (match(['aile', 'ailevi', 'anne', 'baba', 'ananı', 'anneniz', 'orospu'])) {
            return { category: 'Oyunculara Saygısızlık', degree: 2, allowedMinutes: [360, 720, 1440, 0] };
        }
        if (match(['troll', 'toxic', 'toksik', 'rahatsız'])) {
            return { category: 'Oyunculara Saygısızlık', degree: 3, allowedMinutes: [360, 720, 1440, 0] };
        }
        if (match(['kitle', 'topluluk', 'herkes'])) {
            return { category: 'Oyunculara Saygısızlık', degree: 4, allowedMinutes: [720, 1440, 2880, 0] };
        }
        return { category: 'Oyunculara Saygısızlık', degree: 1, allowedMinutes: [180, 360, 720, 0] };
    }

    // 8. Küfür / Hakaret
    if (match(['cinsellik', 'cinsel', 'fantezi', 'sex', 'nsfw', 'sikerim', 'götünü', 'amını', 'şişe'])) {
        return { category: 'Küfür/Hakaret', degree: 2, allowedMinutes: [720, 1440, 2880, 0] };
    }
    if (match(['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik', 'amk', 'amınakoyum', 'hassiktir', 'vay amk'])) {
        return { category: 'Küfür/Hakaret', degree: 1, allowedMinutes: [15, 30, 60, 120, 240, 480, 960, 1920, 0] };
    }

    // 9. Sunucu Dinamiği
    if (match(['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', 'flood', 'spam', 'polemik', 'bütünlüğünü boz', 'harf uzatma', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'sohbet boz', 'bütünlük', 'kanal dışı', 'amacı dışında', 'protesto', 'yönetimistifa', 'istifa', 'etiket', 'etiketleme', 'kampanya', 'yalan', 'yanlış bilgi', 'yanıltıcı', 'marka', 'zarar'])) {
        if (match(['zarar', 'itibar', 'marka'])) {
            return { category: 'Sunucu Dinamiği', degree: 2, allowedMinutes: [1440, 2880, 5760, 0] };
        }
        if (match(['yalan', 'yanlış bilgi', 'yanıltıcı', 'kapanacak'])) {
            return { category: 'Sunucu Dinamiği', degree: 3, allowedMinutes: [360, 720, 1440, 0] };
        }
        if (match(['polemik', 'siyasi', 'politika', 'siyaset'])) {
            return { category: 'Sunucu Dinamiği', degree: 4, allowedMinutes: [360, 720, 1440, 0] };
        }
        if (match(['kampanya', 'protesto', 'istifa', 'yönetimistifa'])) {
            return { category: 'Sunucu Dinamiği', degree: 6, allowedMinutes: [360, 720, 1440, 0] };
        }
        if (match(['etiket', 'etiketleme'])) {
            return { category: 'Sunucu Dinamiği', degree: 7, allowedMinutes: [180, 360, 720, 0] };
        }
        if (match(['kanal dışı', 'amacı dışında', 'kanalın amacı', 'görsel odası'])) {
            return { category: 'Sunucu Dinamiği', degree: 1, allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0] };
        }
        if (match(['flood', 'spam', 'bütünlüğünü boz', 'harf uzatma', 'sohbet bütünlüğü', 'sohbetin bütünlüğü', 'sohbet boz', 'bütünlük', 'latin alfabesi dışı', 'embed'])) {
            return { category: 'Sunucu Dinamiği', degree: 5, allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0] };
        }
        // Generic fallback for Sunucu Dinamiği
        return {
            category: 'Sunucu Dinamiği',
            degree: null,
            allowedMinutes: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0],
        };
    }

    return { category: null, degree: null, allowedMinutes: [] };
}

const INVALID_KEYWORDS = [
    'hatalı ceza', 'ceza değiştirildi', 'yanlış ceza', 'iptal edildi', 'ceza iptali',
];

export function snapDurationForValidation(mins) {
    if (mins === null || mins === undefined || !Number.isFinite(mins) || mins <= 0) return mins ?? 0;
    if (mins % 60 === 59) return mins + 1;
    return mins;
}

export function isDurationAllowed(mins, allowed) {
    if (allowed.includes(mins)) return true;
    for (const a of allowed) {
        if (a > 0 && Math.abs(mins - a) <= 5) {
            return true;
        }
    }
    return false;
}

export function validateCase(reasonRaw, durationMinutes) {
    const reason = normalizeTurkishText(reasonRaw);
    const mins = snapDurationForValidation(durationMinutes || 0);

    if (!reason) {
        return { valid: false, score: 0, message: 'Ceza sebebi girilmemiş.', categoryMatched: 'Yok' };
    }

    for (const kw of INVALID_KEYWORDS) {
        if (reason.includes(normalizeTurkishText(kw))) {
            return { valid: false, score: 0, message: `İptal kelimesi içeriyor: ${kw}`, categoryMatched: 'İptal' };
        }
    }

    const rule = getRuleDetails(reasonRaw);

    if (!rule.category) {
        const placeholders = new Set([
            'ada', 'de', 'denem', 'deneme', 'test', 'tst', 'placeholder', 'bos', 'boslar', 'yok',
            'abc', 'denemeler', 'asdasd', 'qwerty', 'denemee', 'deneme123', '/', '...', '.', '..', '-', '_'
        ]);
        const isPlaceholder = placeholders.has(reason) || 
            /^[^a-z0-9]*$/i.test(reason) || 
            (reason.length <= 3);

        if (isPlaceholder) {
            return { valid: false, score: 0, message: 'Geçersiz veya placeholder ceza sebebi. CUK kitapçığına uygun açıklama girilmelidir.', categoryMatched: 'Diğer' };
        }

        return { valid: false, score: 0, message: 'Tanımlanamayan ceza kategorisi.', categoryMatched: 'Diğer' };
    }

    if (rule.category === 'Yönetim') {
        return { valid: true, score: 1.0, message: 'Yönetim inisiyatifi, kural onaylandı.', categoryMatched: 'Yönetim' };
    }

    if (isDurationAllowed(mins, rule.allowedMinutes)) {
        return { valid: true, score: 1.0, message: 'Süre ve tür kurallarla uyumlu.', categoryMatched: rule.category };
    }

    const formatMins = (m) => {
        if (m === 0) return 'Süresiz';
        if (m < 60) return `${m} dk`;
        if (m % 60 === 0) return `${m / 60} saat`;
        return `${m} dk`;
    };
    const expectedList = rule.allowedMinutes.map(formatMins).join(', ');
    const givenLabel = mins === 0 ? 'Süresiz' : formatMins(mins);
    return {
        valid: false,
        score: 0,
        message: `Geçersiz süre. Verilen: ${givenLabel}. İzin verilen süreler: ${expectedList}`,
        categoryMatched: rule.category
    };
}

export const CUKEngine = {
    version: CUK_VERSION,
    rules: { ...CUK_RULES },

    setRules(dynamicRules) {
        if (!dynamicRules) return;
        if (dynamicRules.categories) {
            this.rules.categories = { ...CUK_RULES.categories, ...dynamicRules.categories };
        }
        if (dynamicRules.autoInvalid) {
            this.rules.autoInvalid = { ...CUK_RULES.autoInvalid, ...dynamicRules.autoInvalid };
        }
    },

    normalizeReason(reason) {
        if (!reason) return 'Belirtilmemiş';
        let normalized = reason.toLowerCase().trim();
        normalized = normalized.replace(/\d+\.\s*derece/i, '').replace(/d\d+/i, '');
        normalized = normalized.replace(/\d+\.\s*tekrar/i, '').replace(/t\d+/i, '').replace(/x\d+/i, '');
        normalized = normalized.replace(/\d+x/i, '');
        normalized = normalized.replace(/\s+/g, ' ').trim();

        if (normalized.length > 0) {
            normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        } else {
            normalized = 'Diğer';
        }
        return normalized;
    },

    parseReason(reason) {
        const rule = getRuleDetails(reason);
        return {
            category: rule.category,
            degree: rule.degree,
            repeat: null
        };
    },

    validate(caseData) {
        const { reason: rawReason, duration, type, reviewStatus, note } = caseData;
        const reason = typeof rawReason === 'object' && rawReason
            ? String(rawReason.raw || rawReason.normalized || '').trim()
            : String(rawReason || '').trim();
        const durationMinutes = parseDuration(duration);

        if (reviewStatus && (reviewStatus === PenaltyStatus.VALID || reviewStatus === PenaltyStatus.INVALID)) {
            return {
                status: reviewStatus,
                reason: 'Manuel inceleme ile belirlendi',
                details: { rule: 'manualOverride', note }
            };
        }

        const result = validateCase(reason, durationMinutes);

        let status = PenaltyStatus.PENDING;
        if (result.categoryMatched === 'Yok') {
            status = PenaltyStatus.INVALID;
        } else if (result.categoryMatched === 'Diğer') {
            status = result.valid ? PenaltyStatus.VALID : PenaltyStatus.INVALID;
        } else {
            status = result.valid ? PenaltyStatus.VALID : PenaltyStatus.INVALID;
        }

        return {
            status: status,
            reason: result.message,
            details: {
                category: result.categoryMatched,
                givenDuration: durationMinutes
            }
        };
    },

    calculatePerformanceScore(counts) {
        const { valid = 0, invalid = 0, pending = 0 } = counts;
        const score = (valid * 2) - (invalid * 3) - (pending * 1);

        let status, color;
        const total = valid + invalid + pending;
        const validPercent = total > 0 ? (valid / total) * 100 : 0;

        if (validPercent >= 95) {
            status = '🟢 Güvenilir';
            color = '#2ecc71';
        } else if (validPercent >= 80) {
            status = '🟡 İzlemede';
            color = '#f1c40f';
        } else {
            status = '🔴 Riskli';
            color = '#e74c3c';
        }

        return { score, status, color, validPercent: Math.round(validPercent) };
    },

    quickCheck(caseData) {
        const result = this.validate(caseData);
        return {
            ...result,
            icon: result.status === PenaltyStatus.VALID ? '✅' :
                result.status === PenaltyStatus.INVALID ? '❌' : '❓',
            color: result.status === PenaltyStatus.VALID ? '#2ecc71' :
                result.status === PenaltyStatus.INVALID ? '#e74c3c' : '#f39c12'
        };
    },

    getValidDurationsForCase(caseData = {}) {
        const reasonRaw = caseData.reason ?? caseData.reason_raw ?? '';
        const reason = typeof reasonRaw === 'object' && reasonRaw
            ? String(reasonRaw.raw || reasonRaw.normalized || '').trim()
            : String(reasonRaw || '').trim();
        const duration = caseData.duration ?? caseData.duration_raw ?? '';
        const durationMinutes = caseData.durationMinutes !== undefined
            ? caseData.durationMinutes
            : parseDuration(duration);

        const rule = getRuleDetails(reason);
        const result = validateCase(reason, durationMinutes);

        if (!rule.category) {
            return {
                category: null,
                degree: null,
                allowedMinutes: [],
                allowedLabels: [],
                minMinutes: null,
                maxMinutes: null,
                isPermanentAllowed: false,
                currentMinutes: durationMinutes,
                verdict: 'pending',
                message: result.message
            };
        }

        if (rule.category === 'Yönetim') {
            return {
                category: rule.category,
                degree: null,
                allowedMinutes: [],
                allowedLabels: ['Yönetim onayı — süre kısıtı yok'],
                minMinutes: null,
                maxMinutes: null,
                isPermanentAllowed: true,
                currentMinutes: durationMinutes,
                verdict: 'valid',
                message: result.message
            };
        }

        const allowedMinutes = rule.allowedMinutes.filter((m) => m > 0);
        const isPermanentAllowed = rule.allowedMinutes.includes(0);
        const allowedLabels = [
            ...allowedMinutes.map((m) => formatDuration(m)),
            ...(isPermanentAllowed ? ['Süresiz / Ban'] : [])
        ];

        let verdict = 'pending';
        if (result.valid) verdict = 'valid';
        else verdict = 'invalid';

        const finite = allowedMinutes.filter((m) => m > 0);
        return {
            category: rule.category,
            degree: rule.degree,
            allowedMinutes: rule.allowedMinutes,
            allowedLabels,
            minMinutes: finite.length ? Math.min(...finite) : null,
            maxMinutes: finite.length ? Math.max(...finite) : null,
            isPermanentAllowed,
            currentMinutes: durationMinutes,
            verdict,
            message: result.message
        };
    }
};

export function getValidDurationsForCase(caseData) {
    return CUKEngine.getValidDurationsForCase(caseData);
}

if (typeof window !== 'undefined') {
    window.CUKEngine = CUKEngine;
    window.PenaltyStatus = PenaltyStatus;
    window.PenaltyTypes = PenaltyTypes;
}
