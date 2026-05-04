// Lutheus CezaRapor - Selector Heat Map
// Track selector reliability and auto-detect fragile selectors

export const SelectorHeatMap = {
    version: '1.0.0',

    // Tracked selectors and their stats
    selectors: new Map(),

    // Reliability thresholds
    thresholds: {
        HIGH: 0.95,      // 95%+ success rate
        MEDIUM: 0.80,    // 80-95% success rate
        LOW: 0.60,       // 60-80% success rate
        CRITICAL: 0.60   // <60% = critical
    },

    // Critical selectors (core functionality)
    criticalSelectors: [
        '.row[class*="svelte-"]',
        '[class*="column"]',
        'input[type="number"]',
        '.pagination',
        '.user[class*="svelte-"]'
    ],

    /**
     * Track selector usage and result
     * @param {string} selector - CSS selector
     * @param {boolean} success - Whether selector found elements
     * @param {number} elementCount - Number of elements found
     * @param {number} responseTime - Time taken in ms
     */
    track: function(selector, success, elementCount = 0, responseTime = 0) {
        if (!this.selectors.has(selector)) {
            this.selectors.set(selector, {
                selector,
                totalAttempts: 0,
                successCount: 0,
                failureCount: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                successRate: 1.0,
                reliability: 'HIGH',
                lastSuccess: null,
                lastFailure: null,
                failureHistory: [],
                isCritical: this.criticalSelectors.includes(selector),
                status: 'HEALTHY'
            });
        }

        const stats = this.selectors.get(selector);

        // Update stats
        stats.totalAttempts++;
        stats.totalResponseTime += responseTime;
        stats.avgResponseTime = Math.round(stats.totalResponseTime / stats.totalAttempts);

        if (success) {
            stats.successCount++;
            stats.lastSuccess = {
                timestamp: Date.now(),
                elementCount,
                responseTime
            };
        } else {
            stats.failureCount++;
            stats.lastFailure = {
                timestamp: Date.now(),
                responseTime
            };

            // Track failure history
            stats.failureHistory.push({
                timestamp: Date.now(),
                responseTime
            });

            // Keep last 20 failures
            if (stats.failureHistory.length > 20) {
                stats.failureHistory.shift();
            }
        }

        // Calculate success rate
        stats.successRate = stats.successCount / stats.totalAttempts;

        // Determine reliability level
        stats.reliability = this.calculateReliability(stats.successRate);

        // Determine status
        stats.status = this.determineStatus(stats);

        // Check for alert conditions
        this.checkAlerts(stats);

        return stats;
    },

    /**
     * Calculate reliability level from success rate
     */
    calculateReliability: function(successRate) {
        if (successRate >= this.thresholds.HIGH) {
            return 'HIGH';
        } else if (successRate >= this.thresholds.MEDIUM) {
            return 'MEDIUM';
        } else if (successRate >= this.thresholds.LOW) {
            return 'LOW';
        } else {
            return 'CRITICAL';
        }
    },

    /**
     * Determine selector status
     */
    determineStatus: function(stats) {
        // Critical selector with low reliability
        if (stats.isCritical && stats.reliability === 'CRITICAL') {
            return 'EMERGENCY';
        }

        // Any selector with critical reliability
        if (stats.reliability === 'CRITICAL') {
            return 'FAILING';
        }

        // 3 consecutive failures
        const recentFailures = stats.failureHistory.slice(-3);
        if (recentFailures.length === 3) {
            const timeDiff = recentFailures[2].timestamp - recentFailures[0].timestamp;
            if (timeDiff < 60000) { // Within 1 minute
                return 'UNSTABLE';
            }
        }

        // Degrading (success rate dropping)
        if (stats.totalAttempts >= 10) {
            const recentAttempts = Math.min(10, stats.totalAttempts);
            const recentSuccess = stats.failureHistory.length < recentAttempts;
            if (!recentSuccess && stats.reliability === 'LOW') {
                return 'DEGRADING';
            }
        }

        // Healthy
        return 'HEALTHY';
    },

    /**
     * Check for alert conditions
     */
    checkAlerts: function(stats) {
        const alerts = [];

        // Alert 1: Critical selector failing
        if (stats.isCritical && stats.reliability === 'CRITICAL') {
            alerts.push({
                level: 'CRITICAL',
                selector: stats.selector,
                message: `🚨 KRITIK: "${stats.selector}" selector başarısız (${(stats.successRate * 100).toFixed(0)}% başarı)`,
                action: 'IMMEDIATE_FALLBACK_REQUIRED'
            });
        }

        // Alert 2: 3 consecutive failures
        if (stats.failureCount >= 3) {
            const lastThree = stats.failureHistory.slice(-3);
            if (lastThree.length === 3) {
                const timeDiff = lastThree[2].timestamp - lastThree[0].timestamp;
                if (timeDiff < 60000) {
                    alerts.push({
                        level: 'HIGH',
                        selector: stats.selector,
                        message: `⚠️ "${stats.selector}" selector 3 ardışık başarısızlık`,
                        action: 'INVESTIGATE_SELECTOR'
                    });
                }
            }
        }

        // Alert 3: Slow response time
        if (stats.avgResponseTime > 1000) {
            alerts.push({
                level: 'MEDIUM',
                selector: stats.selector,
                message: `🐌 "${stats.selector}" selector yavaş (${stats.avgResponseTime}ms)`,
                action: 'OPTIMIZE_SELECTOR'
            });
        }

        // Alert 4: Success rate dropped below 80% in last 24 hours
        const recentFailures = stats.failureHistory.filter(f => 
            Date.now() - f.timestamp < 86400000
        );
        if (recentFailures.length > 10) {
            alerts.push({
                level: 'HIGH',
                selector: stats.selector,
                message: `📉 "${stats.selector}" son 24 saatte ${recentFailures.length} hata`,
                action: 'DASHBOARD_UPDATE_LIKELY'
            });
        }

        // Dispatch alerts
        alerts.forEach(alert => {
            this.dispatchAlert(alert);
        });

        return alerts;
    },

    /**
     * Dispatch alert event
     */
    dispatchAlert: function(alert) {
        console.warn('[SelectorHeatMap] Alert:', alert);
        
        window.dispatchEvent(new CustomEvent('selectorAlert', {
            detail: alert
        }));
    },

    /**
     * Get selector stats
     */
    getStats: function(selector) {
        return this.selectors.get(selector) || null;
    },

    /**
     * Get all tracked selectors
     */
    getAllStats: function() {
        return Array.from(this.selectors.values());
    },

    /**
     * Get selectors by reliability
     */
    getSelectorsByReliability: function(reliability) {
        return this.getAllStats().filter(s => s.reliability === reliability);
    },

    /**
     * Get critical selectors
     */
    getCriticalSelectors: function() {
        return this.getAllStats().filter(s => s.isCritical);
    },

    /**
     * Get failing selectors
     */
    getFailingSelectors: function() {
        return this.getAllStats().filter(s => 
            s.status === 'EMERGENCY' || s.status === 'FAILING'
        );
    },

    /**
     * Generate heat map visualization data
     */
    generateHeatMapData: function() {
        const stats = this.getAllStats();

        return stats.map(s => ({
            selector: s.selector,
            reliability: s.reliability,
            successRate: s.successRate,
            color: this.getColor(s.reliability),
            isCritical: s.isCritical,
            status: s.status,
            avgResponseTime: s.avgResponseTime
        }));
    },

    /**
     * Get color based on reliability
     */
    getColor: function(reliability) {
        const colors = {
            'HIGH': '#2ecc71',     // Green
            'MEDIUM': '#f39c12',   // Orange
            'LOW': '#e67e22',      // Dark Orange
            'CRITICAL': '#e74c3c'  // Red
        };
        return colors[reliability] || '#95a5a6';
    },

    /**
     * Generate health report
     */
    generateHealthReport: function() {
        const stats = this.getAllStats();
        const critical = this.getCriticalSelectors();
        const failing = this.getFailingSelectors();

        const totalSelectors = stats.length;
        const healthyCount = stats.filter(s => s.reliability === 'HIGH').length;
        const mediumCount = stats.filter(s => s.reliability === 'MEDIUM').length;
        const lowCount = stats.filter(s => s.reliability === 'LOW').length;
        const criticalCount = stats.filter(s => s.reliability === 'CRITICAL').length;

        const overallHealth = healthyCount / totalSelectors;

        return {
            totalSelectors,
            breakdown: {
                high: healthyCount,
                medium: mediumCount,
                low: lowCount,
                critical: criticalCount
            },
            overallHealth: Math.round(overallHealth * 100),
            criticalSelectors: critical.length,
            failingSelectors: failing.length,
            recommendations: this.generateRecommendations(stats),
            topIssues: this.getTopIssues(stats)
        };
    },

    /**
     * Generate recommendations
     */
    generateRecommendations: function(stats) {
        const recommendations = [];

        // Check critical selectors
        const failingCritical = stats.filter(s => 
            s.isCritical && s.reliability !== 'HIGH'
        );

        if (failingCritical.length > 0) {
            recommendations.push({
                priority: 'URGENT',
                message: `${failingCritical.length} kritik selector sorunlu`,
                action: "Fallback selector'leri aktif edin",
                selectors: failingCritical.map(s => s.selector)
            });
        }

        // Check slow selectors
        const slowSelectors = stats.filter(s => s.avgResponseTime > 500);
        if (slowSelectors.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                message: `${slowSelectors.length} selector yavaş çalışıyor`,
                action: 'Selector optimizasyonu yapın',
                selectors: slowSelectors.map(s => s.selector)
            });
        }

        // Check Sapphire dashboard update likely
        const recentlyFailing = stats.filter(s => {
            const last24h = s.failureHistory.filter(f => 
                Date.now() - f.timestamp < 86400000
            );
            return last24h.length > 5;
        });

        if (recentlyFailing.length > 3) {
            recommendations.push({
                priority: 'HIGH',
                message: 'Sapphire Dashboard güncelleme olmuş olabilir',
                action: 'Selector sistemini gözden geçirin',
                selectors: recentlyFailing.map(s => s.selector)
            });
        }

        return recommendations;
    },

    /**
     * Get top issues
     */
    getTopIssues: function(stats) {
        return stats
            .filter(s => s.reliability !== 'HIGH')
            .sort((a, b) => a.successRate - b.successRate)
            .slice(0, 5)
            .map(s => ({
                selector: s.selector,
                successRate: Math.round(s.successRate * 100) + '%',
                failureCount: s.failureCount,
                status: s.status,
                isCritical: s.isCritical
            }));
    },

    /**
     * Reset stats for specific selector
     */
    reset: function(selector) {
        this.selectors.delete(selector);
    },

    /**
     * Reset all stats
     */
    resetAll: function() {
        this.selectors.clear();
    },

    /**
     * Export stats to JSON
     */
    exportStats: function() {
        const stats = this.getAllStats();
        return JSON.stringify(stats, null, 2);
    },

    /**
     * Import stats from JSON
     */
    importStats: function(jsonString) {
        try {
            const stats = JSON.parse(jsonString);
            stats.forEach(stat => {
                this.selectors.set(stat.selector, stat);
            });
            return true;
        } catch (e) {
            console.error('[SelectorHeatMap] Import failed:', e);
            return false;
        }
    },

    /**
     * Get selector suggestion (fallback)
     */
    suggestFallback: function(failedSelector) {
        // Common fallback patterns
        const fallbacks = {
            '.row[class*="svelte-"]': [
                '[class*="row"]',
                '.row',
                'tr'
            ],
            '[class*="column"]': [
                '[class*="col"]',
                'td',
                'div[class*="cell"]'
            ],
            'input[type="number"]': [
                'input[type="text"]',
                'input.page-input',
                '.pagination input'
            ]
        };

        return fallbacks[failedSelector] || [];
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.SelectorHeatMap = SelectorHeatMap;
}

console.log('✅ Lutheus CezaRapor: Selector Heat Map loaded');
