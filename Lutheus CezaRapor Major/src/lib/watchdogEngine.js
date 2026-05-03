// Lutheus CezaRapor - Watchdog++ (Double Guardian System)
// Prevents infinite loops, memory leaks, and promise freezes

export const WatchdogEngine = {
    version: '1.0.0',

    // Configuration
    config: {
        PRIMARY_TIMEOUT: 30000,        // 30 seconds
        SECONDARY_TIMEOUT: 45000,      // 45 seconds (watches primary)
        HEARTBEAT_INTERVAL: 5000,      // 5 seconds
        MEMORY_LIMIT_MB: 1024,         // 1GB
        MAX_LOOP_ITERATIONS: 100,      // Max iterations before loop detection
        FREEZE_DETECTION_MS: 10000     // 10 seconds without heartbeat = freeze
    },

    // State
    state: {
        primaryActive: false,
        secondaryActive: false,
        lastHeartbeat: null,
        operationStartTime: null,
        currentOperation: null,
        iterationCount: 0,
        memorySnapshots: [],
        logHistory: []
    },

    // Timers
    timers: {
        primary: null,
        secondary: null,
        heartbeat: null
    },

    /**
     * Start watching an operation
     * @param {string} operationName - Name of the operation
     * @param {number} timeout - Custom timeout in ms (optional)
     * @returns {string} Watch ID
     */
    watch: function(operationName, timeout = null) {
        const watchId = `watch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        this.state.currentOperation = {
            id: watchId,
            name: operationName,
            startTime: Date.now(),
            timeout: timeout || this.config.PRIMARY_TIMEOUT,
            iterationCount: 0
        };

        this.log(`[Watchdog] Started watching: ${operationName}`, 'INFO');

        // Start primary watchdog
        this.startPrimaryWatchdog();

        // Start secondary watchdog (watches the primary)
        this.startSecondaryWatchdog();

        // Start heartbeat
        this.startHeartbeat();

        return watchId;
    },

    /**
     * Send heartbeat signal (operation is alive)
     */
    heartbeat: function() {
        this.state.lastHeartbeat = Date.now();
    },

    /**
     * Increment iteration counter (for loop detection)
     */
    tick: function() {
        if (!this.state.currentOperation) return;

        this.state.currentOperation.iterationCount++;

        // Check for infinite loop
        if (this.state.currentOperation.iterationCount > this.config.MAX_LOOP_ITERATIONS) {
            this.triggerEmergency('INFINITE_LOOP', {
                operation: this.state.currentOperation.name,
                iterations: this.state.currentOperation.iterationCount
            });
        }
    },

    /**
     * Check memory usage
     */
    checkMemory: function() {
        if (!performance.memory) {
            return { checked: false, reason: 'Memory API not available' };
        }

        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        const limitMB = this.config.MEMORY_LIMIT_MB;

        this.state.memorySnapshots.push({
            timestamp: Date.now(),
            usedMB
        });

        // Keep last 20 snapshots
        if (this.state.memorySnapshots.length > 20) {
            this.state.memorySnapshots.shift();
        }

        if (usedMB > limitMB) {
            this.triggerEmergency('MEMORY_LEAK', {
                usedMB,
                limitMB,
                snapshots: this.state.memorySnapshots.slice(-5)
            });
            return { checked: true, exceeded: true, usedMB, limitMB };
        }

        return { checked: true, exceeded: false, usedMB, limitMB };
    },

    /**
     * Stop watching (operation completed successfully)
     */
    unwatch: function(watchId) {
        if (!this.state.currentOperation || this.state.currentOperation.id !== watchId) {
            console.warn('[Watchdog] Unwatch called with wrong ID:', watchId);
            return false;
        }

        const duration = Date.now() - this.state.currentOperation.startTime;
        this.log(`[Watchdog] Operation completed: ${this.state.currentOperation.name} (${duration}ms)`, 'INFO');

        this.cleanup();
        return true;
    },

    /**
     * Start primary watchdog timer
     */
    startPrimaryWatchdog: function() {
        if (this.timers.primary) {
            clearTimeout(this.timers.primary);
        }

        this.state.primaryActive = true;

        this.timers.primary = setTimeout(() => {
            this.log('[Watchdog] PRIMARY TIMEOUT - Operation took too long', 'ERROR');
            this.triggerEmergency('PRIMARY_TIMEOUT', {
                operation: this.state.currentOperation?.name,
                timeout: this.state.currentOperation?.timeout
            });
        }, this.state.currentOperation.timeout);
    },

    /**
     * Start secondary watchdog (watches primary)
     */
    startSecondaryWatchdog: function() {
        if (this.timers.secondary) {
            clearTimeout(this.timers.secondary);
        }

        this.state.secondaryActive = true;

        this.timers.secondary = setTimeout(() => {
            // Check if primary watchdog is still alive
            if (!this.state.primaryActive) {
                this.log('[Watchdog] SECONDARY: Primary watchdog died', 'CRITICAL');
                this.triggerEmergency('WATCHDOG_FAILURE', {
                    reason: 'Primary watchdog not responding'
                });
            }
        }, this.config.SECONDARY_TIMEOUT);
    },

    /**
     * Start heartbeat monitor
     */
    startHeartbeat: function() {
        if (this.timers.heartbeat) {
            clearInterval(this.timers.heartbeat);
        }

        this.state.lastHeartbeat = Date.now();

        this.timers.heartbeat = setInterval(() => {
            const timeSinceLastHeartbeat = Date.now() - this.state.lastHeartbeat;

            // Check for freeze (no heartbeat)
            if (timeSinceLastHeartbeat > this.config.FREEZE_DETECTION_MS) {
                this.log('[Watchdog] FREEZE DETECTED - No heartbeat', 'ERROR');
                this.triggerEmergency('FREEZE_DETECTED', {
                    timeSinceLastHeartbeat,
                    operation: this.state.currentOperation?.name
                });
            }

            // Check memory
            this.checkMemory();

        }, this.config.HEARTBEAT_INTERVAL);
    },

    /**
     * Trigger emergency stop
     */
    triggerEmergency: function(type, details) {
        this.log(`[Watchdog] 🚨 EMERGENCY: ${type}`, 'CRITICAL');
        this.log(`[Watchdog] Details: ${JSON.stringify(details)}`, 'CRITICAL');

        // Dispatch emergency event
        const event = new CustomEvent('watchdogEmergency', {
            detail: {
                type,
                details,
                operation: this.state.currentOperation,
                timestamp: Date.now(),
                logHistory: this.state.logHistory.slice(-10)
            }
        });
        window.dispatchEvent(event);

        // Emergency cleanup
        this.emergencyCleanup(type);
    },

    /**
     * Emergency cleanup
     */
    emergencyCleanup: function(emergencyType) {
        try {
            // Stop all timers
            this.cleanup();

            // Clear operation state
            this.state.currentOperation = null;

            // Dispatch recovery signal
            window.dispatchEvent(new CustomEvent('watchdogRecovery', {
                detail: {
                    emergencyType,
                    timestamp: Date.now()
                }
            }));

            this.log('[Watchdog] Emergency cleanup completed', 'INFO');

        } catch (e) {
            console.error('[Watchdog] Emergency cleanup failed:', e);
        }
    },

    /**
     * Normal cleanup
     */
    cleanup: function() {
        // Clear all timers
        if (this.timers.primary) {
            clearTimeout(this.timers.primary);
            this.timers.primary = null;
        }

        if (this.timers.secondary) {
            clearTimeout(this.timers.secondary);
            this.timers.secondary = null;
        }

        if (this.timers.heartbeat) {
            clearInterval(this.timers.heartbeat);
            this.timers.heartbeat = null;
        }

        // Reset state
        this.state.primaryActive = false;
        this.state.secondaryActive = false;
        this.state.lastHeartbeat = null;
        this.state.currentOperation = null;
    },

    /**
     * Log with history
     */
    log: function(message, level = 'INFO') {
        const entry = {
            timestamp: Date.now(),
            level,
            message
        };

        this.state.logHistory.push(entry);

        // Keep last 100 logs
        if (this.state.logHistory.length > 100) {
            this.state.logHistory.shift();
        }

        // Console output
        const logFn = level === 'CRITICAL' ? console.error : 
                     level === 'ERROR' ? console.error :
                     level === 'WARN' ? console.warn : console.log;
        
        logFn(message);
    },

    /**
     * Get watchdog status
     */
    getStatus: function() {
        return {
            active: this.state.currentOperation !== null,
            operation: this.state.currentOperation,
            primaryActive: this.state.primaryActive,
            secondaryActive: this.state.secondaryActive,
            lastHeartbeat: this.state.lastHeartbeat,
            timeSinceHeartbeat: this.state.lastHeartbeat 
                ? Date.now() - this.state.lastHeartbeat 
                : null,
            memoryUsage: this.checkMemory(),
            recentLogs: this.state.logHistory.slice(-10)
        };
    },

    /**
     * Create protected async function
     * Wraps an async function with watchdog protection
     */
    protect: function(fn, operationName, timeout = null) {
        return async (...args) => {
            const watchId = this.watch(operationName, timeout);

            try {
                const result = await fn(...args);
                this.unwatch(watchId);
                return result;
            } catch (error) {
                this.log(`[Watchdog] Protected function error: ${error.message}`, 'ERROR');
                this.unwatch(watchId);
                throw error;
            }
        };
    },

    /**
     * Create protected loop
     * Wraps a loop with iteration counting and timeout
     */
    protectedLoop: function(condition, body, maxIterations = null) {
        const max = maxIterations || this.config.MAX_LOOP_ITERATIONS;
        let iterations = 0;

        while (condition() && iterations < max) {
            this.tick();
            this.heartbeat();
            body(iterations);
            iterations++;
        }

        if (iterations >= max) {
            this.log(`[Watchdog] Loop stopped at max iterations: ${max}`, 'WARN');
            return { completed: false, iterations, reason: 'MAX_ITERATIONS' };
        }

        return { completed: true, iterations };
    },

    /**
     * Detect recursive call depth
     */
    recursionDepth: 0,
    MAX_RECURSION_DEPTH: 50,

    enterRecursion: function(functionName) {
        this.recursionDepth++;
        
        if (this.recursionDepth > this.MAX_RECURSION_DEPTH) {
            this.triggerEmergency('STACK_OVERFLOW', {
                depth: this.recursionDepth,
                function: functionName
            });
            throw new Error(`Maximum recursion depth exceeded: ${functionName}`);
        }
    },

    exitRecursion: function() {
        this.recursionDepth = Math.max(0, this.recursionDepth - 1);
    },

    /**
     * Promise timeout wrapper
     */
    promiseWithTimeout: function(promise, timeoutMs = 30000, operationName = 'Promise') {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    this.log(`[Watchdog] Promise timeout: ${operationName}`, 'ERROR');
                    reject(new Error(`Promise timeout after ${timeoutMs}ms: ${operationName}`));
                }, timeoutMs);
            })
        ]);
    },

    /**
     * Detect DOM mutation storm
     */
    mutationObserver: null,
    mutationCount: 0,
    MUTATION_LIMIT: 1000,

    startMutationWatch: function(targetElement = document.body) {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        this.mutationCount = 0;

        this.mutationObserver = new MutationObserver((mutations) => {
            this.mutationCount += mutations.length;

            if (this.mutationCount > this.MUTATION_LIMIT) {
                this.log(`[Watchdog] DOM MUTATION STORM: ${this.mutationCount} mutations`, 'ERROR');
                this.triggerEmergency('MUTATION_STORM', {
                    count: this.mutationCount,
                    mutations: mutations.length
                });
                this.stopMutationWatch();
            }
        });

        this.mutationObserver.observe(targetElement, {
            childList: true,
            subtree: true,
            attributes: true
        });

        this.log('[Watchdog] Mutation watch started', 'INFO');
    },

    stopMutationWatch: function() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
            this.log('[Watchdog] Mutation watch stopped', 'INFO');
        }
    },

    /**
     * Generate health report
     */
    generateReport: function() {
        const status = this.getStatus();
        const memCheck = this.checkMemory();

        return {
            healthy: !status.active || (status.active && status.timeSinceHeartbeat < this.config.FREEZE_DETECTION_MS),
            status,
            memory: memCheck,
            config: this.config,
            recommendations: this.generateRecommendations(status, memCheck)
        };
    },

    /**
     * Generate recommendations based on current state
     */
    generateRecommendations: function(status, memCheck) {
        const recommendations = [];

        if (status.timeSinceHeartbeat && status.timeSinceHeartbeat > 5000) {
            recommendations.push({
                level: 'WARNING',
                message: 'Heartbeat yavaş - operasyon donma riskinde'
            });
        }

        if (memCheck.checked && memCheck.usedMB > this.config.MEMORY_LIMIT_MB * 0.8) {
            recommendations.push({
                level: 'WARNING',
                message: `Yüksek bellek kullanımı: ${memCheck.usedMB}MB (limit: ${this.config.MEMORY_LIMIT_MB}MB)`
            });
        }

        if (status.operation && status.operation.iterationCount > this.config.MAX_LOOP_ITERATIONS * 0.8) {
            recommendations.push({
                level: 'WARNING',
                message: `Yüksek iterasyon sayısı: ${status.operation.iterationCount}`
            });
        }

        return recommendations;
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.WatchdogEngine = WatchdogEngine;
}

console.log('✅ Lutheus CezaRapor: Watchdog++ Engine loaded');
