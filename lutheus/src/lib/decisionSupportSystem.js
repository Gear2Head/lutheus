// Lutheus CezaRapor - Decision Support & Audit Trail System
// Provides actionable recommendations and transparent report generation tracking

export const DecisionSupportSystem = {
    version: '1.0.0',

    /**
     * Analyze situation and provide actionable recommendations
     * @param {Object} context - Current situation context
     * @returns {Object} Decision support with recommendations
     */
    analyze: function(context) {
        const {
            anomaly,            // Anomaly detection result
            semantic,           // Semantic interpretation
            confidence,         // Confidence score
            health,             // System health
            historical,         // Historical data
            userRole            // User's role
        } = context;

        // Generate insights
        const insights = this.generateInsights(context);

        // Generate recommendations
        const recommendations = this.generateRecommendations(context, insights);

        // Determine urgency
        const urgency = this.calculateUrgency(context);

        // Generate action plan
        const actionPlan = this.generateActionPlan(recommendations, urgency);

        return {
            insights,
            recommendations,
            urgency,
            actionPlan,
            nextSteps: this.getNextSteps(actionPlan),
            timestamp: Date.now()
        };
    },

    /**
     * Generate insights from context
     */
    generateInsights: function(context) {
        const insights = [];

        // Insight 1: Source Analysis
        if (context.anomaly && context.anomaly.primarySource) {
            const source = context.anomaly.primarySource;
            insights.push({
                type: 'SOURCE',
                icon: '🎯',
                title: 'Kaynak Analizi',
                message: `Artışın %${source.percentage} kaynağı: ${source.name}`,
                severity: source.percentage > 80 ? 'HIGH' : 'MEDIUM'
            });
        }

        // Insight 2: Pattern Recognition
        if (context.semantic && context.semantic.pattern) {
            const pattern = context.semantic.pattern;
            insights.push({
                type: 'PATTERN',
                icon: '📊',
                title: 'Pattern Tespiti',
                message: pattern.description,
                severity: pattern.type === 'BURST' ? 'HIGH' : 'LOW'
            });
        }

        // Insight 3: Historical Context
        if (context.historical && context.historical.similarIncidents) {
            const similar = context.historical.similarIncidents[0];
            insights.push({
                type: 'HISTORICAL',
                icon: '📚',
                title: 'Geçmiş Referans',
                message: `Benzer durum: ${similar.date} - Sonuç: ${similar.outcome}`,
                severity: 'INFO'
            });
        }

        // Insight 4: Confidence Level
        if (context.confidence && context.confidence.score < 70) {
            insights.push({
                type: 'QUALITY',
                icon: '⚠️',
                title: 'Veri Kalitesi',
                message: `Güven skoru düşük (%${context.confidence.score}) - Sonuçlar dikkatle değerlendirilmeli`,
                severity: 'MEDIUM'
            });
        }

        // Insight 5: System Health
        if (context.health && context.health.score < 80) {
            insights.push({
                type: 'SYSTEM',
                icon: '🏥',
                title: 'Sistem Sağlığı',
                message: `Sistem sağlığı düşük (%${context.health.score}) - Sonuçlar etkilenmiş olabilir`,
                severity: 'HIGH'
            });
        }

        return insights;
    },

    /**
     * Generate recommendations
     */
    generateRecommendations: function(context, insights) {
        const recommendations = [];

        // Get severity level
        const maxSeverity = insights.reduce((max, i) => {
            const levels = { LOW: 1, INFO: 1, MEDIUM: 2, HIGH: 3 };
            return Math.max(max, levels[i.severity] || 0);
        }, 0);

        // Recommendation 1: Immediate Action
        if (maxSeverity >= 3) {
            recommendations.push({
                priority: 'IMMEDIATE',
                icon: '🚨',
                title: 'Acil Müdahale',
                description: 'Yüksek öncelikli durum tespit edildi',
                actions: [
                    'Yönetim ekibini bilgilendirin',
                    'Detaylı inceleme başlatın',
                    'İlgili yetkili ile iletişime geçin'
                ],
                estimatedTime: '15 dakika',
                roleRequired: 'YONETIM'
            });
        }

        // Recommendation 2: Investigation
        if (context.anomaly && context.anomaly.percentage > 30) {
            recommendations.push({
                priority: 'HIGH',
                icon: '🔍',
                title: 'Detaylı İnceleme',
                description: `%${context.anomaly.percentage} artış tespit edildi`,
                actions: [
                    'Cezaları tek tek inceleyin',
                    'Zaman dağılımını analiz edin',
                    'Sebep dağılımına bakın',
                    'Manuel doğrulama yapın'
                ],
                estimatedTime: '30 dakika',
                roleRequired: 'KIDEMLI'
            });
        }

        // Recommendation 3: Monitoring
        if (maxSeverity === 2) {
            recommendations.push({
                priority: 'MEDIUM',
                icon: '👁️',
                title: 'İzleme Devam Etsin',
                description: 'Durum izleme altına alınmalı',
                actions: [
                    'Önümüzdeki 24 saat izleyin',
                    'Benzer artış olursa müdahale edin',
                    'Haftalık karşılaştırma yapın'
                ],
                estimatedTime: 'Sürekli',
                roleRequired: 'YETKILI'
            });
        }

        // Recommendation 4: Documentation
        if (context.confidence && context.confidence.score >= 70) {
            recommendations.push({
                priority: 'LOW',
                icon: '📝',
                title: 'Dokümantasyon',
                description: 'Bulgular kayıt altına alınmalı',
                actions: [
                    'Rapor oluşturun',
                    'Önemli bulguları vurgulayın',
                    'Arşivleyin'
                ],
                estimatedTime: '10 dakika',
                roleRequired: 'YETKILI'
            });
        }

        // Recommendation 5: No Action
        if (maxSeverity < 2 && context.confidence && context.confidence.score >= 80) {
            recommendations.push({
                priority: 'INFO',
                icon: '✅',
                title: 'Aksiyon Gerekmiyor',
                description: 'Durum normal sınırlar içinde',
                actions: [
                    'Rutin takip yeterli'
                ],
                estimatedTime: '-',
                roleRequired: 'YETKILI'
            });
        }

        return recommendations;
    },

    /**
     * Calculate urgency level
     */
    calculateUrgency: function(context) {
        let urgencyScore = 0;

        // Factor 1: Semantic severity
        if (context.semantic && context.semantic.severity) {
            urgencyScore += context.semantic.severity.level * 20;
        }

        // Factor 2: Anomaly size
        if (context.anomaly && context.anomaly.percentage > 50) {
            urgencyScore += 30;
        }

        // Factor 3: Confidence (inverse - low confidence = high urgency)
        if (context.confidence && context.confidence.score < 50) {
            urgencyScore += 20;
        }

        // Factor 4: System health (inverse)
        if (context.health && context.health.score < 70) {
            urgencyScore += 15;
        }

        // Factor 5: User role capability
        if (context.userRole === 'YETKILI') {
            urgencyScore += 10; // Less capable = more urgent to escalate
        }

        const level = urgencyScore >= 80 ? 'CRITICAL' :
                     urgencyScore >= 60 ? 'HIGH' :
                     urgencyScore >= 40 ? 'MEDIUM' : 'LOW';

        return {
            score: Math.min(100, urgencyScore),
            level,
            color: this.getUrgencyColor(level),
            description: this.getUrgencyDescription(level)
        };
    },

    getUrgencyColor: function(level) {
        const colors = {
            'CRITICAL': '#e74c3c',
            'HIGH': '#e67e22',
            'MEDIUM': '#f39c12',
            'LOW': '#3498db'
        };
        return colors[level] || '#95a5a6';
    },

    getUrgencyDescription: function(level) {
        const descriptions = {
            'CRITICAL': 'Acil müdahale gerekli - Hemen harekete geçin',
            'HIGH': 'Yüksek öncelik - Bugün içinde aksiyons alın',
            'MEDIUM': 'Orta öncelik - 24-48 saat içinde değerlendirin',
            'LOW': 'Düşük öncelik - Rutin takip yeterli'
        };
        return descriptions[level] || 'Bilinmiyor';
    },

    /**
     * Generate action plan
     */
    generateActionPlan: function(recommendations, urgency) {
        const plan = {
            urgency,
            steps: [],
            timeline: {},
            responsibleParties: []
        };

        // Sort recommendations by priority
        const priorityOrder = { 'IMMEDIATE': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4, 'INFO': 5 };
        const sorted = recommendations.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        // Generate steps
        sorted.forEach((rec, index) => {
            plan.steps.push({
                order: index + 1,
                title: rec.title,
                priority: rec.priority,
                actions: rec.actions,
                estimatedTime: rec.estimatedTime,
                roleRequired: rec.roleRequired,
                completed: false
            });

            // Track responsible parties
            if (rec.roleRequired && !plan.responsibleParties.includes(rec.roleRequired)) {
                plan.responsibleParties.push(rec.roleRequired);
            }
        });

        // Generate timeline
        let cumulativeTime = 0;
        plan.steps.forEach(step => {
            const timeInMinutes = this.parseTimeToMinutes(step.estimatedTime);
            cumulativeTime += timeInMinutes;
            plan.timeline[step.order] = {
                start: cumulativeTime - timeInMinutes,
                end: cumulativeTime
            };
        });

        plan.totalEstimatedTime = this.formatMinutes(cumulativeTime);

        return plan;
    },

    parseTimeToMinutes: function(timeStr) {
        if (!timeStr || timeStr === '-' || timeStr === 'Sürekli') return 0;
        const match = timeStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : 15; // Default 15 min
    },

    formatMinutes: function(minutes) {
        if (minutes === 0) return 'Sürekli';
        if (minutes < 60) return `${minutes} dakika`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} saat ${mins} dakika` : `${hours} saat`;
    },

    /**
     * Get next steps summary
     */
    getNextSteps: function(actionPlan) {
        const immediate = actionPlan.steps.filter(s => s.priority === 'IMMEDIATE');
        const high = actionPlan.steps.filter(s => s.priority === 'HIGH');

        if (immediate.length > 0) {
            return {
                summary: `${immediate.length} acil adım var`,
                nextAction: immediate[0].title,
                timeframe: 'ŞİMDİ'
            };
        } else if (high.length > 0) {
            return {
                summary: `${high.length} yüksek öncelikli adım var`,
                nextAction: high[0].title,
                timeframe: 'BUGÜN İÇİNDE'
            };
        } else {
            return {
                summary: 'Rutin takip yeterli',
                nextAction: 'İzlemeye devam edin',
                timeframe: '24-48 SAAT'
            };
        }
    }
};

// ============================================
// AUDIT TRAIL SYSTEM
// ============================================

export const AuditTrailSystem = {
    version: '1.0.0',

    /**
     * Create audit trail for a report
     * @param {Object} reportData - Report configuration and results
     * @returns {Object} Audit trail
     */
    createAuditTrail: function(reportData) {
        const trail = {
            reportId: reportData.reportId || `report_${Date.now()}`,
            generatedAt: new Date().toISOString(),
            
            // Data sources
            dataSources: this.trackDataSources(reportData),
            
            // Filters applied
            filtersApplied: this.trackFilters(reportData),
            
            // Fallbacks used
            fallbacksUsed: this.trackFallbacks(reportData),
            
            // Data exclusions
            dataExclusions: this.trackExclusions(reportData),
            
            // Processing steps
            processingSteps: this.trackProcessing(reportData),
            
            // Quality metrics
            qualityMetrics: this.trackQuality(reportData),
            
            // Confidence score
            confidenceScore: reportData.confidence || null
        };

        return trail;
    },

    /**
     * Track data sources
     */
    trackDataSources: function(reportData) {
        const sources = [];

        if (reportData.scanSession) {
            sources.push({
                type: 'LIVE_SCRAPE',
                url: reportData.scanSession.config?.target?.url || 'dashboard.sapph.xyz',
                timestamp: reportData.scanSession.timestamp,
                rowsCollected: reportData.scanSession.results?.totalCases || 0,
                pagesScanned: reportData.scanSession.results?.pagesScanned || 0
            });
        }

        if (reportData.cachedData) {
            sources.push({
                type: 'CACHE',
                timestamp: reportData.cachedData.timestamp,
                age: Date.now() - reportData.cachedData.timestamp,
                rowsUsed: reportData.cachedData.count
            });
        }

        return sources;
    },

    /**
     * Track filters applied
     */
    trackFilters: function(reportData) {
        const filters = [];

        if (reportData.timeFilter) {
            filters.push({
                filter: 'timeRange',
                value: reportData.timeFilter.description,
                applied: true
            });
        }

        if (reportData.penaltyTypeFilter) {
            filters.push({
                filter: 'penaltyType',
                value: reportData.penaltyTypeFilter.join(', '),
                applied: true
            });
        }

        if (reportData.staffFilter) {
            filters.push({
                filter: 'staff',
                value: reportData.staffFilter.mode,
                details: reportData.staffFilter.names || [],
                applied: true
            });
        }

        return filters;
    },

    /**
     * Track fallbacks used
     */
    trackFallbacks: function(reportData) {
        const fallbacks = [];

        if (reportData.paginationResult && reportData.paginationResult.source !== 'UI_COMPONENT') {
            fallbacks.push({
                component: 'pagination',
                primary: 'UI_COMPONENT',
                fallback: reportData.paginationResult.source,
                reason: reportData.paginationResult.details?.reason || 'Primary method failed'
            });
        }

        if (reportData.selectorFallbacks) {
            reportData.selectorFallbacks.forEach(fb => {
                fallbacks.push({
                    component: 'selector',
                    primary: fb.primary,
                    fallback: fb.fallback,
                    reason: fb.reason
                });
            });
        }

        return fallbacks;
    },

    /**
     * Track data exclusions
     */
    trackExclusions: function(reportData) {
        const exclusions = [];

        if (reportData.duplicatesRemoved > 0) {
            exclusions.push({
                reason: 'DUPLICATE',
                count: reportData.duplicatesRemoved,
                example: reportData.duplicateExample || null
            });
        }

        if (reportData.invalidTimestamps > 0) {
            exclusions.push({
                reason: 'INVALID_TIMESTAMP',
                count: reportData.invalidTimestamps,
                example: reportData.invalidExample || null
            });
        }

        if (reportData.malformedRecords > 0) {
            exclusions.push({
                reason: 'MALFORMED_RECORD',
                count: reportData.malformedRecords
            });
        }

        return exclusions;
    },

    /**
     * Track processing steps
     */
    trackProcessing: function(reportData) {
        const steps = [];

        steps.push(`1. Scraped ${reportData.totalScraped || 0} cases from ${reportData.pagesScanned || 0} pages`);

        if (reportData.filtersApplied > 0) {
            steps.push(`2. Applied ${reportData.filtersApplied} filters → ${reportData.afterFilter || 0} cases remain`);
        }

        if (reportData.duplicatesRemoved > 0) {
            steps.push(`3. Removed ${reportData.duplicatesRemoved} duplicates → ${reportData.afterDedup || 0} cases`);
        }

        steps.push(`4. Grouped by staff → ${reportData.uniqueStaff || 0} unique moderators`);
        steps.push(`5. Calculated statistics`);
        steps.push(`6. Generated visualizations`);

        return steps;
    },

    /**
     * Track quality metrics
     */
    trackQuality: function(reportData) {
        return {
            dataCompleteness: reportData.dataCompleteness || 100,
            selectorReliability: reportData.selectorReliability || 100,
            paginationConfidence: reportData.paginationConfidence || 100,
            overallQuality: reportData.confidence?.score || 100
        };
    },

    /**
     * Generate human-readable explanation
     */
    explainReport: function(auditTrail) {
        const lines = [
            `📄 Rapor Üretim Süreci`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``
        ];

        // Data sources
        lines.push(`1️⃣ Veri Toplama`);
        auditTrail.dataSources.forEach(source => {
            if (source.type === 'LIVE_SCRAPE') {
                lines.push(`  • ${source.rowsCollected} ceza toplandı`);
                lines.push(`  • ${source.pagesScanned} sayfa tarandı`);
                lines.push(`  • Kaynak: Canlı dashboard`);
            } else if (source.type === 'CACHE') {
                const ageMin = Math.round(source.age / 60000);
                lines.push(`  • ${source.rowsUsed} ceza (Cache - ${ageMin} dakika önce)`);
            }
        });
        lines.push(``);

        // Filters
        if (auditTrail.filtersApplied.length > 0) {
            lines.push(`2️⃣ Filtreleme`);
            auditTrail.filtersApplied.forEach(f => {
                lines.push(`  • ${f.filter}: ${f.value}`);
            });
            lines.push(``);
        }

        // Exclusions
        if (auditTrail.dataExclusions.length > 0) {
            lines.push(`3️⃣ Temizleme`);
            auditTrail.dataExclusions.forEach(ex => {
                lines.push(`  • ${ex.count} ${ex.reason.toLowerCase()} silindi`);
            });
            lines.push(``);
        }

        // Processing
        lines.push(`4️⃣ İşleme`);
        auditTrail.processingSteps.slice(3).forEach(step => {
            lines.push(`  • ${step}`);
        });
        lines.push(``);

        // Fallbacks
        if (auditTrail.fallbacksUsed.length > 0) {
            lines.push(`⚙️ Fallback Kullanıldı:`);
            auditTrail.fallbacksUsed.forEach(fb => {
                lines.push(`  ⚠️ ${fb.component}: ${fb.primary} → ${fb.fallback}`);
            });
            lines.push(``);
        }

        // Quality
        lines.push(`✅ Kalite Metrikleri:`);
        lines.push(`  • Veri tamlığı: ${auditTrail.qualityMetrics.dataCompleteness}%`);
        lines.push(`  • Selector güvenilirliği: ${auditTrail.qualityMetrics.selectorReliability}%`);
        lines.push(`  • Pagination güveni: ${auditTrail.qualityMetrics.paginationConfidence}%`);
        if (auditTrail.confidenceScore) {
            lines.push(`  • Genel güven: ${auditTrail.confidenceScore.score}%`);
        }

        return lines.join('\n');
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.DecisionSupportSystem = DecisionSupportSystem;
    window.AuditTrailSystem = AuditTrailSystem;
}

console.log('✅ Lutheus CezaRapor: Decision Support & Audit Trail loaded');
