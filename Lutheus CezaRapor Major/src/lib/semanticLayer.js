// Lutheus CezaRapor - Semantic Layer
// Transform raw numbers into meaningful insights with context

export const SemanticLayer = {
    version: '1.0.0',

    // Context patterns for interpretation
    contextPatterns: {
        CONCENTRATED: 'concentrated',   // Yoğun/concentrated
        DISTRIBUTED: 'distributed',     // Dağıtılmış
        BURST: 'burst',                // Ani patlama
        GRADUAL: 'gradual'             // Kademeli
    },

    // Semantic severity levels
    severityLevels: {
        NORMAL: { level: 0, label: 'Normal', color: '#2ecc71', emoji: '🟢' },
        ATTENTION: { level: 1, label: 'Dikkat', color: '#f39c12', emoji: '🟡' },
        WARNING: { level: 2, label: 'Uyarı', color: '#e67e22', emoji: '🟠' },
        ALARM: { level: 3, label: 'Alarm', color: '#e74c3c', emoji: '🔴' },
        CRITICAL: { level: 4, label: 'Kritik', color: '#c0392b', emoji: '🚨' }
    },

    /**
     * Analyze penalty context and generate semantic interpretation
     * @param {Object} data - Raw penalty data
     * @returns {Object} Semantic interpretation
     */
    interpretPenaltyContext: function(data) {
        const {
            count,              // Number of penalties
            staffCount,         // Number of staff involved
            timeSpanHours,      // Time span in hours
            isOffHours,         // Is it off-hours?
            historicalAverage,  // Historical average for comparison
            peakHour,           // Peak hour of activity
            hasNewStaff,        // New staff added recently?
            hasRuleUpdate,      // Rule update detected?
            hasEvent,           // Known event happening?
            raidDetected        // Raid pattern detected?
        } = data;

        // Calculate semantic score (0-1)
        const semanticScore = this.calculateSemanticScore(data);

        // Determine context pattern
        const pattern = this.determinePattern(data);

        // Determine severity
        const severity = this.determineSeverity(semanticScore, pattern, data);

        // Generate interpretation
        const interpretation = this.generateInterpretation({
            count,
            staffCount,
            timeSpanHours,
            pattern,
            severity,
            historicalAverage,
            isOffHours,
            hasNewStaff,
            hasRuleUpdate,
            hasEvent,
            raidDetected
        });

        // Generate actionable recommendations
        const actions = this.generateActions(severity, pattern, data);

        // Generate tags
        const tags = this.generateTags(data);

        return {
            semanticScore,
            pattern,
            severity,
            interpretation,
            actions,
            tags,
            rawData: data,
            timestamp: Date.now()
        };
    },

    /**
     * Calculate semantic score based on context
     */
    calculateSemanticScore: function(data) {
        const {
            count,
            staffCount = 1,
            timeSpanHours = 24,
            historicalAverage = 0
        } = data;

        // Base metrics
        const penaltiesPerStaff = count / staffCount;
        const penaltiesPerHour = count / timeSpanHours;
        
        // Context factors
        let score = 0;

        // Factor 1: Concentration (penalties per staff)
        if (penaltiesPerStaff > 20) {
            score += 0.4; // Very concentrated
        } else if (penaltiesPerStaff > 10) {
            score += 0.3;
        } else if (penaltiesPerStaff > 5) {
            score += 0.2;
        } else {
            score += 0.1; // Well distributed
        }

        // Factor 2: Speed (penalties per hour)
        if (penaltiesPerHour > 10) {
            score += 0.4; // Very fast
        } else if (penaltiesPerHour > 5) {
            score += 0.3;
        } else if (penaltiesPerHour > 2) {
            score += 0.2;
        } else {
            score += 0.1; // Normal pace
        }

        // Factor 3: Historical comparison
        if (historicalAverage > 0) {
            const ratio = count / historicalAverage;
            if (ratio > 3) {
                score += 0.2; // 3x above average
            } else if (ratio > 2) {
                score += 0.15;
            } else if (ratio > 1.5) {
                score += 0.1;
            } else if (ratio < 0.5) {
                score -= 0.1; // Below average (good)
            }
        }

        return Math.max(0, Math.min(1, score));
    },

    /**
     * Determine activity pattern
     */
    determinePattern: function(data) {
        const {
            count,
            staffCount = 1,
            timeSpanHours = 24
        } = data;

        const penaltiesPerStaff = count / staffCount;
        const penaltiesPerHour = count / timeSpanHours;

        // Burst: Many penalties, short time, few staff
        if (penaltiesPerHour > 10 && staffCount <= 2) {
            return {
                type: this.contextPatterns.BURST,
                label: 'Ani Patlama',
                description: 'Kısa sürede yoğun ceza aktivitesi'
            };
        }

        // Concentrated: Many penalties per staff
        if (penaltiesPerStaff > 10) {
            return {
                type: this.contextPatterns.CONCENTRATED,
                label: 'Yoğunlaşmış',
                description: 'Az sayıda yetkili üzerinde yoğunlaşma'
            };
        }

        // Distributed: Many staff, spread over time
        if (staffCount >= 5 && penaltiesPerHour < 5) {
            return {
                type: this.contextPatterns.DISTRIBUTED,
                label: 'Dağıtılmış',
                description: 'Çok sayıda yetkili, dengeli dağılım'
            };
        }

        // Gradual: Moderate pace
        return {
            type: this.contextPatterns.GRADUAL,
            label: 'Kademeli',
            description: 'Normal hızda artış'
        };
    },

    /**
     * Determine severity level
     */
    determineSeverity: function(semanticScore, pattern, data) {
        const {
            raidDetected,
            isOffHours,
            hasEvent,
            hasNewStaff,
            hasRuleUpdate
        } = data;

        // Critical: Raid detected + high score
        if (raidDetected && semanticScore > 0.6) {
            return this.severityLevels.CRITICAL;
        }

        // Alarm: High semantic score with concerning pattern
        if (semanticScore > 0.7 || (pattern.type === this.contextPatterns.BURST && semanticScore > 0.5)) {
            return this.severityLevels.ALARM;
        }

        // Warning: Moderate score + off-hours or suspicious pattern
        if (semanticScore > 0.5 && (isOffHours || pattern.type === this.contextPatterns.CONCENTRATED)) {
            return this.severityLevels.WARNING;
        }

        // Attention: Slightly elevated but explainable
        if (semanticScore > 0.4 || (semanticScore > 0.3 && !hasEvent && !hasNewStaff && !hasRuleUpdate)) {
            return this.severityLevels.ATTENTION;
        }

        // Normal: Low score or explainable increase
        return this.severityLevels.NORMAL;
    },

    /**
     * Generate human-readable interpretation
     */
    generateInterpretation: function(context) {
        const {
            count,
            staffCount,
            timeSpanHours,
            pattern,
            severity,
            historicalAverage,
            isOffHours,
            hasNewStaff,
            hasRuleUpdate,
            hasEvent,
            raidDetected
        } = context;

        const parts = [];

        // Main observation
        parts.push(`${count} ceza tespit edildi.`);

        // Pattern description
        parts.push(`Aktivite paterni: ${pattern.label} (${pattern.description}).`);

        // Staff context
        if (staffCount === 1) {
            parts.push(`Tüm cezalar tek yetkili tarafından verildi.`);
        } else {
            const penaltiesPerStaff = Math.round(count / staffCount);
            parts.push(`${staffCount} yetkili dahil (ortalama ${penaltiesPerStaff} ceza/yetkili).`);
        }

        // Time context
        const penaltiesPerHour = (count / timeSpanHours).toFixed(1);
        parts.push(`Aktivite hızı: ${penaltiesPerHour} ceza/saat.`);

        // Historical comparison
        if (historicalAverage > 0) {
            const ratio = (count / historicalAverage).toFixed(1);
            const percentChange = (((count - historicalAverage) / historicalAverage) * 100).toFixed(0);
            
            if (ratio >= 2) {
                parts.push(`⚠️ Tarihsel ortalamadan %${percentChange} yüksek (${ratio}x).`);
            } else if (ratio >= 1.5) {
                parts.push(`📈 Tarihsel ortalamadan %${percentChange} yüksek.`);
            } else if (ratio < 0.8) {
                parts.push(`📉 Tarihsel ortalamadan %${Math.abs(percentChange)} düşük.`);
            } else {
                parts.push(`➡️ Tarihsel ortalama ile uyumlu.`);
            }
        }

        // Context flags
        const contextFlags = [];
        if (raidDetected) contextFlags.push('🚨 Raid algılandı');
        if (isOffHours) contextFlags.push('🌙 Mesai dışı saat');
        if (hasNewStaff) contextFlags.push('👤 Yeni yetkili eklendi');
        if (hasRuleUpdate) contextFlags.push('📜 Kural güncellemesi var');
        if (hasEvent) contextFlags.push('🎯 Event zamanı');

        if (contextFlags.length > 0) {
            parts.push('');
            parts.push('🏷️ Bağlam: ' + contextFlags.join(', '));
        }

        return parts.join(' ');
    },

    /**
     * Generate actionable recommendations
     */
    generateActions: function(severity, pattern, data) {
        const actions = [];

        switch (severity.level) {
            case 4: // CRITICAL
                actions.push({
                    priority: 'URGENT',
                    icon: '🚨',
                    text: 'ACİL: Yönetim müdahalesi gerekli',
                    action: 'MANAGEMENT_INTERVENTION'
                });
                actions.push({
                    priority: 'URGENT',
                    icon: '🔍',
                    text: 'Detaylı inceleme başlat',
                    action: 'START_INVESTIGATION'
                });
                break;

            case 3: // ALARM
                actions.push({
                    priority: 'HIGH',
                    icon: '⚠️',
                    text: 'Yüksek artış tespit edildi',
                    action: 'ALERT_MANAGEMENT'
                });
                if (pattern.type === this.contextPatterns.CONCENTRATED) {
                    actions.push({
                        priority: 'HIGH',
                        icon: '👤',
                        text: 'İlgili yetkili ile görüşme yapın',
                        action: 'CONTACT_STAFF'
                    });
                }
                break;

            case 2: // WARNING
                actions.push({
                    priority: 'MEDIUM',
                    icon: '🟠',
                    text: 'Durumu izlemeye devam edin',
                    action: 'CONTINUE_MONITORING'
                });
                actions.push({
                    priority: 'MEDIUM',
                    icon: '📊',
                    text: 'Detaylı analiz yapın',
                    action: 'DETAILED_ANALYSIS'
                });
                break;

            case 1: // ATTENTION
                actions.push({
                    priority: 'LOW',
                    icon: '👁️',
                    text: 'Gözlem altında tutun',
                    action: 'OBSERVE'
                });
                if (data.hasNewStaff) {
                    actions.push({
                        priority: 'LOW',
                        icon: '📚',
                        text: 'Yeni yetkiliye eğitim verin',
                        action: 'STAFF_TRAINING'
                    });
                }
                break;

            case 0: // NORMAL
                actions.push({
                    priority: 'INFO',
                    icon: '✅',
                    text: 'Normal sınırlar içinde, aksiyon gerekmez',
                    action: 'NO_ACTION'
                });
                break;
        }

        // Pattern-specific actions
        if (pattern.type === this.contextPatterns.BURST && !data.hasEvent) {
            actions.push({
                priority: 'MEDIUM',
                icon: '🔍',
                text: 'Ani artışın nedenini araştırın',
                action: 'INVESTIGATE_SPIKE'
            });
        }

        return actions;
    },

    /**
     * Generate semantic tags
     */
    generateTags: function(data) {
        const tags = [];

        // Structural tags
        if (data.hasNewStaff) {
            tags.push({ type: 'STRUCTURAL', icon: '🔵', label: 'Yapısal - Yeni Yetkili' });
        }
        if (data.hasRuleUpdate) {
            tags.push({ type: 'STRUCTURAL', icon: '🔵', label: 'Yapısal - Kural Güncellemesi' });
        }

        // Operational tags
        if (data.hasEvent) {
            tags.push({ type: 'OPERATIONAL', icon: '🟡', label: 'Operasyonel - Event Zamanı' });
        }
        if (data.isOffHours) {
            tags.push({ type: 'OPERATIONAL', icon: '🟡', label: 'Operasyonel - Mesai Dışı' });
        }

        // Risk tags
        if (data.raidDetected) {
            tags.push({ type: 'RISK', icon: '🔴', label: 'Riskli - Raid Algılandı' });
        }

        // Add severity tag
        const severity = this.determineSeverity(
            this.calculateSemanticScore(data),
            this.determinePattern(data),
            data
        );
        tags.push({ 
            type: 'SEVERITY', 
            icon: severity.emoji, 
            label: severity.label 
        });

        return tags;
    },

    /**
     * Compare two contexts and generate insights
     */
    compareContexts: function(current, previous) {
        const currentInterpretation = this.interpretPenaltyContext(current);
        const previousInterpretation = this.interpretPenaltyContext(previous);

        const scoreDiff = currentInterpretation.semanticScore - previousInterpretation.semanticScore;
        const severityChange = currentInterpretation.severity.level - previousInterpretation.severity.level;

        const insights = [];

        // Score change
        if (Math.abs(scoreDiff) > 0.2) {
            const direction = scoreDiff > 0 ? 'arttı' : 'azaldı';
            const emoji = scoreDiff > 0 ? '📈' : '📉';
            insights.push(`${emoji} Semantik skor ${direction} (${(scoreDiff * 100).toFixed(0)}%)`);
        }

        // Severity change
        if (severityChange > 0) {
            insights.push(`🔺 Ciddiyet seviyesi yükseldi: ${previousInterpretation.severity.label} → ${currentInterpretation.severity.label}`);
        } else if (severityChange < 0) {
            insights.push(`🔽 Ciddiyet seviyesi düştü: ${previousInterpretation.severity.label} → ${currentInterpretation.severity.label}`);
        }

        // Pattern change
        if (currentInterpretation.pattern.type !== previousInterpretation.pattern.type) {
            insights.push(`🔄 Pattern değişti: ${previousInterpretation.pattern.label} → ${currentInterpretation.pattern.label}`);
        }

        return {
            current: currentInterpretation,
            previous: previousInterpretation,
            scoreDiff,
            severityChange,
            insights
        };
    },

    /**
     * Generate executive summary (one-liner)
     */
    generateExecutiveSummary: function(interpretation) {
        const { count, severity, pattern, actions } = interpretation;
        const primaryAction = actions.find(a => a.priority === 'URGENT' || a.priority === 'HIGH');

        const parts = [
            `${severity.emoji} ${count} ceza`,
            `${pattern.label.toLowerCase()} pattern`,
            severity.level >= 2 ? `${severity.label}` : null,
            primaryAction ? primaryAction.text.toLowerCase() : 'normal sınırlar içinde'
        ].filter(Boolean);

        return parts.join(', ');
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.SemanticLayer = SemanticLayer;
}

console.log('✅ Lutheus CezaRapor: Semantic Layer loaded');
