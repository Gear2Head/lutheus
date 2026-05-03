const {
    escapeHtml,
    safeUrl,
    parseDate,
    getWeekKey,
    truncate,
    formatNumber
} = require('../../src/lib/utils.js');

describe('escapeHtml', () => {
    test('escapes script tags', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('returns empty string for nullish values', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('safeUrl', () => {
    test('accepts http urls', () => {
        expect(safeUrl('https://example.com')).toBe('https://example.com');
    });

    test('rejects javascript urls', () => {
        expect(safeUrl('javascript:alert(1)')).toBe('#');
    });
});

describe('parseDate', () => {
    test('parses dd.mm.yyyy', () => {
        const date = parseDate('15.03.2026');
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(2);
        expect(date.getDate()).toBe(15);
    });

    test('returns null for invalid input', () => {
        expect(parseDate('not-a-date')).toBeNull();
    });
});

describe('week and formatting helpers', () => {
    test('getWeekKey returns iso-like key', () => {
        expect(getWeekKey(new Date('2026-01-05'))).toMatch(/^\d{4}-W\d{2}$/);
    });

    test('truncate shortens long strings', () => {
        expect(truncate('A'.repeat(40), 20)).toHaveLength(20);
    });

    test('formatNumber formats thousands', () => {
        expect(formatNumber(1000000)).toBe('1.000.000');
    });
});
