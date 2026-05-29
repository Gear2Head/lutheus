// Lutheus CezaRapor - CUK Engine (Ceza Uygulama Kitapçığı)
// Intelligent penalty validation system

export const CUK_VERSION = '1.0.0';

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
    if (!durationStr) return null;

    let str = durationStr.toLowerCase().trim();

    // Strip out remaining time indicator like "in 3 hours" or "kalan 5 dk" or "(in 3 hours)"
    const index = str.search(/\b(in|kalan)\b/i);
    if (index !== -1) {
        str = str.substring(0, index).trim();
    }
    // Also remove any trailing open parenthesis left behind, e.g. "1 day ("
    str = str.replace(/\s*\(\s*$/, '').trim();

    // Özel durum: Süresiz / Ban
    if (str.includes('süresiz') || str.includes('perma') || str.includes('sonsuz') || str.includes('perm') || str.includes('belirsiz')) {
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

// CUK Kuralları - Temel yapı (kullanıcı tarafından güncellenebilir)
export const CUK_RULES = {
    // Direkt hatalı sayılacak durumlar
    autoInvalid: {
        emptyReason: true,          // Boş sebep
        keywords: [                  // Bu kelimeler içeriyorsa
            'hatalı ceza',
            'ceza değiştirildi',
            'yanlış ceza',
            'iptal edildi',
            'ceza iptali'
        ]
    },

    // Ceza kategorileri ve kuralları
    // Ceza kategorileri ve kuralları
    categories: {
        'Yetkililere Saygısızlık': {
            keywords: ['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'üst yönetim', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'],
            repeats: {
                1: { duration: 720, type: 'mute' },  // 12 Saat
                2: { duration: 1440, type: 'mute' }, // 24 Saat
                3: { duration: 2880, type: 'mute' }, // 48 Saat
                4: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Oyunculara Saygısızlık': {
            keywords: ['oyuncu', 'şahsa', 'kişiye', 'üyeye', 'saygısızlık', 'hakaret'],
            degrees: [
                {
                    degree: 1, // Şahsa edilmiş hakaret
                    keywords: ['şahsa hakaret', '1. derece saygısızlık', 'sahsa edilmis hakaret'],
                    repeats: {
                        1: { duration: 720, type: 'mute' },  // 12 Saat
                        2: { duration: 1440, type: 'mute' }, // 24 Saat
                        3: { duration: 2880, type: 'mute' }, // 48 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2, // Ailevi değerler
                    keywords: ['ailevi', '2. derece saygısızlık', 'aileye'],
                    repeats: {
                        1: { duration: 360, type: 'mute' }, // 6 Saat
                        2: { duration: 720, type: 'mute' }, // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 3, // Rahatsız edici davranış/troll
                    keywords: ['rahatsız edici', 'troll', '3. derece saygısızlık', 'trol', 'huzur bozma', 'rahatsızlık'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },  // 6 Saat
                        2: { duration: 720, type: 'mute' },  // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 4, // Kitleye hakaret
                    keywords: ['kitleye hakaret', '4. derece saygısızlık'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },  // 6 Saat
                        2: { duration: 720, type: 'mute' },  // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Küfür/Hakaret': {
            keywords: ['küfür', 'argo', 'uygunsuz', 'kelime', 'mesaj', 'içerik'],
            degrees: [
                {
                    degree: 1, // Yöneltme olmayan hakaret
                    keywords: ['yöneltme olmayan', '1. derece küfür'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2, // Cinsellik
                    keywords: ['cinsellik', '2. derece küfür', 'sex', 'nsfw', 'cinsel'],
                    repeats: {
                        1: { duration: 720, type: 'mute' }, // 12 Saat
                        2: { duration: 1440, type: 'mute' }, // 24 Saat
                        3: { duration: 2880, type: 'mute' }, // 48 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Dini/Milli Değerler': {
            keywords: ['dini değer', 'milli değer', 'kutsal', 'atatürk', 'din', 'milli', 'kutsala'],
            repeats: {
                1: { duration: 10080, type: 'mute' }, // 7 Gün
                2: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Sunucu Dinamiği': {
            keywords: ['sunucu dinamiği', 'dinamik', 'sunucu düzeni', 'kanalın amacı', 'ekran', ' flood'],
            degrees: [
                {
                    degree: 1, // Amacı dışında kullanım
                    keywords: ['amacı dışında', 'görsel odası', '1. derece dinamik', 'kanalın amacı'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 2, // Markaya zarar
                    keywords: ['markasına zarar', 'adalances zarar', '2. derece dinamik', 'markaya', 'marka'],
                    repeats: {
                        1: { duration: 1440, type: 'mute' }, // 24 Saat
                        2: { duration: 2880, type: 'mute' }, // 48 Saat
                        3: { duration: 5760, type: 'mute' }, // 96 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 3, // Yanlış/yanıltıcı bilgi
                    keywords: ['yanlış bilgi', 'yanıltıcı bilgi', '3. derece dinamik', 'yanlış'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },  // 6 Saat
                        2: { duration: 720, type: 'mute' },  // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 4, // Polemik (dini/milli/ırki/siyasi)
                    keywords: ['polemik', 'siyasi', 'ırki', '4. derece dinamik', 'ırki', 'politika', 'siyaset'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },  // 6 Saat
                        2: { duration: 720, type: 'mute' },  // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 5, // Sohbet bütünlüğü/Flood/Embed
                    keywords: ['flood', 'latin alfabesi dışı', 'embed', '5. derece dinamik', 'bütünlüğü', 'harf uzatma', 'capstalk', 'spam'],
                    repeats: {
                        1: { duration: 15, type: 'mute' }, 2: { duration: 30, type: 'mute' }, 3: { duration: 60, type: 'mute' },
                        4: { duration: 120, type: 'mute' }, 5: { duration: 240, type: 'mute' }, 6: { duration: 480, type: 'mute' },
                        7: { duration: 960, type: 'mute' }, 8: { duration: 1920, type: 'mute' }, 9: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 6, // Kampanya başlatmak
                    keywords: ['kampanya', '6. derece dinamik', 'kampanya başlatmak'],
                    repeats: {
                        1: { duration: 360, type: 'mute' },  // 6 Saat
                        2: { duration: 720, type: 'mute' },  // 12 Saat
                        3: { duration: 1440, type: 'mute' }, // 24 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                },
                {
                    degree: 7, // Yönetime etiket
                    keywords: ['yönetime etiket', 'admin etiket', '7. derece dinamik', 'yetkiliye etiket', 'etiketleme'],
                    repeats: {
                        1: { duration: 180, type: 'mute' }, // 3 Saat
                        2: { duration: 360, type: 'mute' }, // 6 Saat
                        3: { duration: 720, type: 'mute' }, // 12 Saat
                        4: { type: 'ban', notes: 'Kısıtlama' }
                    }
                }
            ]
        },
        'Reklam': {
            keywords: ['reklam', 'davet linki', 'discord.gg', 'youtube.com', 'üye çekme', 'minecraft sunucusu'],
            repeats: {
                1: { duration: 1440, type: 'mute' }, // 24 Saat / 1 Gün
                2: { type: 'ban', notes: 'Kısıtlama' }
            }
        },
        'Destek Talebi': {
            keywords: ['destek talebi', 'bilet', 'ticket', 'ticket troll', 'tekrarlı bilet'],
            degrees: [
                {
                    degree: 1, // Devamlı bilet açımı
                    keywords: ['tekrarlı bilet', 'aynı konu', 'bilet açımı'],
                    repeats: { 1: { duration: 60, type: 'mute' } } // 1 Saat
                },
                {
                    degree: 2, // Uygunsuz üslup / troll
                    keywords: ['uygunsuz üslup', 'üslup', 'troll', 'destek troll'],
                    repeats: { 1: { duration: 1440, type: 'mute' } } // 24 Saat
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

// CUK Engine
export const CUKEngine = {
    version: CUK_VERSION,
    rules: { ...CUK_RULES },

    /**
     * Güncel kuralları yükle (Storage'dan gelir)
     */
    setRules(dynamicRules) {
        if (!dynamicRules) return;

        // Deep merge logic simplified for categories
        if (dynamicRules.categories) {
            this.rules.categories = { ...CUK_RULES.categories, ...dynamicRules.categories };
        }

        if (dynamicRules.autoInvalid) {
            this.rules.autoInvalid = { ...CUK_RULES.autoInvalid, ...dynamicRules.autoInvalid };
        }
    },

    /**
     * Sebebi normalize et (Benzerleri birleştir)
     * @param {string} reason 
     * @returns {string}
     */
    normalizeReason(reason) {
        if (!reason) return 'Belirtilmemiş';

        // Temizle ve küçük harfe çevir
        let normalized = reason.toLowerCase().trim();

        // Derece ve tekrar bilgilerini temizle (Grup yapmak için)
        normalized = normalized.replace(/\d+\.\s*derece/i, '').replace(/d\d+/i, '');
        normalized = normalized.replace(/\d+\.\s*tekrar/i, '').replace(/t\d+/i, '').replace(/x\d+/i, '');
        normalized = normalized.replace(/\d+x/i, '');

        // Fazla boşlukları temizle
        normalized = normalized.replace(/\s+/g, ' ').trim();

        // İlk harfi büyüt (Okunabilirlik için)
        if (normalized.length > 0) {
            normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        } else {
            normalized = 'Diğer';
        }

        return normalized;
    },

    /**
     * Ceza sebebinden kategori çıkar
     * @param {string} reason - Ceza sebebi
     * @returns {{category: string|null, degree: number|null, repeat: number|null}}
     */
    parseReason(reason) {
        if (!reason) return { category: null, degree: null, repeat: null };

        const lowerReason = reason.toLowerCase();

        // Derece tespiti
        let degree = null;
        const degreePatterns = [
            /(\d+)\.\s*derece/i,
            /derece\s*[:\-]?\s*(\d+)/i,
            /d(\d+)/i,
            /(\d+)x/i
        ];
        for (const pattern of degreePatterns) {
            const match = reason.match(pattern);
            if (match) {
                degree = parseInt(match[1]);
                break;
            }
        }

        // Tekrar tespiti
        let repeat = null;
        const repeatPatterns = [
            /(\d+)\.\s*tekrar/i,
            /tekrar\s*[:\-]?\s*(\d+)/i,
            /t(\d+)/i,
            /x(\d+)/i
        ];
        for (const pattern of repeatPatterns) {
            const match = reason.match(pattern);
            if (match) {
                repeat = parseInt(match[1]);
                break;
            }
        }

        // Kategori tespiti (Daha akıllı eşleşme)
        let category = null;

        // Priority to 'Yönetim'
        const mgmtKeywords = this.rules.categories['Yönetim']?.keywords || ['yönetim', 'onaylı', 'onayli', 'onay'];
        if (mgmtKeywords.some(kw => lowerReason.includes(kw))) {
            return { category: 'Yönetim', degree: null, repeat: null };
        }

        // Akıllı eşleşmeler (Zorunlu Kurallar)
        const sunucuDinamigiD5Keywords = [
            'sohbet bütünlüğünü bozacak davranış',
            'sohbetin bütünlüğünü bozacak davranış',
            'sohbet bütünlüğü',
            'bütünlüğünü bozacak',
            'spam',
            'flood',
            'harf uzatma',
            'latin alfabesi dışı',
            'embed'
        ];
        if (sunucuDinamigiD5Keywords.some(kw => lowerReason.includes(kw))) {
            return { category: 'Sunucu Dinamiği', degree: 5, repeat: repeat };
        }

        if (lowerReason.includes('kutsal') || lowerReason.includes('dini') || lowerReason.includes('milli') || lowerReason.includes('atatürk') || lowerReason.includes('dinlere')) {
            return { category: 'Dini/Milli Değerler', degree: null, repeat: repeat };
        }

        if (lowerReason.includes('markasına zarar') || lowerReason.includes('markaya zarar') || lowerReason.includes('lutheus markası') || lowerReason.includes('sunucuya/lutheus markasına')) {
            return { category: 'Sunucu Dinamiği', degree: 2, repeat: repeat };
        }

        // Skor tabanlı kategori seçimi
        const scores = {};
        for (const [cat, rule] of Object.entries(this.rules.categories)) {
            const keywords = rule.keywords || [];
            let score = 0;
            keywords.forEach(kw => {
                if (lowerReason.includes(kw.toLowerCase())) {
                    score += kw.length;
                }
            });

            if (rule.degrees) {
                rule.degrees.forEach(d => {
                    (d.keywords || []).forEach(dkw => {
                        if (lowerReason.includes(dkw.toLowerCase())) {
                            score += dkw.length * 1.5;
                        }
                    });
                });
            }

            if (score > 0) scores[cat] = score;
        }

        const sortedCats = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sortedCats.length > 0) {
            category = sortedCats[0][0];
        }

        return { category, degree, repeat };
    },

    /**
     * Cezayı doğrula
     * @param {Object} caseData - Case verisi
     * @returns {{status: string, reason: string, details: Object}}
     */
    validate(caseData) {
        const { reason: rawReason, duration, type, reviewStatus, note, evidenceText, description, proofText, raw } = caseData;
        const reason = typeof rawReason === 'object' && rawReason
            ? String(rawReason.raw || rawReason.normalized || '').trim()
            : String(rawReason || '').trim();
        const repeatIndex = caseData.repeatIndex !== undefined ? Number(caseData.repeatIndex) : null;

        // 0. Manuel Override Kontrolü
        if (reviewStatus && (reviewStatus === PenaltyStatus.VALID || reviewStatus === PenaltyStatus.INVALID)) {
            return {
                status: reviewStatus,
                reason: 'Manuel inceleme ile belirlendi',
                details: { rule: 'manualOverride', note }
            };
        }

        // 1. Boş sebep kontrolü
        if (!reason || reason.trim() === '') {
            return {
                status: PenaltyStatus.INVALID,
                reason: 'Ceza sebebi boş',
                details: { rule: 'autoInvalid.emptyReason' }
            };
        }

        // 2. Otomatik hatalı anahtar kelime kontrolü
        const lowerReason = reason.toLowerCase();
        for (const keyword of this.rules.autoInvalid.keywords) {
            if (lowerReason.includes(keyword)) {
                return {
                    status: PenaltyStatus.INVALID,
                    reason: `Otomatik hatalı: "${keyword}" ifadesi tespit edildi`,
                    details: { rule: 'autoInvalid.keywords', keyword }
                };
            }
        }

        // 3. Kategori bazlı kontrol
        const parsed = this.parseReason(reason);

        // Kategori bulunamadıysa manuel inceleme
        if (!parsed.category) {
            return {
                status: PenaltyStatus.PENDING,
                reason: 'Kategori tespit edilemedi',
                details: { parsed }
            };
        }

        const rule = this.rules.categories[parsed.category];
        if (!rule) {
            return { status: PenaltyStatus.PENDING, reason: 'Kural tanımı yok' };
        }

        // 3.1 Yönetim Kararı Kontrolü
        if (rule.type === 'approved' || parsed.category === 'Yönetim') {
            return {
                status: PenaltyStatus.VALID,
                reason: 'Yönetim onaylı işlem',
                details: { rule: 'managementApproval', category: 'Yönetim' }
            };
        }

        // 3.2 Akıllı Alt Derece Eşleşmesi (Kanıt, açıklama, not, vb. alanlardan alt ihlal/derece tespiti)
        let matchedDegree = parsed.degree;
        if (matchedDegree === null && rule.degrees) {
            const contextText = [
                evidenceText,
                description,
                note,
                proofText,
                typeof raw === 'string' ? raw : (raw && JSON.stringify(raw))
            ].filter(Boolean).join(' ').toLowerCase();

            for (const d of rule.degrees) {
                if (d.keywords && d.keywords.some(kw => contextText.includes(kw.toLowerCase()))) {
                    matchedDegree = d.degree;
                    break;
                }
            }
        }

        // 4. Süre ve Tür Kontrolü (Esnek Eşleşme)
        const durationMinutes = parseDuration(duration);
        const givenType = type ? type.toLowerCase() : 'unknown';
        const isPerma = durationMinutes === Infinity || durationMinutes > 50000000;

        // Beklenen olası cezalar listesi
        const possiblePenalties = [];

        // Hiyerarşiyi tarayarak olası süreleri/türleri topla
        const collectPossibilities = (r, specificDegree = null) => {
            const currentDegree = specificDegree !== null ? specificDegree : (r.degree || null);
            if (r.duration) possiblePenalties.push({ duration: r.duration, type: r.type || 'mute', degree: currentDegree });
            if (r.type === 'ban') possiblePenalties.push({ type: 'ban', degree: currentDegree });
            if (r.type === 'warn') possiblePenalties.push({ type: 'warn', degree: currentDegree });

            if (r.repeats) {
                if (repeatIndex && repeatIndex > 0) {
                    const keys = Object.keys(r.repeats).map(Number).sort((a, b) => a - b);
                    if (keys.length > 0) {
                        const targetKey = keys.includes(repeatIndex) ? repeatIndex : keys[keys.length - 1];
                        const rep = r.repeats[targetKey];
                        if (rep) {
                            if (rep.duration) possiblePenalties.push({ duration: rep.duration, type: rep.type || 'mute', degree: currentDegree });
                            if (rep.type === 'ban' || (rep.notes && (rep.notes.toLowerCase().includes('ban') || rep.notes.toLowerCase().includes('kısıtlama')))) {
                                possiblePenalties.push({ type: 'ban', degree: currentDegree });
                            }
                        }
                    }
                } else {
                    Object.values(r.repeats).forEach(rep => {
                        if (rep.duration) possiblePenalties.push({ duration: rep.duration, type: rep.type || 'mute', degree: currentDegree });
                        if (rep.type === 'ban' || (rep.notes && (rep.notes.toLowerCase().includes('ban') || rep.notes.toLowerCase().includes('kısıtlama')))) {
                            possiblePenalties.push({ type: 'ban', degree: currentDegree });
                        }
                    });
                }
            }
            if (r.degrees) {
                if (specificDegree !== null) {
                    const d = r.degrees.find(x => x.degree === specificDegree);
                    if (d) collectPossibilities(d, specificDegree);
                } else {
                    r.degrees.forEach(d => collectPossibilities(d, d.degree));
                }
            }
            if (r.flexible) {
                r.flexible.forEach(f => possiblePenalties.push({ ...f, degree: currentDegree }));
            }
            if (r.type === 'mute' && !r.duration && !r.repeats && !r.degrees) {
                possiblePenalties.push({ type: 'mute', degree: currentDegree });
            }
        };

        collectPossibilities(rule, matchedDegree);

        let match = false;
        let matchedPenalty = null;

        // 1. Ban/Perma kontrolü
        if (givenType.includes('ban') || isPerma) {
            matchedPenalty = possiblePenalties.find(p => p.type === 'ban');
            if (matchedPenalty) match = true;
        }

        // 2. Süreli ceza kontrolü
        if (!match && (durationMinutes || givenType !== 'unknown')) {
            matchedPenalty = possiblePenalties.find(p => {
                if (p.type && givenType !== 'unknown' && !givenType.includes(p.type)) return false;

                if (p.duration) {
                    if (!durationMinutes) return false;
                    const diff = Math.abs(p.duration - durationMinutes);
                    // 10% tolerance or up to 60 minutes difference
                    return diff <= 60 || (diff / p.duration) <= 0.10;
                }

                if (p.type === 'mute' && durationMinutes) return false;
                return p.type && givenType.includes(p.type);
            });
            if (matchedPenalty) match = true;
        }

        // 3.3 Dereceye ve Kategori Kuralına Göre Sonuç Oluşturma
        const multiDegreeCategories = [
            'Oyunculara Saygısızlık',
            'Küfür/Hakaret/Uygunsuz Öge İçerikli Mesaj',
            'Sunucu Dinamiğini Sarsmak',
            'Destek Talebi'
        ];

        if (match) {
            return {
                status: PenaltyStatus.VALID,
                reason: matchedDegree !== null ? 'Kategori, alt ihlal ve süre CUK ile uyumlu' : 'Süre ve tür kurallarla uyumlu',
                details: {
                    category: parsed.category,
                    degree: matchedDegree || (matchedPenalty ? matchedPenalty.degree : null),
                    repeat: repeatIndex
                }
            };
        } else {
            // Detaylı hata mesajı
            const expectedList = [...new Set(possiblePenalties.map(p => {
                if (p.type === 'ban') return 'Ban';
                if (p.duration) return formatDuration(p.duration);
                return p.type || 'Bilinmiyor';
            }))];

            const expected = expectedList.join(' veya ');
            const givenLabel = isPerma ? 'Süresiz' : formatDuration(durationMinutes);

            if (multiDegreeCategories.includes(parsed.category) && matchedDegree === null) {
                return {
                    status: PenaltyStatus.INVALID,
                    reason: "Verilen süre bu kategori altındaki hiçbir CUK süresiyle uyumlu değil",
                    details: {
                        category: parsed.category,
                        degree: null,
                        given: {
                            type: type || 'mute',
                            durationMinutes: durationMinutes
                        }
                    }
                };
            }

            return {
                status: PenaltyStatus.INVALID,
                reason: `Uyumsuz ceza: ${givenLabel} verilmiş. Beklenen: ${expected}`,
                details: { given: durationMinutes, expected: possiblePenalties }
            };
        }
    },

    /**
     * Performans skoru hesapla
     * Skor = (Doğru × 2) – (Hatalı × 3) – (Belirsiz × 1)
     * @param {Object} counts - {valid, invalid, pending}
     * @returns {{score: number, status: string, color: string}}
     */
    calculatePerformanceScore(counts) {
        const { valid = 0, invalid = 0, pending = 0 } = counts;
        const score = (valid * 2) - (invalid * 3) - (pending * 1);

        // Status belirleme
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

    /**
     * Hızlı kontrol - Tek tık analiz
     * @param {Object} caseData 
     * @returns {Object}
     */
    quickCheck(caseData) {
        const result = this.validate(caseData);
        return {
            ...result,
            icon: result.status === PenaltyStatus.VALID ? '✅' :
                result.status === PenaltyStatus.INVALID ? '❌' : '❓',
            color: result.status === PenaltyStatus.VALID ? '#2ecc71' :
                result.status === PenaltyStatus.INVALID ? '#e74c3c' : '#f39c12'
        };
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.CUKEngine = CUKEngine;
    window.PenaltyStatus = PenaltyStatus;
    window.PenaltyTypes = PenaltyTypes;
}
