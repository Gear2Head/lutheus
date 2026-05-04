// Lutheus CezaRapor - Temporal Scan Engine
// Advanced time-based scanning and filtering system

export const TemporalScanEngine = {
    version: '1.0.0',

    // Time modes
    modes: {
        EXACT_RANGE: 'exact_range',     // Kesin zaman aralığı
        TIME_SLOTS: 'time_slots',       // Zaman dilimleri
        EVENT_DRIVEN: 'event_driven',   // Olay bazlı
        RELATIVE: 'relative'            // Göreceli (son X saat/gün)
    },

    // Predefined time slots
    predefinedSlots: {
        WORK_HOURS: {
            name: 'Mesai Saatleri',
            days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            start: '09:00',
            end: '17:00'
        },
        OFF_HOURS: {
            name: 'Mesai Dışı',
            days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            slots: [
                { start: '00:00', end: '09:00' },
                { start: '17:00', end: '23:59' }
            ]
        },
        WEEKEND: {
            name: 'Hafta Sonu',
            days: ['SAT', 'SUN'],
            start: '00:00',
            end: '23:59'
        },
        NIGHT_SHIFT: {
            name: 'Gece Vardiyası',
            days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            start: '22:00',
            end: '06:00'
        },
        PEAK_HOURS: {
            name: 'Yoğun Saatler',
            days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            slots: [
                { start: '12:00', end: '14:00' },
                { start: '18:00', end: '22:00' }
            ]
        }
    },

    /**
     * Create time filter configuration
     * @param {string} mode - Time mode
     * @param {Object} config - Configuration based on mode
     * @returns {Object} Filter configuration
     */
    createFilter: function(mode, config) {
        const filter = {
            mode,
            config,
            createdAt: Date.now(),
            timezone: config.timezone || 'Europe/Istanbul'
        };

        switch (mode) {
            case this.modes.EXACT_RANGE:
                return this.createExactRangeFilter(filter);
            case this.modes.TIME_SLOTS:
                return this.createTimeSlotsFilter(filter);
            case this.modes.EVENT_DRIVEN:
                return this.createEventDrivenFilter(filter);
            case this.modes.RELATIVE:
                return this.createRelativeFilter(filter);
            default:
                throw new Error('Invalid time mode: ' + mode);
        }
    },

    /**
     * Exact Range Filter: "2026-01-20 22:00" to "2026-01-26 02:00"
     */
    createExactRangeFilter: function(filter) {
        const { start, end } = filter.config;
        
        if (!start || !end) {
            throw new Error('Exact range requires start and end timestamps');
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate) || isNaN(endDate)) {
            throw new Error('Invalid date format');
        }

        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }

        filter.startMs = startDate.getTime();
        filter.endMs = endDate.getTime();
        filter.durationHours = (filter.endMs - filter.startMs) / (1000 * 60 * 60);

        filter.test = (timestamp) => {
            const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
            return ts >= filter.startMs && ts <= filter.endMs;
        };

        filter.description = `${this.formatDateTime(startDate)} - ${this.formatDateTime(endDate)}`;

        return filter;
    },

    /**
     * Time Slots Filter: Specific hours/days patterns
     */
    createTimeSlotsFilter: function(filter) {
        const { slots, slotDuration } = filter.config;

        if (slots && Array.isArray(slots)) {
            // Custom slots
            filter.slots = slots.map(slot => this.parseSlot(slot));
        } else if (slotDuration) {
            // Generate slots based on duration (e.g., every 30 minutes)
            filter.slots = this.generateTimeSlots(slotDuration);
        } else {
            throw new Error('Time slots filter requires slots array or slotDuration');
        }

        filter.test = (timestamp) => {
            const date = new Date(timestamp);
            const day = this.getDayCode(date);
            const time = this.getTimeString(date);

            return filter.slots.some(slot => {
                // Check day match
                if (slot.days && !slot.days.includes(day)) {
                    return false;
                }

                // Check time match
                if (slot.slots) {
                    // Multiple time ranges in a day
                    return slot.slots.some(timeRange => 
                        this.isTimeInRange(time, timeRange.start, timeRange.end)
                    );
                } else {
                    // Single time range
                    return this.isTimeInRange(time, slot.start, slot.end);
                }
            });
        };

        filter.description = this.describeSlotsFilter(filter.slots);

        return filter;
    },

    /**
     * Event Driven Filter: Match specific event time windows
     */
    createEventDrivenFilter: function(filter) {
        const { events } = filter.config;

        if (!events || !Array.isArray(events)) {
            throw new Error('Event driven filter requires events array');
        }

        filter.events = events.map(event => {
            const startDate = new Date(event.start);
            const durationMs = (event.duration || 1) * 60 * 60 * 1000; // hours to ms
            const endDate = new Date(startDate.getTime() + durationMs);

            return {
                name: event.name,
                startMs: startDate.getTime(),
                endMs: endDate.getTime(),
                recurring: event.recurring || false,
                recurPattern: event.recurPattern || null
            };
        });

        filter.test = (timestamp) => {
            const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;

            return filter.events.some(event => {
                if (event.recurring && event.recurPattern) {
                    // Check recurring pattern (e.g., every Monday 20:00)
                    return this.matchesRecurringPattern(ts, event.recurPattern);
                } else {
                    // One-time event
                    return ts >= event.startMs && ts <= event.endMs;
                }
            });
        };

        filter.description = filter.events.map(e => e.name).join(', ');

        return filter;
    },

    /**
     * Relative Filter: "Son 7 gün", "Son 24 saat"
     */
    createRelativeFilter: function(filter) {
        const { amount, unit } = filter.config; // e.g., { amount: 7, unit: 'days' }

        if (!amount || !unit) {
            throw new Error('Relative filter requires amount and unit');
        }

        const unitMs = {
            'minutes': 60 * 1000,
            'hours': 60 * 60 * 1000,
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000
        };

        if (!unitMs[unit]) {
            throw new Error('Invalid time unit: ' + unit);
        }

        filter.durationMs = amount * unitMs[unit];
        filter.anchorTime = filter.config.anchorTime || Date.now(); // Reference time

        filter.test = (timestamp) => {
            const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
            const cutoffTime = filter.anchorTime - filter.durationMs;
            return ts >= cutoffTime && ts <= filter.anchorTime;
        };

        const unitNames = {
            'minutes': 'dakika',
            'hours': 'saat',
            'days': 'gün',
            'weeks': 'hafta'
        };

        filter.description = `Son ${amount} ${unitNames[unit] || unit}`;

        return filter;
    },

    /**
     * Apply filter to case data
     */
    filterCases: function(cases, filter) {
        if (!filter || !filter.test) {
            console.warn('[TemporalScan] Invalid filter, returning all cases');
            return cases;
        }

        const filtered = cases.filter(caseData => {
            // Try multiple timestamp sources
            const timestamp = caseData.timestamp 
                || caseData.createdAt 
                || caseData.scrapedAt
                || this.parseCreatedRaw(caseData.createdRaw);

            if (!timestamp) {
                console.warn('[TemporalScan] Case has no timestamp:', caseData.id);
                return false;
            }

            return filter.test(timestamp);
        });

        return filtered;
    },

    /**
     * Detect time drift (system vs browser vs dashboard)
     */
    detectTimeDrift: function(dashboardTimestamp) {
        const systemTime = Date.now();
        const browserTime = performance.timeOrigin + performance.now();
        const dashboardTime = new Date(dashboardTimestamp).getTime();

        const driftSystemToDashboard = Math.abs(systemTime - dashboardTime);
        const driftBrowserToDashboard = Math.abs(browserTime - dashboardTime);

        const maxDrift = Math.max(driftSystemToDashboard, driftBrowserToDashboard);

        return {
            systemTime,
            browserTime,
            dashboardTime,
            driftSystemToDashboard,
            driftBrowserToDashboard,
            maxDrift,
            acceptable: maxDrift < 60000, // Less than 1 minute is acceptable
            warning: maxDrift > 60000 && maxDrift < 300000, // 1-5 minutes
            critical: maxDrift > 300000 // More than 5 minutes
        };
    },

    /**
     * Parse Sapphire dashboard timestamp (DD.MM.YYYY format)
     */
    parseCreatedRaw: function(createdRaw) {
        if (!createdRaw) return null;

        // Match DD.MM.YYYY pattern
        const match = createdRaw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!match) return null;

        const [, day, month, year] = match;
        const date = new Date(`${year}-${month}-${day}T00:00:00`);
        
        return isNaN(date) ? null : date.getTime();
    },

    /**
     * Helper: Get day code (MON, TUE, etc.)
     */
    getDayCode: function(date) {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        return days[date.getDay()];
    },

    /**
     * Helper: Get time string (HH:MM)
     */
    getTimeString: function(date) {
        return date.toTimeString().substring(0, 5);
    },

    /**
     * Helper: Check if time is in range
     */
    isTimeInRange: function(time, start, end) {
        // Handle overnight ranges (e.g., 22:00 - 06:00)
        if (end < start) {
            return time >= start || time <= end;
        }
        return time >= start && time <= end;
    },

    /**
     * Helper: Parse slot configuration
     */
    parseSlot: function(slot) {
        if (typeof slot === 'string') {
            // Predefined slot name
            return this.predefinedSlots[slot] || null;
        }
        return slot;
    },

    /**
     * Helper: Generate time slots based on duration
     */
    generateTimeSlots: function(durationMinutes) {
        const slots = [];
        const totalMinutes = 24 * 60;
        
        for (let minutes = 0; minutes < totalMinutes; minutes += durationMinutes) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const startTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            
            const endMinutes = minutes + durationMinutes;
            const endHours = Math.floor(endMinutes / 60) % 24;
            const endMins = endMinutes % 60;
            const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

            slots.push({
                start: startTime,
                end: endTime,
                days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
            });
        }

        return slots;
    },

    /**
     * Helper: Check recurring pattern
     */
    matchesRecurringPattern: function(timestamp, pattern) {
        const date = new Date(timestamp);
        const day = this.getDayCode(date);
        const time = this.getTimeString(date);

        if (pattern.days && !pattern.days.includes(day)) {
            return false;
        }

        if (pattern.time) {
            const [targetHour, targetMin] = pattern.time.split(':');
            const [currentHour, currentMin] = time.split(':');
            
            // Allow ±30 minutes tolerance
            const targetMinutes = parseInt(targetHour) * 60 + parseInt(targetMin);
            const currentMinutes = parseInt(currentHour) * 60 + parseInt(currentMin);
            const diff = Math.abs(targetMinutes - currentMinutes);
            
            return diff <= 30;
        }

        return true;
    },

    /**
     * Helper: Format date time
     */
    formatDateTime: function(date) {
        return date.toLocaleString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Helper: Describe slots filter
     */
    describeSlotsFilter: function(slots) {
        if (slots.length === 1) {
            const slot = slots[0];
            return `${slot.days?.join(', ') || 'Tüm günler'} ${slot.start}-${slot.end}`;
        }
        return `${slots.length} zaman dilimi`;
    },

    /**
     * Get predefined filter by name
     */
    getPredefinedFilter: function(name) {
        const slot = this.predefinedSlots[name];
        if (!slot) {
            throw new Error('Unknown predefined filter: ' + name);
        }

        return this.createFilter(this.modes.TIME_SLOTS, { slots: [slot] });
    },

    /**
     * Analyze time distribution of cases
     */
    analyzeTimeDistribution: function(cases) {
        const hourCounts = new Array(24).fill(0);
        const dayCounts = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };

        cases.forEach(caseData => {
            const timestamp = caseData.timestamp 
                || caseData.createdAt 
                || caseData.scrapedAt
                || this.parseCreatedRaw(caseData.createdRaw);

            if (timestamp) {
                const date = new Date(timestamp);
                const hour = date.getHours();
                const day = this.getDayCode(date);

                hourCounts[hour]++;
                dayCounts[day]++;
            }
        });

        // Find peak hour
        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
        const peakDay = Object.keys(dayCounts).reduce((a, b) => 
            dayCounts[a] > dayCounts[b] ? a : b
        );

        return {
            hourCounts,
            dayCounts,
            peakHour,
            peakDay,
            totalAnalyzed: cases.length
        };
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.TemporalScanEngine = TemporalScanEngine;
}

console.log('✅ Lutheus CezaRapor: Temporal Scan Engine loaded');
