// Utility functions - Enhanced

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('#')) return escapeHtml(trimmed);
    return '#';
}

export function escapeFields(obj, fields) {
    const result = { ...obj };
    for (const field of fields) {
        if (result[field] !== undefined) {
            result[field] = escapeHtml(result[field]);
        }
    }
    return result;
}

export function normalizeText(value) {
    return (value || '')
        .toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function slugifyChannel(value) {
    return normalizeText(value)
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function generateAsciiTable(headers, rows) {
    const colWidths = headers.map((header, i) => {
        return Math.max(header.length, ...rows.map((row) => (row[i] || '').toString().length));
    });

    const separator = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';

    let table = separator + '\n';
    table += '|' + headers.map((h, i) => ' ' + h.padEnd(colWidths[i]) + ' ').join('|') + '|\n';
    table += separator + '\n';

    rows.forEach((row) => {
        table += '|' + row.map((cell, i) => ' ' + (cell || '').toString().padEnd(colWidths[i]) + ' ').join('|') + '|\n';
    });

    table += separator;
    return table;
}

export function parseDate(dateStr) {
    if (!dateStr) return null;
    const lower = dateStr.toLowerCase().trim();

    // DD.MM.YYYY
    const ddmmyyyy = lower.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    }

    // Relative Turkish: "X gün önce", "X saat önce", etc.
    const trRelative = lower.match(/(\d+)\s*(gün|saat|dakika|hafta|ay)\s*önce/i);
    if (trRelative) {
        const [, amount, unit] = trRelative;
        const now = new Date();
        const multipliers = {
            dakika: 60 * 1000,
            saat: 60 * 60 * 1000,
            gün: 24 * 60 * 60 * 1000,
            hafta: 7 * 24 * 60 * 60 * 1000,
            ay: 30 * 24 * 60 * 60 * 1000
        };
        return new Date(now.getTime() - (parseInt(amount, 10) * multipliers[unit.toLowerCase()]));
    }

    if (lower === 'bugün') return new Date();
    if (lower === 'dün') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }

    // Relative English
    const relativeMatch = lower.match(/(\d+)\s*(day|hour|minute|week|month)s?\s*ago/i);
    if (relativeMatch) {
        const [, amount, unit] = relativeMatch;
        const now = new Date();
        const multipliers = {
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000
        };
        return new Date(now.getTime() - (parseInt(amount, 10) * multipliers[unit.toLowerCase()]));
    }

    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTurkishDate(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function formatTurkishDateTime(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function getLastWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    const endDate = new Date(now);
    const daysSinceSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
    endDate.setDate(now.getDate() - daysSinceSunday);
    endDate.setHours(21, 0, 0, 0);

    if (dayOfWeek === 0 && now.getHours() < 21) {
        endDate.setDate(endDate.getDate() - 7);
    }

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 7);

    return { startDate, endDate };
}

export function isDateInRange(date, startDate, endDate) {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    return d >= startDate && d <= endDate;
}

export function calculatePerformanceDelta(current, previous) {
    if (!previous) {
        return {
            totalCasesChange: 0,
            totalCasesPercent: 0,
            topModeratorChanged: false,
            moderatorDeltas: {}
        };
    }

    const totalCasesChange = (current.totalCases || 0) - (previous.totalCases || 0);
    const totalCasesPercent = previous.totalCases > 0
        ? Math.round((totalCasesChange / previous.totalCases) * 100)
        : 0;

    const topModeratorChanged = current.topModerator?.name !== previous.topModerator?.name;

    const moderatorDeltas = {};
    const allMods = new Set([
        ...Object.keys(current.moderatorStats || {}),
        ...Object.keys(previous.moderatorStats || {})
    ]);

    allMods.forEach((moderatorName) => {
        const currentCount = current.moderatorStats?.[moderatorName]?.count || 0;
        const previousCount = previous.moderatorStats?.[moderatorName]?.count || 0;
        const delta = currentCount - previousCount;

        if (delta !== 0) {
            moderatorDeltas[moderatorName] = {
                current: currentCount,
                previous: previousCount,
                delta,
                isNew: previousCount === 0,
                isInactive: currentCount === 0
            };
        }
    });

    return {
        totalCasesChange,
        totalCasesPercent,
        topModeratorChanged,
        previousTopModerator: previous.topModerator?.name,
        currentTopModerator: current.topModerator?.name,
        moderatorDeltas
    };
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str, maxLength = 30) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function getWeekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}
