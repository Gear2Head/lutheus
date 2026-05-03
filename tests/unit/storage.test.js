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
