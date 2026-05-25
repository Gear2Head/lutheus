const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadNetworkListener() {
    const listeners = {};
    const sentMessages = [];
    const contextWindow = {
        addEventListener: jest.fn((eventName, handler) => {
            listeners[eventName] = handler;
        })
    };

    const context = {
        window: contextWindow,
        chrome: {
            storage: {
                local: {
                    get: jest.fn((_keys, cb) => cb({ lutheus_seen_keys: [] })),
                    set: jest.fn(() => Promise.resolve())
                }
            },
            runtime: {
                sendMessage: jest.fn((message) => {
                    sentMessages.push(message);
                    return Promise.resolve();
                })
            }
        },
        console
    };
    contextWindow.window = contextWindow;

    const source = fs.readFileSync(path.join(__dirname, '../../src/content/network_listener.js'), 'utf8');
    vm.runInNewContext(source, context, { filename: 'network_listener.js' });

    return { listeners, sentMessages, window: contextWindow };
}

describe('network listener payload normalization', () => {
    test('normalizes Sapphire alias payloads into canonical intercepted records', async () => {
        const { listeners, sentMessages, window } = loadNetworkListener();

        listeners.message({
            source: window,
            data: {
                source: 'LUTHEUS_INTERCEPTOR',
                type: 'NETWORK_PAYLOAD',
                url: 'https://dashboard.sapph.xyz/api/v2/guilds/1223431616081166336/modlogs',
                payload: {
                    data: {
                        records: [{
                            case_id: 'ABC12345',
                            targetUser: { id: '111111111111111111', username: 'TargetUser' },
                            executor: { id: '222222222222222222', username: 'ModUser' },
                            punishment_type: 'mute',
                            notes: 'Spam',
                            expires_at: '2026-05-25T12:00:00.000Z',
                            created_at: '2026-05-25T10:00:00.000Z',
                            guild_id: '1223431616081166336'
                        }]
                    }
                }
            }
        });

        await Promise.resolve();

        expect(sentMessages).toHaveLength(1);
        expect(sentMessages[0]).toMatchObject({
            action: 'INTERCEPTED_PUNISHMENTS',
            records: [{
                id: 'ABC12345',
                caseId: 'ABC12345',
                userId: '111111111111111111',
                username: 'TargetUser',
                moderatorId: '222222222222222222',
                moderator: 'ModUser',
                type: 'mute',
                reason: 'Spam',
                duration: '2026-05-25T12:00:00.000Z',
                createdAt: '2026-05-25T10:00:00.000Z',
                guildId: '1223431616081166336'
            }]
        });
    });
});
