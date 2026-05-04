require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Client Ayarlari
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const startedAt = Date.now();

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
        status: client.user ? 'ready' : 'starting',
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        guilds: client.guilds.cache.size
    });
});

app.listen(PORT, () => {
    console.log(`[System] Health server running on port ${PORT}`);
});

// Bot Login
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('[Fatal] Login failed:', err.message);
    process.exit(1);
});
