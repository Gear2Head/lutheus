// Lutheus CezaRapor - Scan Session System
// Every scan is trackable, repeatable, auditable

import { createHash } from 'crypto';

export const ScanSessionEngine = {
    version: '1.0.0',
    
    currentSession: null,
    sessionHistory: [],

    /**
     * Create new scan session
     * @param {Object} config - Scan configuration
     * @returns {Object} Session object
     */
    createSession: function(config = {}) {
        const sessionId = this.generateSessionId();
        const timestamp = new Date().toISOString();

        const session = {
            // Core Identity
            sessionId,
            timestamp,
            
            // Configuration (What was scanned)
            config: {
                target: {
                    serverId: config.serverId || null,
                    penaltyTypes: config.penaltyTypes || [],
                    staff: config.staff || [],
                    excludeStaff: config.excludeStaff || []
                },
                scope: {
                    maxPages: config.maxPages || 10,
                    maxRecords: config.maxRecords || 250,
                    allowUnlimited: config.allowUnlimited || false
                },
                timing: {
                    range: config.timeRange || null,
                    throttle: config.throttle || 1200
                },
                filters: {
                    time: config.timeFilter || null,
                    role: config.roleFilter || null,
                    type: config.typeFilter || null
                }
            },

            // Results (What was found)
            results: {
                totalCases: 0,
                pagesScanned: 0,
                duration: 0,
                errorsEncountered: 0,
                duplicatesRemoved: 0,
                dataQuality: 100
            },

            // Health (System state during scan)
            health: {
                startScore: 0,
                endScore: 0,
                avgScore: 0,
                minScore: 100,
                lowestComponent: null
            },

            // Metadata
            metadata: {
                extensionVersion: chrome.runtime.getManifest().version,
                browserVersion: navigator.userAgent,
                dashboardLayout: 'grid',
                paginationSource: null,
                selectorFallbacks: []
            },

            // Status
            status: 'PENDING',  // PENDING, IN_PROGRESS, COMPLETED, FAILED, ABORTED
            startTime: Date.now(),
            endTime: null,

            // Logs
            logs: [],
            warnings: [],
            errors: []
        };

        this.currentSession = session;
        console.log('[ScanSession] Created session:', sessionId);
        
        return session;
    },

    /**
     * Generate unique session ID
     * Format: scan_abc123xyz
     */
    generateSessionId: function() {
        const randomStr = Math.random().toString(36).substring(2, 11);
        const timeStr = Date.now().toString(36);
        return `scan_${timeStr}_${randomStr}`;
    },

    /**
     * Update session status
     */
    updateStatus: function(status) {
        if (!this.currentSession) {
            console.error('[ScanSession] No active session');
            return false;
        }

        this.currentSession.status = status;
        this.log(`Status changed to: ${status}`);

        if (status === 'COMPLETED' || status === 'FAILED' || status === 'ABORTED') {
            this.currentSession.endTime = Date.now();
            this.currentSession.results.duration = this.currentSession.endTime - this.currentSession.startTime;
            
            // Calculate checksum
            this.currentSession.checksum = this.calculateChecksum(this.currentSession);

            // Archive session
            this.archiveSession();
        }

        return true;
    },

    /**
     * Update session results
     */
    updateResults: function(results) {
        if (!this.currentSession) return false;

        this.currentSession.results = {
            ...this.currentSession.results,
            ...results
        };

        return true;
    },

    /**
     * Update health scores
     */
    updateHealth: function(healthData) {
        if (!this.currentSession) return false;

        const health = this.currentSession.health;
        const score = healthData.score || 0;

        // Update scores
        if (health.startScore === 0) {
            health.startScore = score;
        }
        health.endScore = score;

        // Track minimum
        if (score < health.minScore) {
            health.minScore = score;
            health.lowestComponent = healthData.lowestComponent || null;
        }

        // Update average
        health.avgScore = Math.round((health.startScore + health.endScore) / 2);

        return true;
    },

    /**
     * Add log entry
     */
    log: function(message, level = 'INFO') {
        if (!this.currentSession) return;

        const entry = {
            timestamp: Date.now(),
            level,
            message
        };

        this.currentSession.logs.push(entry);

        if (level === 'WARN') {
            this.currentSession.warnings.push(entry);
        } else if (level === 'ERROR') {
            this.currentSession.errors.push(entry);
            this.currentSession.results.errorsEncountered++;
        }
    },

    /**
     * Add metadata
     */
    addMetadata: function(key, value) {
        if (!this.currentSession) return false;
        this.currentSession.metadata[key] = value;
        return true;
    },

    /**
     * Calculate session checksum (for integrity verification)
     */
    calculateChecksum: function(session) {
        // Create deterministic string from critical session data
        const criticalData = {
            sessionId: session.sessionId,
            timestamp: session.timestamp,
            totalCases: session.results.totalCases,
            pagesScanned: session.results.pagesScanned
        };

        const dataString = JSON.stringify(criticalData);
        
        // Simple hash (in real implementation, use crypto.subtle.digest)
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return `sha256:${Math.abs(hash).toString(16)}`;
    },

    /**
     * Archive completed session
     */
    archiveSession: function() {
        if (!this.currentSession) return;

        // Add to history
        this.sessionHistory.unshift(this.currentSession);

        // Keep last 20 sessions
        if (this.sessionHistory.length > 20) {
            this.sessionHistory = this.sessionHistory.slice(0, 20);
        }

        // Save to storage
        this.saveToStorage();

        console.log('[ScanSession] Session archived:', this.currentSession.sessionId);
    },

    /**
     * Save session history to storage
     */
    saveToStorage: async function() {
        try {
            await chrome.storage.local.set({
                scanSessionHistory: this.sessionHistory
            });
        } catch (e) {
            console.error('[ScanSession] Failed to save history:', e);
        }
    },

    /**
     * Load session history from storage
     */
    loadFromStorage: async function() {
        try {
            const result = await chrome.storage.local.get(['scanSessionHistory']);
            if (result.scanSessionHistory) {
                this.sessionHistory = result.scanSessionHistory;
                console.log('[ScanSession] Loaded', this.sessionHistory.length, 'sessions');
            }
        } catch (e) {
            console.error('[ScanSession] Failed to load history:', e);
        }
    },

    /**
     * Get session by ID
     */
    getSession: function(sessionId) {
        return this.sessionHistory.find(s => s.sessionId === sessionId);
    },

    /**
     * Get current session
     */
    getCurrentSession: function() {
        return this.currentSession;
    },

    /**
     * Get session history
     */
    getHistory: function(limit = 10) {
        return this.sessionHistory.slice(0, limit);
    },

    /**
     * Generate filename for session export
     * Format: Sapphire_Scan_2026-01-26_22-00-to-02-00_BanWarn_Health92_abc123.json
     */
    generateFilename: function(session = null) {
        const s = session || this.currentSession;
        if (!s) return 'scan_session.json';

        const date = new Date(s.timestamp).toISOString().split('T')[0];
        
        // Time range
        let timeRange = '';
        if (s.config.timing.range) {
            const start = s.config.timing.range.start || '';
            const end = s.config.timing.range.end || '';
            if (start && end) {
                const startTime = start.split(' ')[1] || start;
                const endTime = end.split(' ')[1] || end;
                timeRange = `_${startTime.replace(/:/g, '-')}-to-${endTime.replace(/:/g, '-')}`;
            }
        }

        // Penalty types
        const types = s.config.target.penaltyTypes.length > 0
            ? s.config.target.penaltyTypes.join('')
            : 'All';

        // Health score
        const health = s.health.avgScore || 0;

        // Session ID (short)
        const shortId = s.sessionId.split('_').pop();

        return `Sapphire_Scan_${date}${timeRange}_${types}_Health${health}_${shortId}.json`;
    },

    /**
     * Export session to JSON file
     */
    exportSession: function(session = null, download = true) {
        const s = session || this.currentSession;
        if (!s) {
            console.error('[ScanSession] No session to export');
            return null;
        }

        const json = JSON.stringify(s, null, 2);

        if (download) {
            const filename = this.generateFilename(s);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            console.log('[ScanSession] Exported:', filename);
        }

        return json;
    },

    /**
     * Import session from JSON
     */
    importSession: function(jsonString) {
        try {
            const session = JSON.parse(jsonString);
            
            // Validate checksum
            const calculatedChecksum = this.calculateChecksum(session);
            if (session.checksum && session.checksum !== calculatedChecksum) {
                console.warn('[ScanSession] Checksum mismatch - data may be corrupted');
            }

            // Add to history
            this.sessionHistory.unshift(session);
            this.saveToStorage();

            console.log('[ScanSession] Imported session:', session.sessionId);
            return session;
        } catch (e) {
            console.error('[ScanSession] Failed to import session:', e);
            return null;
        }
    },

    /**
     * Compare two sessions
     */
    compareSessions: function(sessionId1, sessionId2) {
        const s1 = this.getSession(sessionId1);
        const s2 = this.getSession(sessionId2);

        if (!s1 || !s2) {
            console.error('[ScanSession] One or both sessions not found');
            return null;
        }

        return {
            sessions: {
                first: { id: s1.sessionId, timestamp: s1.timestamp },
                second: { id: s2.sessionId, timestamp: s2.timestamp }
            },
            results: {
                totalCases: {
                    first: s1.results.totalCases,
                    second: s2.results.totalCases,
                    diff: s2.results.totalCases - s1.results.totalCases,
                    percentChange: s1.results.totalCases > 0 
                        ? ((s2.results.totalCases - s1.results.totalCases) / s1.results.totalCases * 100).toFixed(2) + '%'
                        : 'N/A'
                },
                pagesScanned: {
                    first: s1.results.pagesScanned,
                    second: s2.results.pagesScanned,
                    diff: s2.results.pagesScanned - s1.results.pagesScanned
                },
                duration: {
                    first: s1.results.duration,
                    second: s2.results.duration,
                    diff: s2.results.duration - s1.results.duration
                }
            },
            health: {
                avgScore: {
                    first: s1.health.avgScore,
                    second: s2.health.avgScore,
                    diff: s2.health.avgScore - s1.health.avgScore
                }
            }
        };
    },

    /**
     * Get session summary (for UI display)
     */
    getSessionSummary: function(session = null) {
        const s = session || this.currentSession;
        if (!s) return null;

        return {
            id: s.sessionId,
            timestamp: s.timestamp,
            status: s.status,
            totalCases: s.results.totalCases,
            duration: this.formatDuration(s.results.duration),
            health: s.health.avgScore,
            errors: s.errors.length,
            warnings: s.warnings.length
        };
    },

    /**
     * Format duration in human-readable format
     */
    formatDuration: function(ms) {
        if (!ms) return '0s';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    },

    /**
     * Clear all session history
     */
    clearHistory: async function() {
        this.sessionHistory = [];
        this.currentSession = null;
        await this.saveToStorage();
        console.log('[ScanSession] History cleared');
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.ScanSessionEngine = ScanSessionEngine;
}

console.log('✅ Lutheus CezaRapor: Scan Session Engine loaded');
