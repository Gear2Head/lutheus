require('dotenv').config();
const dns = require('dns');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

dns.setDefaultResultOrder?.('ipv4first');

try {
    const { Agent, setGlobalDispatcher } = require('undici');
    setGlobalDispatcher(new Agent({
        connect: { timeout: 30000 },
        headersTimeout: 30000,
        bodyTimeout: 30000
    }));
} catch {
    // undici is optional in this entrypoint; Discord.js will still use its own REST client.
}

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1500551629768888542';
const TARGET_GUILD_ID = process.env.DISCORD_TARGET_GUILD_ID || process.env.DISCORD_GUILD_ID || '1354854696874938590';
const startedAt = Date.now();
const runtime = {
    ready: false,
    status: 'booting',
    loginAttempts: 0,
    lastError: null,
    lastReadyAt: null
};

function audit(event, payload = {}) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload }));
}

function inviteUrl(clientId = CLIENT_ID, options = {}) {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'bot applications.commands');
    url.searchParams.set('permissions', '8');
    url.searchParams.set('integration_type', '0');
    if (options.guildId) {
        url.searchParams.set('guild_id', options.guildId);
        url.searchParams.set('disable_guild_select', 'true');
    }
    return url.toString();
}

async function validateToken() {
    if (!process.env.DISCORD_TOKEN) {
        return { present: false, valid: false, error: 'DISCORD_TOKEN_MISSING' };
    }
    try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
            signal: AbortSignal.timeout(30000)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            return { present: true, valid: false, error: payload?.message || `HTTP_${response.status}` };
        }
        return {
            present: true,
            valid: true,
            userId: payload.id,
            tag: payload.discriminator === '0' ? payload.username : `${payload.username}#${payload.discriminator}`,
            matchesConfiguredClientId: String(payload.id) === String(CLIENT_ID)
        };
    } catch (error) {
        return { present: true, valid: false, error: error.name === 'TimeoutError' ? 'DISCORD_REST_TIMEOUT' : error.message };
    }
}

// Client Ayarlari
const client = new Client({
    rest: {
        timeout: 30000,
        retries: 5
    },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// 1. Command Handler
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// 2. Event Handler
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// 3. Health Check & Dashboard Server (HF Uyumu)
const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
    res.send(`
        <body style="background:#07070a;color:#f5f5f8;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0">
            <div style="text-align:center;border:1px solid #272733;padding:40px;border-radius:12px;background:#121217">
                <h1 style="margin:0;color:#8a5cf5">Lutheus Guard v4</h1>
                <p style="color:#8d8d9a">Bot Durumu: <span style="color:#22c55e">${client.user ? 'AKTIF' : 'BASLATILIYOR'}</span></p>
                <p style="color:#8d8d9a">Uptime: ${Math.floor((Date.now() - startedAt) / 1000)}s</p>
            </div>
        </body>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        ok: runtime.ready,
        status: runtime.status,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        guilds: client.guilds.cache.size,
        invite: inviteUrl(CLIENT_ID, { guildId: TARGET_GUILD_ID })
    });
});

app.get(['/invite', '/invite-lutheus', '/invite-url'], (req, res) => {
    const guildId = req.path === '/invite-lutheus' ? TARGET_GUILD_ID : req.query.guild_id;
    res.redirect(inviteUrl(CLIENT_ID, { guildId }));
});

app.get('/diagnostics', async (req, res) => {
    const token = await validateToken();
    res.json({
        ok: runtime.ready && token.valid,
        runtime: {
            ...runtime,
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
        },
        invite: {
            clientId: CLIENT_ID,
            permissions: '8',
            scopes: ['bot', 'applications.commands'],
            integrationType: 0,
            targetGuildId: TARGET_GUILD_ID,
            canonicalInvite: inviteUrl(CLIENT_ID),
            targetGuildInvite: inviteUrl(CLIENT_ID, { guildId: TARGET_GUILD_ID }),
            commonBadInvite: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}`,
            checks: [
                'Sadece client_id iceren link botu eklemez; scope=bot+applications.commands zorunludur.',
                'Discord Developer Portal > Installation: Guild Install acik olmali.',
                'Discord Developer Portal > Bot: Public Bot acik olmali veya uygulama sahibi sunucuya eklemelidir.',
                'Bot sunucuya eklense bile gateway baglantisi yoksa offline gorunur.'
            ]
        },
        token
    });
});

client.once('ready', () => {
    runtime.ready = true;
    runtime.status = 'ready';
    runtime.lastReadyAt = new Date().toISOString();
    runtime.lastError = null;
    audit('BOT_READY', {
        userId: client.user?.id,
        tag: client.user?.tag,
        guilds: client.guilds.cache.size
    });
});

client.on('guildCreate', (guild) => {
    audit('GUILD_JOINED', { guildId: guild.id, guildName: guild.name });
});

app.listen(PORT, () => {
    console.log(`[System] Health server running on port ${PORT}`);
});

async function loginWithRetry() {
    if (!process.env.DISCORD_TOKEN) {
        runtime.status = 'missing_token';
        runtime.lastError = 'DISCORD_TOKEN_MISSING';
        audit('FATAL', { error: 'DISCORD_TOKEN_MISSING' });
        return;
    }

    while (!runtime.ready) {
        runtime.loginAttempts += 1;
        runtime.status = 'login_attempt';
        audit('LOGIN_ATTEMPT', { attempt: runtime.loginAttempts });
        try {
            await client.login(process.env.DISCORD_TOKEN);
            return;
        } catch (error) {
            runtime.status = 'login_retry_wait';
            runtime.lastError = error.message;
            const retryInMs = Math.min(60000, 3000 * Math.pow(1.6, Math.min(runtime.loginAttempts, 8)));
            audit('LOGIN_RETRY_SCHEDULED', {
                attempt: runtime.loginAttempts,
                retryInMs: Math.round(retryInMs),
                error: error.message
            });
            await new Promise((resolve) => setTimeout(resolve, retryInMs));
        }
    }
}

loginWithRetry();
