// Shared duration parser for extension (DOM scraper + service worker)

function parseDurationText(durationStr) {
    if (durationStr === null || durationStr === undefined || durationStr === '') return null;
    if (typeof durationStr === 'number') return durationStr;

    let str = String(durationStr).toLowerCase().trim();

    const index = str.search(/\b(in|kalan)\b/i);
    if (index !== -1) {
        str = str.substring(0, index).trim();
    }
    str = str.replace(/\s*\(\s*$/, '').trim();

    if (str.includes('süresiz') || str.includes('perma') || str.includes('sonsuz') || str.includes('perm') || str.includes('belirsiz') || str.includes('kalıcı') || str.includes('kalici') || str.includes('permanent')) {
        return Infinity;
    }

    const patterns = [
        { regex: /(\d+)\s*(saniye|sec|seconds?|sn|s)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 1 / 60 },
        { regex: /(\d+)\s*(dakika|min|minutes?|dk|m)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 1 },
        { regex: /(\d+)\s*(saat|hours?|hour|sa|h)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 },
        { regex: /(\d+)\s*(gün|gun|days?|day|g|d)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 },
        { regex: /(\d+)\s*(hafta|weeks?|week|hf|w)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 7 },
        { regex: /(\d+)\s*(ay|months?|month)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 30 },
        { regex: /(\d+)\s*(yıl|yil|sene|years?|year|y)(?![a-zA-ZçğıöşüÇĞIÖŞÜ])/i, multiplier: 60 * 24 * 365 }
    ];

    let totalMinutes = 0;
    let found = false;

    for (const { regex, multiplier } of patterns) {
        const matches = str.match(new RegExp(regex.source, 'gi'));
        if (matches) {
            for (const match of matches) {
                const numMatch = match.match(/\d+/);
                if (numMatch) {
                    totalMinutes += parseInt(numMatch[0], 10) * multiplier;
                    found = true;
                }
            }
        }
    }

    if (str.includes('99 year') || str.includes('99 yıl') || str.includes('99 sene') || str.includes('99y')) return Infinity;

    return found ? totalMinutes : null;
}

function parseDurationMs(durationStr) {
    const mins = parseDurationText(durationStr);
    if (mins === null) return null;
    if (mins === Infinity) return null;
    return Math.round(mins * 60 * 1000);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDurationText, parseDurationMs };
}

if (typeof globalThis !== 'undefined') {
    globalThis.LutheusParseDuration = { parseDurationText, parseDurationMs };
}
