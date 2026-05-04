// Lutheus CezaRapor - Health Score Engine
// Real-time system health monitoring and graceful degradation

export const HealthScoreEngine = {
    version: '1.0.0',
    
    // Component weights (Total: 100%)
    weights: {
        AUTH: 0.30,      // 30% - Authentication
        SELECTOR: 0.20,  // 20% - DOM Selector System
        NETWORK: 0.20,   // 20% - Network Layer
        RUNTIME: 0.20,   // 20% - Runtime Performance
        UI: 0.10         // 10% - UI Responsiveness
    },

    // Health thresholds
    thresholds: {
        EXCELLENT: 90,
        GOOD: 80,
        DEGRADED: 70,
        CRITICAL: 50,
        LOCKDOWN: 30
    },

    // Component health scores (0-100)
    componentScores: {
        auth: 100,
        selector: 100,
        network: 100,
        runtime: 100,
        ui: 100
    },

    // Component status details
    componentDetails: {},

    // Health history (last 20 measurements)
    history: [],

    /**
     * Calculate overall system health score
     * @returns {number} 0-100
     */
    calculateScore: function() {
        const scores = this.componentScores;
        const weights = this.weights;

        const totalScore = 
            (scores.auth * weights.AUTH) +
            (scores.selector * weights.SELECTOR) +
            (scores.network * weights.NETWORK) +
            (scores.runtime * weights.RUNTIME) +
            (scores.ui * weights.UI);

        return Math.round(totalScore);
    },

    /**
     * Get health status based on score
     * @param {number} score
     * @returns {{level: string, color: string, emoji: string, mode: string}}
     */
    getHealthStatus: function(score) {
        if (score >= this.thresholds.EXCELLENT) {
            return {
                level: 'EXCELLENT',
                color: '#2ecc71',
                emoji: '🟢',
                mode: 'FULL',
                description: 'Tüm sistemler optimal çalışıyor'
            };
        } else if (score >= this.thresholds.GOOD) {
            return {
                level: 'GOOD',
                color: '#3498db',
                emoji: '🔵',
                mode: 'FULL',
                description: 'Sistem normal çalışıyor'
            };
        } else if (score >= this.thresholds.DEGRADED) {
            return {
                level: 'DEGRADED',
                color: '#f39c12',
                emoji: '🟡',
                mode: 'RESTRICTED',
                description: 'Kısıtlı mod - bazı özellikler kapalı'
            };
        } else if (score >= this.thresholds.CRITICAL) {
            return {
                level: 'CRITICAL',
                color: '#e67e22',
                emoji: '🟠',
                mode: 'MINIMAL',
                description: 'Kritik durum - minimal fonksiyon'
            };
        } else {
            return {
                level: 'LOCKDOWN',
                color: '#e74c3c',
                emoji: '🔴',
                mode: 'LOCKDOWN',
                description: 'Güvenli mod - sadece okuma'
            };
        }
    },

    /**
     * Update component health score
     * @param {string} component - auth, selector, network, runtime, ui
     * @param {number} score - 0-100
     * @param {Object} details - Additional info
     */
    updateComponent: function(component, score, details = {}) {
        if (!this.componentScores.hasOwnProperty(component)) {
            console.error('[HealthScore] Unknown component:', component);
            return;
        }

        this.componentScores[component] = Math.max(0, Math.min(100, score));
        this.componentDetails[component] = {
            ...details,
            lastUpdate: Date.now(),
            score
        };

        // Record to history
        const overallScore = this.calculateScore();
        this.history.push({
            timestamp: Date.now(),
            score: overallScore,
            component,
            componentScore: score
        });

        // Keep last 20 records
        if (this.history.length > 20) {
            this.history.shift();
        }

        console.log(`[HealthScore] ${component}: ${score} → Overall: ${overallScore}`);

        // Trigger mode change if needed
        this.checkModeChange(overallScore);

        return overallScore;
    },

    /**
     * Check if mode should change based on score
     */
    checkModeChange: function(score) {
        const status = this.getHealthStatus(score);
        const currentMode = this.getCurrentMode();

        if (status.mode !== currentMode) {
            console.warn(`[HealthScore] 🔄 Mode change: ${currentMode} → ${status.mode}`);
            this.triggerModeChange(status.mode, score, status);
        }
    },

    /**
     * Get current operational mode
     */
    getCurrentMode: function() {
        const score = this.calculateScore();
        return this.getHealthStatus(score).mode;
    },

    /**
     * Trigger mode change and apply restrictions
     */
    triggerModeChange: function(newMode, score, status) {
        const event = new CustomEvent('healthModeChange', {
            detail: {
                mode: newMode,
                score,
                status,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);

        // Apply restrictions based on mode
        this.applyModeRestrictions(newMode);
    },

    /**
     * Apply operational restrictions based on mode
     */
    applyModeRestrictions: function(mode) {
        const restrictions = {
            FULL: {
                scanning: true,
                graphics: true,
                automation: true,
                analysis: true,
                export: true
            },
            RESTRICTED: {
                scanning: true,
                graphics: false,          // ❌ Grafik kapalı
                automation: true,
                analysis: true,
                export: true,
                scanSpeed: 0.7            // %70 hız
            },
            MINIMAL: {
                scanning: false,          // ❌ Otomatik tarama kapalı
                graphics: false,
                automation: false,
                analysis: true,           // ✅ Analiz çalışır
                export: true,
                manualOnly: true          // Sadece manuel
            },
            LOCKDOWN: {
                scanning: false,
                graphics: false,
                automation: false,
                analysis: false,          // ❌ Analiz durur
                export: false,
                readOnly: true,           // ✅ Sadece okuma
                selfDiagnostic: true      // 🔧 Self-diagnostic aktif
            }
        };

        const config = restrictions[mode] || restrictions.LOCKDOWN;

        // Store globally
        window.GearTech = window.GearTech || {};
        window.GearTech.OperationalMode = mode;
        window.GearTech.Restrictions = config;

        console.log('[HealthScore] Applied restrictions:', config);
    },

    /**
     * Auth Module Health Check
     */
    checkAuthHealth: function() {
        let score = 100;
        const details = {};

        try {
            // Check if on correct domain
            if (!window.location.href.includes('dashboard.sapph.xyz')) {
                score -= 50;
                details.error = 'Not on Sapphire dashboard';
            }

            // Check Guild ID
            const guildMatch = window.location.href.match(/\/(\d+)/);
            if (!guildMatch) {
                score -= 30;
                details.error = 'Cannot extract Guild ID';
            } else {
                details.guildId = guildMatch[1];
            }

            // Check if user info exists
            const userContainer = document.querySelector('.user[class*="svelte-"]');
            if (!userContainer) {
                score -= 20;
                details.warning = 'User container not found';
            }

        } catch (e) {
            score = 0;
            details.error = e.message;
        }

        this.updateComponent('auth', score, details);
        return score;
    },

    /**
     * Selector System Health Check
     */
    checkSelectorHealth: function() {
        let score = 100;
        const details = { tests: {} };

        // Test critical selectors
        const criticalSelectors = {
            rows: '.row[class*="svelte-"]',
            columns: '[class*="column"]',
            pagination: 'input[type="number"]',
            cases: '.row[class*="svelte-"]:not(.dummy)'
        };

        let passedTests = 0;
        const totalTests = Object.keys(criticalSelectors).length;

        for (const [name, selector] of Object.entries(criticalSelectors)) {
            try {
                const elements = document.querySelectorAll(selector);
                const found = elements.length > 0;
                details.tests[name] = {
                    found,
                    count: elements.length,
                    selector
                };

                if (found) {
                    passedTests++;
                } else {
                    score -= 25; // Each critical selector failure = -25
                }
            } catch (e) {
                details.tests[name] = { error: e.message };
                score -= 25;
            }
        }

        details.passRate = `${passedTests}/${totalTests}`;
        details.reliability = passedTests / totalTests;

        this.updateComponent('selector', Math.max(0, score), details);
        return score;
    },

    /**
     * Network Health Check
     */
    checkNetworkHealth: function() {
        let score = 100;
        const details = {};

        try {
            // Check online status
            if (!navigator.onLine) {
                score = 0;
                details.error = 'No internet connection';
            }

            // Check page load state
            if (document.readyState !== 'complete') {
                score -= 30;
                details.warning = 'Page not fully loaded';
            }

            // Check for network errors in console (simplified)
            details.online = navigator.onLine;
            details.readyState = document.readyState;

        } catch (e) {
            score = 50;
            details.error = e.message;
        }

        this.updateComponent('network', score, details);
        return score;
    },

    /**
     * Runtime Performance Health Check
     */
    checkRuntimeHealth: function() {
        let score = 100;
        const details = {};

        try {
            // Check memory usage (if available)
            if (performance.memory) {
                const memUsed = performance.memory.usedJSHeapSize;
                const memLimit = performance.memory.jsHeapSizeLimit;
                const memPercent = (memUsed / memLimit) * 100;

                details.memoryUsage = `${Math.round(memPercent)}%`;
                details.memoryMB = Math.round(memUsed / 1048576);

                if (memPercent > 90) {
                    score -= 50;
                    details.warning = 'High memory usage';
                } else if (memPercent > 70) {
                    score -= 20;
                }
            }

            // Check performance timing
            if (performance.timing) {
                const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                details.pageLoadTime = `${loadTime}ms`;

                if (loadTime > 5000) {
                    score -= 20;
                    details.warning = 'Slow page load';
                }
            }

        } catch (e) {
            score = 80;
            details.error = e.message;
        }

        this.updateComponent('runtime', score, details);
        return score;
    },

    /**
     * UI Responsiveness Health Check
     */
    checkUIHealth: function() {
        let score = 100;
        const details = {};

        try {
            // Check if main UI elements are visible
            const mainContent = document.querySelector('main, [role="main"], .content');
            if (!mainContent) {
                score -= 40;
                details.warning = 'Main content not found';
            }

            // Check for error overlays
            const errorOverlay = document.querySelector('.error, .overlay, [class*="error"]');
            if (errorOverlay && errorOverlay.offsetParent !== null) {
                score -= 30;
                details.warning = 'Error overlay detected';
            }

            details.responsive = score > 70;

        } catch (e) {
            score = 70;
            details.error = e.message;
        }

        this.updateComponent('ui', score, details);
        return score;
    },

    /**
     * Run full health check on all components
     */
    runFullCheck: function() {
        console.log('[HealthScore] Running full health check...');

        this.checkAuthHealth();
        this.checkSelectorHealth();
        this.checkNetworkHealth();
        this.checkRuntimeHealth();
        this.checkUIHealth();

        const overallScore = this.calculateScore();
        const status = this.getHealthStatus(overallScore);

        console.log(`[HealthScore] Overall: ${overallScore} - ${status.level}`);
        console.log('[HealthScore] Details:', this.getFullReport());

        return {
            score: overallScore,
            status,
            components: { ...this.componentScores },
            details: { ...this.componentDetails }
        };
    },

    /**
     * Get detailed health report
     */
    getFullReport: function() {
        const overallScore = this.calculateScore();
        const status = this.getHealthStatus(overallScore);

        return {
            overall: {
                score: overallScore,
                status: status.level,
                mode: status.mode,
                description: status.description,
                emoji: status.emoji
            },
            components: Object.keys(this.componentScores).map(key => ({
                name: key,
                score: this.componentScores[key],
                weight: this.weights[key.toUpperCase()] * 100 + '%',
                details: this.componentDetails[key] || {}
            })),
            history: this.history.slice(-10), // Last 10 records
            timestamp: Date.now()
        };
    },

    /**
     * Reset all health scores to 100
     */
    reset: function() {
        Object.keys(this.componentScores).forEach(key => {
            this.componentScores[key] = 100;
        });
        this.componentDetails = {};
        this.history = [];
        console.log('[HealthScore] Reset complete');
    },

    /**
     * Start continuous monitoring (every 10 seconds)
     */
    startMonitoring: function(interval = 10000) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        console.log('[HealthScore] Starting continuous monitoring...');
        
        // Initial check
        this.runFullCheck();

        // Periodic checks
        this.monitoringInterval = setInterval(() => {
            this.runFullCheck();
        }, interval);
    },

    /**
     * Stop monitoring
     */
    stopMonitoring: function() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('[HealthScore] Monitoring stopped');
        }
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.HealthScoreEngine = HealthScoreEngine;
}

console.log('✅ Lutheus CezaRapor: Health Score Engine loaded');
