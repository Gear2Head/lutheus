const store = {};
const syncStore = {};

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys, cb) => {
                const result = {};
                const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
                list.forEach((key) => { result[key] = store[key]; });
                cb(result);
            }),
            set: jest.fn((obj, cb) => {
                Object.assign(store, obj);
                cb && cb();
            }),
            clear: jest.fn((cb) => {
                Object.keys(store).forEach((key) => delete store[key]);
                cb && cb();
            })
        },
        sync: {
            get: jest.fn((keys, cb) => {
                if (keys === null) {
                    cb({ ...syncStore });
                    return;
                }

                const result = {};
                const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
                list.forEach((key) => { result[key] = syncStore[key]; });
                cb(result);
            }),
            set: jest.fn((obj, cb) => {
                Object.assign(syncStore, obj);
                cb && cb();
            }),
            remove: jest.fn((keys, cb) => {
                [].concat(keys).forEach((key) => delete syncStore[key]);
                cb && cb();
            }),
            clear: jest.fn((cb) => {
                Object.keys(syncStore).forEach((key) => delete syncStore[key]);
                cb && cb();
            })
        }
    }
};

const { Storage, escapeHtml } = require('../../src/lib/storage.js');

beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    Object.keys(syncStore).forEach((key) => delete syncStore[key]);
    jest.clearAllMocks();
});

describe('Storage.saveCases', () => {
    test('records arrays', async () => {
        await Storage.saveCases([{ id: '1', reason: 'Test', authorName: 'Mod1' }]);
        const saved = await Storage.get('cases');
        expect(saved).toHaveLength(1);
    });

    test('rejects non arrays', async () => {
        await expect(Storage.saveCases('bad')).rejects.toThrow(TypeError);
    });
});

describe('Storage.updateCases', () => {
    test('appends new cases', async () => {
        await Storage.saveCases([{ id: '1', reason: 'Old', authorName: 'Mod1' }]);
        await Storage.updateCases([{ id: '2', reason: 'New', authorName: 'Mod2' }], true);
        const cases = await Storage.get('cases');
        expect(cases).toHaveLength(2);
    });

    test('preserves metadata for same case id', async () => {
        await Storage.saveCases([{ id: '1', reason: 'Old', authorName: 'Mod1', note: 'keep-me' }]);
        await Storage.updateCases([{ id: '1', reason: 'New', authorName: 'Mod1' }], true);
        const cases = await Storage.get('cases');
        expect(cases[0].note).toBe('keep-me');
        expect(cases[0].reason).toBe('New');
    });

    test('drops numeric ids from reason field', async () => {
        await Storage.saveCases([{ id: 'case-1', reason: '1249283105467007026', authorName: 'Mod1' }]);
        const cases = await Storage.get('cases');
        expect(cases[0].reason).toBe('');
    });

    test('preserves previous real reason when incoming reason is case-like', async () => {
        await Storage.saveCases([{ id: 'case-2', reason: 'Reklam', authorName: 'Mod1' }]);
        await Storage.updateCases([{ id: 'case-2', reason: 'AB12CD34', authorName: 'Mod1' }], true);
        const cases = await Storage.get('cases');
        expect(cases[0].reason).toBe('Reklam');
    });

    test('stores canonical network fields and preserves manual metadata on merge', async () => {
        await Storage.saveCases([{
            id: 'case-3',
            guildId: 'guild-1',
            reason: 'Spam',
            authorName: 'Mod1',
            note: 'manual',
            reviewStatus: 'reviewed'
        }]);
        await Storage.updateCases([{
            caseId: 'case-3',
            guildId: 'guild-2',
            reason: 'Hakaret',
            capturedVia: 'network_interceptor',
            rawData: { case_id: 'case-3' },
            authorName: 'Mod1'
        }], true);
        const cases = await Storage.get('cases');
        expect(cases[0]).toMatchObject({
            id: 'case-3',
            caseId: 'case-3',
            guildId: 'guild-2',
            capturedVia: 'network_interceptor',
            reason: 'Hakaret',
            note: 'manual',
            reviewStatus: 'reviewed'
        });
        expect(cases[0].rawData).toEqual({ case_id: 'case-3' });
    });

    test('normalizes duration text to milliseconds', async () => {
        await Storage.saveCases([{ id: 'case-4', reason: 'Spam', duration: '3 days', authorName: 'Mod1' }]);
        const cases = await Storage.get('cases');
        expect(cases[0].durationMs).toBe(259200000);
    });

    test('quarantines invalid case payloads', async () => {
        await Storage.updateCases([{ reason: 'missing id', authorName: 'Mod1' }], true);
        const cases = await Storage.get('cases');
        const quarantine = await Storage.getQuarantinedCases();
        expect(cases).toHaveLength(0);
        expect(quarantine[0].reason).toBe('missing_case_id');
    });

    test('marks source mismatch between dom and network records', async () => {
        await Storage.saveCases([{
            id: 'case-5',
            userId: 'user-1',
            reason: 'Spam',
            type: 'mute',
            authorName: 'Mod1',
            capturedVia: 'dom_scraper'
        }]);
        await Storage.updateCases([{
            id: 'case-5',
            userId: 'user-1',
            reason: 'Hakaret',
            type: 'mute',
            authorName: 'Mod1',
            capturedVia: 'network_interceptor'
        }], true);
        const cases = await Storage.get('cases');
        expect(cases[0].sourceMismatch.fields).toContain('reason');
    });

    test('does not store case payloads in chrome sync quota', async () => {
        await Storage.updateCases([{ id: 'abc123', reason: 'Reklam', authorName: 'Mod2' }], true);
        expect(syncStore.cases_meta.count).toBe(1);
        expect(Object.keys(syncStore).some((key) => /^cases_c\d+$/.test(key))).toBe(false);
    });

    test('seeds editable staff roles into registry', async () => {
        const registry = await Storage.getUserRegistry();
        expect(registry['758769576778661989'].role).toBe('kidemli_discord_moderatoru');
        expect(registry['529357404882599966'].role).toBe('discord_moderatoru');
    });
});

describe('Storage session snapshot', () => {
    test('stores and reads consistent snapshot', async () => {
        await Storage.setSessionSnapshot({ timestamp: 42, caseCount: 5 });
        const snapshot = await Storage.getSessionSnapshot();
        expect(snapshot.timestamp).toBe(42);
        expect(snapshot.caseCount).toBe(5);
    });

    test('returns defaults when empty', async () => {
        const snapshot = await Storage.getSessionSnapshot();
        expect(snapshot.timestamp).toBe(0);
        expect(snapshot.caseCount).toBe(0);
    });
});

describe('escapeHtml export', () => {
    test('escapes tags', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });
});
