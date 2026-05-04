// Lutheus CezaRapor - Confidence Engine
// Data quality and reliability scoring system

export const ConfidenceEngine = {
    version: '1.0.0',

    // Confidence thresholds
    thresholds: {
        EXCELLENT: 90,   // Çok güvenilir
        GOOD: 70,        // Güvenilir
        ACCEPTABLE: 50,  // Kabul edilebilir
        QUESTIONABLE: 30 // Şüpheli
        // <30: Güvenilmez
    },

    // Weight factors for confidence calculation
    weights: {
        dataMissing: 0.25,        // Veri eksikliği
        selectorReliability: 0.25, // Selector güvenilirliği
        paginationSource: 0.20,    // Pagination kaynağı
        cacheUsage: 0.10,          // Cache kullanımı
        timeDrift: 0.10,           // Zaman sapması
        healthScore: 0.10          // Sistem sağlığı
    },

    /**
     * Calculate overall confidence score for a scan or report
     * @param {Object} factors - Confidence factors
     * @returns {{score: number, level: string, details: Object, recommendations: Array}}
     */
    calculateConfidence: function(factors) {
        const {
            dataMissing = 0,           // % of missing data (0-100)
            selectorFallback = false,  // Was fallback selector used?
            paginationSource = 'UI',   // 'UI', 'MATH', 'SAFE_LIMIT'
            cacheUsed = false,         // Was cached data used?
            timeDrift = 0,             // Time drift in ms
            healthScore = 100,         // System health (0-100)
            duplicatesFound = 0,       // Number of duplicate records
            errorsEncountered = 0      // Number of errors
        } = factors;

        let score = 100; // Start with perfect score
        const details = {};
        const penalties = [];
        const recommendations = [];

        // Factor 1: Data Missing (25% weight)
        if (dataMissing > 0) {
            const penalty = dataMissing * this.weights.dataMissing;
            score -= penalty;
            details.dataMissing = {
                percent: dataMissing,
                penalty: Math.round(penalty),
                impact: 'HIGH'
            };
            penalties.push(`${dataMissing}% veri eksik → -${Math.round(penalty)} puan`);
            
            if (dataMissing > 20) {
                recommendations.push('⚠️ Yüksek veri eksikliği - yeniden tarama önerilir');
            }
        }

        // Factor 2: Selector Reliability (25% weight)
        if (selectorFallback) {
            const penalty = 25 * this.weights.selectorReliability;
            score -= penalty;
            details.selectorReliability = {
                fallbackUsed: true,
                penalty: Math.round(penalty),
                impact: 'HIGH'
            };
            penalties.push(`Selector fallback kullanıldı → -${Math.round(penalty)} puan`);
            recommendations.push('🔍 Selector sistem güncellemesi gerekebilir');
        }

        // Factor 3: Pagination Source (20% weight)
        const paginationScores = {
            'UI_COMPONENT': { bonus: 20, reliability: 'HIGHEST' },
            'MATH_CALCULATION': { penalty: 10, reliability: 'MEDIUM' },
            'SAFE_LIMIT': { penalty: 30, reliability: 'LOW' }
        };

        const paginationScore = paginationScores[paginationSource] || paginationScores['SAFE_LIMIT'];
        
        if (paginationScore.penalty) {
            const penalty = paginationScore.penalty * this.weights.paginationSource;
            score -= penalty;
            details.paginationSource = {
                source: paginationSource,
                reliability: paginationScore.reliability,
                penalty: Math.round(penalty),
                impact: 'MEDIUM'
            };
            penalties.push(`Pagination: ${paginationSource} → -${Math.round(penalty)} puan`);
            
            if (paginationSource === 'SAFE_LIMIT') {
                recommendations.push('⚠️ Pagination algılanamadı - sayfa sayısı belirsiz');
            }
        } else if (paginationScore.bonus) {
            const bonus = paginationScore.bonus * this.weights.paginationSource;
            score += bonus;
            details.paginationSource = {
                source: paginationSource,
                reliability: paginationScore.reliability,
                bonus: Math.round(bonus),
                impact: 'POSITIVE'
            };
            penalties.push(`Pagination: UI'dan okundu → +${Math.round(bonus)} puan`);
        }

        // Factor 4: Cache Usage (10% weight)
        if (cacheUsed) {
            const penalty = 15 * this.weights.cacheUsage;
            score -= penalty;
            details.cacheUsage = {
                used: true,
                penalty: Math.round(penalty),
                impact: 'LOW'
            };
            penalties.push(`Cache kullanıldı → -${Math.round(penalty)} puan`);
            recommendations.push('ℹ️ Güncel veri için canlı tarama yapın');
        }

        // Factor 5: Time Drift (10% weight)
        if (timeDrift > 60000) { // More than 1 minute
            const driftMinutes = Math.round(timeDrift / 60000);
            const penalty = Math.min(driftMinutes * 2, 20) * this.weights.timeDrift;
            score -= penalty;
            details.timeDrift = {
                driftMs: timeDrift,
                driftMinutes,
                penalty: Math.round(penalty),
                impact: 'MEDIUM'
            };
            penalties.push(`Zaman sapması: ${driftMinutes} dakika → -${Math.round(penalty)} puan`);
            recommendations.push('🕐 Zaman senkronizasyonu gerekebilir');
        }

        // Factor 6: Health Score (10% weight)
        if (healthScore < 100) {
            const healthPenalty = (100 - healthScore) * this.weights.healthScore;
            score -= healthPenalty;
            details.healthScore = {
                systemHealth: healthScore,
                penalty: Math.round(healthPenalty),
                impact: healthScore < 70 ? 'HIGH' : 'MEDIUM'
            };
            penalties.push(`Sistem sağlığı: ${healthScore}% → -${Math.round(healthPenalty)} puan`);
            
            if (healthScore < 70) {
                recommendations.push('🏥 Sistem sağlığı düşük - bakım gerekebilir');
            }
        }

        // Factor 7: Data Quality Issues
        if (duplicatesFound > 0) {
            const penalty = Math.min(duplicatesFound * 0.5, 10);
            score -= penalty;
            details.duplicates = {
                count: duplicatesFound,
                penalty: Math.round(penalty),
                impact: 'LOW'
            };
            penalties.push(`${duplicatesFound} duplike bulundu → -${Math.round(penalty)} puan`);
        }

        if (errorsEncountered > 0) {
            const penalty = Math.min(errorsEncountered * 2, 15);
            score -= penalty;
            details.errors = {
                count: errorsEncountered,
                penalty: Math.round(penalty),
                impact: 'MEDIUM'
            };
            penalties.push(`${errorsEncountered} hata → -${Math.round(penalty)} puan`);
            
            if (errorsEncountered > 5) {
                recommendations.push('❌ Yüksek hata oranı - sistem kontrolü gerekli');
            }
        }

        // Ensure score is within 0-100
        score = Math.max(0, Math.min(100, Math.round(score)));

        const level = this.getConfidenceLevel(score);

        return {
            score,
            level,
            details,
            penalties,
            recommendations,
            timestamp: Date.now()
        };
    },

    /**
     * Get confidence level based on score
     */
    getConfidenceLevel: function(score) {
        if (score >= this.thresholds.EXCELLENT) {
            return {
                level: 'EXCELLENT',
                label: 'Çok Güvenilir',
                color: '#2ecc71',
                emoji: '✅',
                description: 'Veri kalitesi mükemmel, güvenle kullanılabilir'
            };
        } else if (score >= this.thresholds.GOOD) {
            return {
                level: 'GOOD',
                label: 'Güvenilir',
                color: '#3498db',
                emoji: '✔️',
                description: 'Veri kalitesi iyi, normal kullanım için yeterli'
            };
        } else if (score >= this.thresholds.ACCEPTABLE) {
            return {
                level: 'ACCEPTABLE',
                label: 'Kabul Edilebilir',
                color: '#f39c12',
                emoji: '⚠️',
                description: 'Veri kullanılabilir ama dikkatli olunmalı'
            };
        } else if (score >= this.thresholds.QUESTIONABLE) {
            return {
                level: 'QUESTIONABLE',
                label: 'Şüpheli',
                color: '#e67e22',
                emoji: '⚡',
                description: 'Veri kalitesi düşük, yeniden tarama önerilir'
            };
        } else {
            return {
                level: 'UNRELIABLE',
                label: 'Güvenilmez',
                color: '#e74c3c',
                emoji: '❌',
                description: 'Veri güvenilir değil, kullanılmamalı'
            };
        }
    },

    /**
     * Check if confidence is acceptable for operations
     */
    isAcceptable: function(score) {
        return score >= this.thresholds.ACCEPTABLE;
    },

    /**
     * Check if confidence requires manual approval
     */
    requiresManualApproval: function(score) {
        return score < this.thresholds.GOOD;
    },

    /**
     * Generate confidence badge for UI
     */
    generateBadge: function(score) {
        const level = this.getConfidenceLevel(score);
        return {
            html: `
                <div class="confidence-badge" style="
                    background: ${level.color};
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                ">
                    <span>${level.emoji}</span>
                    <span>${level.label}: ${score}%</span>
                </div>
            `,
            tooltip: level.description
        };
    },

    /**
     * Generate detailed confidence report
     */
    generateReport: function(confidenceResult) {
        const { score, level, details, penalties, recommendations } = confidenceResult;

        const lines = [
            `📊 Güven Skoru Raporu`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `${level.emoji} Skor: ${score}/100 - ${level.label}`,
            `${level.description}`,
            ``
        ];

        if (penalties.length > 0) {
            lines.push(`📋 Skor Detayları:`);
            penalties.forEach(penalty => {
                lines.push(`  • ${penalty}`);
            });
            lines.push(``);
        }

        if (recommendations.length > 0) {
            lines.push(`💡 Öneriler:`);
            recommendations.forEach(rec => {
                lines.push(`  ${rec}`);
            });
            lines.push(``);
        }

        // Add action recommendations based on score
        lines.push(`🎯 Önerilen Aksiyon:`);
        if (score >= this.thresholds.EXCELLENT) {
            lines.push(`  ✅ Veri kalitesi mükemmel - güvenle kullanın`);
        } else if (score >= this.thresholds.GOOD) {
            lines.push(`  ✔️ Normal kullanım için yeterli`);
        } else if (score >= this.thresholds.ACCEPTABLE) {
            lines.push(`  ⚠️ Dikkatli kullanın, kritik kararlar için doğrulayın`);
        } else if (score >= this.thresholds.QUESTIONABLE) {
            lines.push(`  ⚡ Yeniden tarama yapın`);
            lines.push(`  ⚡ Manuel doğrulama gerekli`);
        } else {
            lines.push(`  ❌ Bu veriyi kullanmayın`);
            lines.push(`  ❌ Sistemi kontrol edin ve yeniden tarayın`);
        }

        return lines.join('\n');
    },

    /**
     * Track confidence trends over multiple scans
     */
    confidenceTrends: [],

    recordConfidence: function(scanId, score, factors) {
        this.confidenceTrends.push({
            scanId,
            score,
            factors,
            timestamp: Date.now()
        });

        // Keep last 50 records
        if (this.confidenceTrends.length > 50) {
            this.confidenceTrends.shift();
        }
    },

    /**
     * Analyze confidence trends
     */
    analyzeTrends: function() {
        if (this.confidenceTrends.length < 2) {
            return { trend: 'INSUFFICIENT_DATA', message: 'Yetersiz veri' };
        }

        const recent = this.confidenceTrends.slice(-10);
        const avgRecent = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
        
        const older = this.confidenceTrends.slice(-20, -10);
        const avgOlder = older.length > 0 
            ? older.reduce((sum, r) => sum + r.score, 0) / older.length 
            : avgRecent;

        const change = avgRecent - avgOlder;
        const percentChange = ((change / avgOlder) * 100).toFixed(1);

        let trend, emoji, message;
        if (change > 10) {
            trend = 'IMPROVING';
            emoji = '📈';
            message = `Güven skoru artıyor (+${percentChange}%)`;
        } else if (change < -10) {
            trend = 'DECLINING';
            emoji = '📉';
            message = `Güven skoru düşüyor (${percentChange}%)`;
        } else {
            trend = 'STABLE';
            emoji = '➡️';
            message = 'Güven skoru kararlı';
        }

        return {
            trend,
            emoji,
            message,
            avgRecent: Math.round(avgRecent),
            avgOlder: Math.round(avgOlder),
            change: Math.round(change),
            percentChange
        };
    },

    /**
     * Get confidence statistics
     */
    getStatistics: function() {
        if (this.confidenceTrends.length === 0) {
            return null;
        }

        const scores = this.confidenceTrends.map(t => t.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        const max = Math.max(...scores);

        return {
            total: this.confidenceTrends.length,
            average: Math.round(avg),
            min,
            max,
            latest: scores[scores.length - 1]
        };
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.ConfidenceEngine = ConfidenceEngine;
}

console.log('✅ Lutheus CezaRapor: Confidence Engine loaded');
