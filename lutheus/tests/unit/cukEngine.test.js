global.window = {};

const {
    parseDuration,
    formatDuration,
    CUKEngine,
    PenaltyStatus
} = require('../../src/lib/cukEngine.js');

describe('parseDuration', () => {
    test('parses infinity aliases', () => {
        expect(parseDuration('süresiz')).toBe(Infinity);
        expect(parseDuration('perm')).toBe(Infinity);
    });

    test('parses minute and hour values', () => {
        expect(parseDuration('30 dk')).toBe(30);
        expect(parseDuration('2 saat')).toBe(120);
    });
});

describe('formatDuration', () => {
    test('formats infinity and hour values', () => {
        expect(formatDuration(Infinity)).toBe('Süresiz');
        expect(formatDuration(60)).toBe('1 saat');
    });
});

describe('CUKEngine.validate', () => {
    test('empty reason is invalid', () => {
        const result = CUKEngine.validate({ reason: '', duration: '30 dk', type: 'mute' });
        expect(result.status).toBe(PenaltyStatus.INVALID);
    });

    test('manual override is respected', () => {
        const result = CUKEngine.validate({
            reason: 'Küfür',
            duration: '30 dk',
            type: 'mute',
            reviewStatus: PenaltyStatus.VALID
        });
        expect(result.status).toBe(PenaltyStatus.VALID);
    });
});
