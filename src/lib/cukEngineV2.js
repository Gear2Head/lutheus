// Lutheus CezaRapor - CUK Engine v2 (Human-Centric)
// Intelligent penalty validation with human authority and role-based behavior

export const CUK_VERSION = '2.0.0';

// Role Hierarchy (from lowest to highest authority)
export const Roles = {
    YETKILI: { id: 'yetkili', name: 'Yetkili', level: 1, color: '#95a5a6' },
    KIDEMLI: { id: 'kidemli', name: 'Kıdemli', level: 2, color: '#3498db' },
    YONETIM: { id: 'yonetim', name: 'Yönetim', level: 3, color: '#e67e22' },
    ADMIN: { id: 'admin', name: 'Admin', level: 4, color: '#e74c3c' }
};

// Penalty Status (Extended for CUK v2)
export const PenaltyStatus = {
    VALID: 'valid',                    // ✅ Doğru (CUK onayı)
    INVALID: 'invalid',                // ❌ Hatalı (CUK reddi)
    PENDING: 'pending',                // ❓ İncelenmemiş
    MANUAL_APPROVED: 'manual_approved', // ✅ Manuel Onay (İnsan)
    MANUAL_REJECTED: 'manual_rejected', // ❌ Manuel Red (İnsan)
    QUESTIONABLE: 'questionable',      // ⚠️ Şüpheli
    OVERRIDE: 'override',              // 🔓 Override (Server Rule)
    LOCKED: 'locked',                  // 🔒 Kilitli (Final Decision)
    UNKNOWN: 'unknown'                 // Belirsiz
};

// Decision Authority (Who made the decision)
export const DecisionAuthority = {
    CUK_AUTO: 'cuk_auto',           // CUK otomatik
    MANUAL_REVIEW: 'manual_review', // İnsan incelemesi
    SERVER_RULE: 'server_rule',     // Sunucu kuralı
    MANAGEMENT: 'management'        // Yönetim kararı
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

    const str = durationStr.toLowerCase().trim();

    // Özel durum: Süresiz / Ban
    if (str.includes('süresiz') || str.includes('perma') || str.includes('sonsuz') || str.includes('perm') || str.includes('belirsiz')) {
        return Infinity;
    }

    // Pattern: "20s", "1h", "2d", "1w", etc.
    const patterns = [
        { regex: /(\d+)\s*(sn|saniye|sec|seconds?|s)/i, multiplier: 1 / 60 },
        { regex: /(\d+)\s*(dk|dakika|min|minutes?|m)/i, multiplier: 1 },
        { regex: /(\d+)\s*(sa|saat|hour|hours?|h)/i, multiplier: 60 },
        { regex: /(\d+)\s*(g|gün|gun|day|days?|d)/i, multiplier: 60 * 24 },
        { regex: /(\d+)\s*(hf|hafta|week|weeks?|w)/i, multiplier: 60 * 24 * 7 },
        { regex: /(\d+)\s*(ay|month|months?)/i, multiplier: 60 * 24 * 30 },
        { regex: /(\d+)\s*(y|yıl|yil|sene|year|years?)/i, multiplier: 60 * 24 * 365 }
    ];

    let totalMinutes = 0;
    let found = false;

    for (const { regex, multiplier } of patterns) {
        const matches = str.matchAll(new RegExp(regex.source, 'gi'));
        for (const match of matches) {
            totalMinutes += parseInt(match[1]) * multiplier;
            found = true;
        }
    }

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

// CUK Base Rules (3-Layer: Core, Server, Manual)
export const CUK_RULES = {
    // Layer 1: Core Rules (Cannot be modified)
    core: {
        autoInvalid: {
            emptyReason: true,
            keywords: [
                'hatalı ceza',
                'ceza değiştirildi',
                'yanlış ceza',
                'iptal edildi',
                'ceza iptali'
            ]
        }
    },

    // Layer 2: Server Rules (Yönetim can add/modify)
    server: {},

    // Layer 3: Manual Exceptions (Case-specific overrides)
    manualExceptions: {}
};

// Default categories (can be overridden by server rules)
export const DEFAULT_CATEGORIES = {
    'Yetkililere Saygısızlık': {
        keywords: ['yetkili', 'adal', 'doğukan', 'admin', 'mod', 'üst yönetim', 'ekip', 'ismini kötüleme', 'aşağılama', 'iftira'],
        repeats: {
            1: { duration: 720, type: 'mute' },
            2: { duration: 1440, type: 'mute' },
            3: { duration: 2880, type: 'mute' },
            4: { type: 'ban', notes: 'Kısıtlama' }
        }
    },
    // ... (diğer kategoriler mevcut CUK'dan alınacak)
};

// CUK Engine v2
export const CUKEngine = {
    version: CUK_VERSION,
    rules: { ...CUK_RULES },
    categories: { ...DEFAULT_CATEGORIES },
    
    // Role-based behavior config
    roleBehavior: {
        YETKILI: {
            canOverride: false,
            trustLevel: 0.6,
            requiresApproval: true
        },
        KIDEMLI: {
            canOverride: true,
            trustLevel: 0.8,
            requiresApproval: false,
            canRequestExplanation: true
        },
        YONETIM: {
            canOverride: true,
            trustLevel: 1.0,
            canAddServerRules: true,
            canApproveAny: true
        },
        ADMIN: {
            canOverride: true,
            trustLevel: 1.0,
            canModifyCoreRules: false, // Even admin cannot modify core
            canAddServerRules: true,
            fullControl: true
        }
    },

    /**
     * Validate penalty with role-based behavior
     * @param {Object} caseData - Case data
     * @param {string} userRole - User's role (YETKILI, KIDEMLI, YONETIM, ADMIN)
     * @returns {{status: string, reason: string, authority: string, details: Object}}
     */
    validate: function(caseData, userRole = 'YETKILI') {
        const { reason, duration, type, reviewStatus, note, authorRole } = caseData;

        // PRIORITY 1: Manual Override Check (Human authority > CUK)
        if (reviewStatus && (reviewStatus === PenaltyStatus.MANUAL_APPROVED || reviewStatus === PenaltyStatus.MANUAL_REJECTED)) {
            return {
                status: reviewStatus,
                reason: 'Manuel inceleme ile belirlendi',
                authority: DecisionAuthority.MANUAL_REVIEW,
                details: { 
                    rule: 'manualOverride', 
                    note,
                    reviewedBy: caseData.reviewedBy || 'Unknown'
                },
                cukSilent: true // CUK sessize alındı
            };
        }

        // PRIORITY 2: Manual Exception Check (Case-specific override)
        const exception = this.rules.manualExceptions[caseData.id];
        if (exception) {
            return {
                status: PenaltyStatus.OVERRIDE,
                reason: exception.reason || 'Manuel istisna uygulandı',
                authority: DecisionAuthority.MANAGEMENT,
                details: {
                    exception,
                    approvedBy: exception.approvedBy
                },
                cukSilent: true
            };
        }

        // PRIORITY 3: Core Rules Check (Auto Invalid)
        if (!reason || reason.trim() === '') {
            return {
                status: PenaltyStatus.INVALID,
                reason: 'Ceza sebebi boş',
                authority: DecisionAuthority.CUK_AUTO,
                details: { rule: 'core.autoInvalid.emptyReason' }
            };
        }

        const lowerReason = reason.toLowerCase();
        for (const keyword of this.rules.core.autoInvalid.keywords) {
            if (lowerReason.includes(keyword)) {
                return {
                    status: PenaltyStatus.INVALID,
                    reason: `Otomatik hatalı: "${keyword}" ifadesi tespit edildi`,
                    authority: DecisionAuthority.CUK_AUTO,
                    details: { rule: 'core.autoInvalid.keywords', keyword }
                };
            }
        }

        // PRIORITY 4: Server Rules Check
        const serverRuleResult = this.checkServerRules(caseData, userRole);
        if (serverRuleResult) {
            return serverRuleResult;
        }

        // PRIORITY 5: Category-based Check (Default behavior)
        const categoryResult = this.checkCategoryRules(caseData, userRole, authorRole);
        return categoryResult;
    },

    /**
     * Check server-level custom rules
     */
    checkServerRules: function(caseData, userRole) {
        const { reason } = caseData;
        const lowerReason = reason.toLowerCase();

        // Check if any server rule matches
        for (const [ruleName, rule] of Object.entries(this.rules.server)) {
            const keywords = rule.keywords || [];
            const matchedKeyword = keywords.find(kw => lowerReason.includes(kw.toLowerCase()));

            if (matchedKeyword) {
                // Server rule matched
                const allowedDurations = rule.allowedDurations || [];
                const allowedTypes = rule.allowedPunishments || [];

                // Validate against server rule
                const durationMinutes = parseDuration(caseData.duration);
                const isPerma = durationMinutes === Infinity;

                // Check if duration is allowed
                const durationMatch = allowedDurations.some(d => {
                    if (d === 'SURESIZ' && isPerma) return true;
                    const expectedMin = parseDuration(d);
                    if (!expectedMin) return false;
                    const diff = Math.abs(expectedMin - durationMinutes);
                    return diff <= 5 || (diff / expectedMin) <= 0.05;
                });

                // Check if type is allowed
                const typeMatch = allowedTypes.some(t => 
                    caseData.type && caseData.type.toLowerCase().includes(t.toLowerCase())
                );

                if (durationMatch && typeMatch) {
                    return {
                        status: PenaltyStatus.VALID,
                        reason: `Sunucu kuralına uygun: ${ruleName}`,
                        authority: DecisionAuthority.SERVER_RULE,
                        details: {
                            rule: ruleName,
                            serverRule: rule,
                            note: rule.note
                        }
                    };
                }
            }
        }

        return null; // No server rule matched
    },

    /**
     * Check default category rules with role-based behavior
     */
    checkCategoryRules: function(caseData, userRole, authorRole) {
        const { reason, duration, type } = caseData;
        const parsed = this.parseReason(reason);

        // Category bulunamadıysa role-based decision
        if (!parsed.category) {
            return this.handleUnknownCategory(caseData, userRole, authorRole);
        }

        const rule = this.categories[parsed.category];
        if (!rule) {
            return this.handleUnknownCategory(caseData, userRole, authorRole);
        }

        // Yönetim Kararı Kontrolü
        if (rule.type === 'approved' || parsed.category === 'Yönetim') {
            return {
                status: PenaltyStatus.VALID,
                reason: 'Yönetim onaylı işlem',
                authority: DecisionAuthority.MANAGEMENT,
                details: { rule: 'managementApproval', category: 'Yönetim' }
            };
        }

        // Süre ve Tür Kontrolü (Esnek Eşleşme)
        const validationResult = this.validateDurationAndType(caseData, rule);

        // Role-based behavior for validation result
        if (validationResult.status === PenaltyStatus.INVALID) {
            return this.handleInvalidPenalty(caseData, validationResult, userRole, authorRole);
        }

        return validationResult;
    },

    /**
     * Handle unknown category based on role
     */
    handleUnknownCategory: function(caseData, userRole, authorRole) {
        const behavior = this.roleBehavior[userRole];

        if (!behavior) {
            return {
                status: PenaltyStatus.PENDING,
                reason: 'Kategori tespit edilemedi',
                authority: DecisionAuthority.CUK_AUTO,
                details: { requiresManualReview: true }
            };
        }

        // Yönetim seviyesi: Her şey kabul edilebilir
        if (userRole === 'YONETIM' || userRole === 'ADMIN') {
            return {
                status: PenaltyStatus.QUESTIONABLE,
                reason: 'Kategori belirsiz - yönetim incelemesi önerilir',
                authority: DecisionAuthority.CUK_AUTO,
                details: {
                    allowOverride: true,
                    trustLevel: behavior.trustLevel
                }
            };
        }

        // Kıdemli: Açıklama isteyebilir
        if (userRole === 'KIDEMLI') {
            return {
                status: PenaltyStatus.QUESTIONABLE,
                reason: 'Kategori belirsiz - açıklama gerekebilir',
                authority: DecisionAuthority.CUK_AUTO,
                details: {
                    canRequestExplanation: true,
                    trustLevel: behavior.trustLevel
                }
            };
        }

        // Yetkili: Onay gerektirir
        return {
            status: PenaltyStatus.PENDING,
            reason: 'Kategori tespit edilemedi - manuel onay gerekli',
            authority: DecisionAuthority.CUK_AUTO,
            details: {
                requiresApproval: true,
                trustLevel: behavior.trustLevel
            }
        };
    },

    /**
     * Handle invalid penalty based on role
     */
    handleInvalidPenalty: function(caseData, validationResult, userRole, authorRole) {
        const behavior = this.roleBehavior[userRole];

        // Yönetim/Admin can override
        if ((userRole === 'YONETIM' || userRole === 'ADMIN') && behavior.canOverride) {
            return {
                ...validationResult,
                status: PenaltyStatus.QUESTIONABLE, // Not invalid, questionable
                reason: validationResult.reason + ' (Yönetim override mümkün)',
                details: {
                    ...validationResult.details,
                    canOverride: true,
                    overrideAuthority: userRole
                }
            };
        }

        // Kıdemli can override with explanation
        if (userRole === 'KIDEMLI' && behavior.canOverride) {
            return {
                ...validationResult,
                status: PenaltyStatus.QUESTIONABLE,
                reason: validationResult.reason + ' (Kıdemli açıklama ile override edebilir)',
                details: {
                    ...validationResult.details,
                    canOverride: true,
                    requiresExplanation: true
                }
            };
        }

        // Yetkili cannot override
        return validationResult;
    },

    /**
     * Validate duration and type against rule
     */
    validateDurationAndType: function(caseData, rule) {
        const durationMinutes = parseDuration(caseData.duration);
        const givenType = caseData.type ? caseData.type.toLowerCase() : 'unknown';
        const isPerma = durationMinutes === Infinity || durationMinutes > 50000000;

        const possiblePenalties = [];

        const collectPossibilities = (r) => {
            if (r.duration) possiblePenalties.push({ duration: r.duration, type: r.type || 'mute' });
            if (r.type === 'ban') possiblePenalties.push({ type: 'ban' });
            if (r.type === 'warn') possiblePenalties.push({ type: 'warn' });

            if (r.repeats) {
                Object.values(r.repeats).forEach(rep => {
                    if (rep.duration) possiblePenalties.push({ duration: rep.duration, type: rep.type || 'mute' });
                    if (rep.type) possiblePenalties.push({ type: rep.type });
                    if (rep.notes && (rep.notes.toLowerCase().includes('ban') || rep.notes.toLowerCase().includes('kısıtlama'))) {
                        possiblePenalties.push({ type: 'ban' });
                    }
                });
            }
            if (r.degrees) {
                r.degrees.forEach(d => collectPossibilities(d));
            }
        };

        collectPossibilities(rule);

        let match = false;

        // Ban/Perma kontrolü
        if (givenType.includes('ban') || isPerma) {
            if (possiblePenalties.some(p => p.type === 'ban')) {
                match = true;
            }
        }

        // Süreli ceza kontrolü
        if (!match && (durationMinutes || givenType !== 'unknown')) {
            match = possiblePenalties.some(p => {
                if (p.type && givenType !== 'unknown' && !givenType.includes(p.type)) return false;

                if (p.duration) {
                    if (!durationMinutes) return false;
                    const diff = Math.abs(p.duration - durationMinutes);
                    return diff <= 5 || (diff / p.duration) <= 0.05;
                }

                if (p.type && givenType.includes(p.type)) return true;
                return false;
            });
        }

        if (match) {
            return {
                status: PenaltyStatus.VALID,
                reason: 'Süre ve tür kurallarla uyumlu',
                authority: DecisionAuthority.CUK_AUTO,
                details: { category: rule }
            };
        } else {
            const expectedList = [...new Set(possiblePenalties.map(p => {
                if (p.type === 'ban') return 'Ban';
                if (p.duration) return formatDuration(p.duration);
                return p.type || 'Bilinmiyor';
            }))];

            const expected = expectedList.join(' veya ');
            const givenLabel = isPerma ? 'Süresiz' : formatDuration(durationMinutes);

            return {
                status: PenaltyStatus.INVALID,
                reason: `Uyumsuz ceza: ${givenLabel} verilmiş. Beklenen: ${expected}`,
                authority: DecisionAuthority.CUK_AUTO,
                details: { given: durationMinutes, expected: possiblePenalties }
            };
        }
    },

    /**
     * Add server rule (Yönetim/Admin only)
     */
    addServerRule: function(ruleName, rule, userRole) {
        if (userRole !== 'YONETIM' && userRole !== 'ADMIN') {
            console.error('[CUKv2] Insufficient permissions to add server rule');
            return false;
        }

        this.rules.server[ruleName] = {
            ...rule,
            addedBy: userRole,
            addedAt: Date.now()
        };

        console.log('[CUKv2] Server rule added:', ruleName);
        return true;
    },

    /**
     * Add manual exception for specific case (Yönetim/Admin only)
     */
    addManualException: function(caseId, exception, userRole) {
        if (userRole !== 'YONETIM' && userRole !== 'ADMIN') {
            console.error('[CUKv2] Insufficient permissions to add exception');
            return false;
        }

        this.rules.manualExceptions[caseId] = {
            ...exception,
            approvedBy: userRole,
            approvedAt: Date.now()
        };

        console.log('[CUKv2] Manual exception added for case:', caseId);
        return true;
    },

    /**
     * Parse reason (from CUK v1)
     */
    parseReason: function(reason) {
        // ... (existing parseReason logic from CUK v1)
        return { category: null, degree: null, repeat: null };
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.CUKEngine = CUKEngine;
    window.PenaltyStatus = PenaltyStatus;
    window.PenaltyTypes = PenaltyTypes;
    window.Roles = Roles;
    window.DecisionAuthority = DecisionAuthority;
}

console.log('✅ Lutheus CezaRapor: CUK Engine v2 (Human-Centric) loaded');
