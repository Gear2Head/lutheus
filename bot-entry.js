try {
  require('dotenv').config({ quiet: true });
} catch (error) {
  if (error && error.code !== 'MODULE_NOT_FOUND') throw error;
}

const http = require('http');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

dns.setDefaultResultOrder?.('ipv4first');

try {
  const { Agent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new Agent({
    connect: { timeout: Number(process.env.DISCORD_CONNECT_TIMEOUT_MS || 30000) },
    headersTimeout: Number(process.env.DISCORD_HEADERS_TIMEOUT_MS || 30000),
    bodyTimeout: Number(process.env.DISCORD_BODY_TIMEOUT_MS || 30000)
  }));
} catch (error) {
  if (error && error.code !== 'MODULE_NOT_FOUND') throw error;
}

const PORT = Number(process.env.PORT || 7860);
const BRAND = process.env.BOT_BRAND || 'Lutheus Guard';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1500551629768888542';
const TARGET_GUILD_ID = process.env.DISCORD_TARGET_GUILD_ID || process.env.DISCORD_GUILD_ID || '1354854696874938590';
const INVITE_PERMISSIONS = process.env.DISCORD_INVITE_PERMISSIONS || '8';
const DISCORD_API_BASE = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
const LOGIN_TIMEOUT_MS = Number(process.env.DISCORD_LOGIN_TIMEOUT_MS || 45000);
const REST_TIMEOUT_MS = Number(process.env.DISCORD_REST_TIMEOUT_MS || 30000);

const startedAt = Date.now();
const runtime = {
  ready: false,
  status: 'starting',
  loginAttempts: 0,
  commandCount: 0,
  lastCommandAt: null,
  lastError: null,
  clientId: CLIENT_ID,
  tag: null,
  guilds: 0
};

function audit(event, payload = {}) {
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload }) + '\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label}_TIMEOUT`);
      error.code = `${label}_TIMEOUT`;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function resolveGatewayIntents() {
  const intents = [GatewayIntentBits.Guilds];
  if (process.env.DISCORD_ENABLE_MESSAGE_CONTENT === 'true') {
    intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  }
  if (process.env.DISCORD_ENABLE_GUILD_MEMBERS === 'true') {
    intents.push(GatewayIntentBits.GuildMembers);
  }
  return intents;
}

function inviteUrl(clientId = runtime.clientId || CLIENT_ID, options = {}) {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'bot applications.commands');
  url.searchParams.set('permissions', INVITE_PERMISSIONS);
  url.searchParams.set('integration_type', '0');
  if (options.guildId) {
    url.searchParams.set('guild_id', options.guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
}

function inviteDiagnostics() {
  return {
    clientId: runtime.clientId || CLIENT_ID,
    permissions: INVITE_PERMISSIONS,
    scopes: ['bot', 'applications.commands'],
    integrationType: 0,
    targetGuildId: TARGET_GUILD_ID,
    canonicalInvite: inviteUrl(),
    targetGuildInvite: inviteUrl(runtime.clientId || CLIENT_ID, { guildId: TARGET_GUILD_ID }),
    commonBadInvite: `https://discord.com/oauth2/authorize?client_id=${runtime.clientId || CLIENT_ID}`,
    checks: [
      'Sadece client_id iceren link botu eklemez; scope=bot+applications.commands zorunludur.',
      'Bot online degilse /diagnostics token, REST ve gateway durumunu gosterir.',
      'Privileged intentler varsayilan kapali. Gerekirse env ile DISCORD_ENABLE_GUILD_MEMBERS=true yapin.'
    ]
  };
}

async function discordApi(pathname, options = {}) {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN_MISSING');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL(pathname, DISCORD_API_BASE), {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`DISCORD_REST_${response.status}: ${payload?.message || response.statusText}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function tokenDiagnostics() {
  try {
    const user = await discordApi('/users/@me');
    return {
      present: true,
      valid: true,
      userId: user.id,
      tag: user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user.username,
      matchesConfiguredClientId: String(user.id) === String(CLIENT_ID),
      error: null
    };
  } catch (error) {
    return {
      present: Boolean(process.env.DISCORD_TOKEN),
      valid: false,
      userId: null,
      tag: null,
      matchesConfiguredClientId: null,
      error: error.name === 'AbortError' ? 'DISCORD_REST_TIMEOUT' : error.message
    };
  }
}

function statusPayload() {
  return {
    ok: runtime.ready,
    service: 'lutheus-discord-bot',
    ready: runtime.ready,
    status: runtime.status,
    loginAttempts: runtime.loginAttempts,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    commandCount: runtime.commandCount,
    lastCommandAt: runtime.lastCommandAt,
    lastError: runtime.lastError,
    clientId: runtime.clientId || CLIENT_ID,
    tag: runtime.tag,
    guilds: runtime.guilds
  };
}

function htmlPage() {
  const payload = statusPayload();
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${BRAND}</title>
  <style>
    :root{color-scheme:dark;--bg:#07070a;--panel:#121217;--line:#272733;--text:#f5f5f8;--muted:#8d8d9a;--accent:#8a5cf5;--ok:#22c55e;--bad:#ef4444}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(920px,100%);display:grid;gap:18px}.hero{border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:28px;display:grid;gap:20px}
    h1{margin:0;font-size:30px}.sub{color:var(--muted);margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
    .card{border:1px solid var(--line);background:#0d0d12;border-radius:8px;padding:14px}.label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.value{font-size:22px;font-weight:800;margin-top:4px}
    .actions{display:flex;gap:10px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:8px;border:1px solid var(--line);color:var(--text);text-decoration:none;background:#181820;font-weight:700}.btn.primary{background:var(--accent);border-color:var(--accent)}.btn.ok{background:#14532d;border-color:#166534}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#c4b5fd;word-break:break-all}.ok{color:var(--ok)}.bad{color:var(--bad)}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>${BRAND}</h1>
        <p class="sub">Discord bot durum paneli ve sunucuya ekleme baglantisi.</p>
      </div>
      <div class="grid">
        <div class="card"><div class="label">Durum</div><div class="value ${payload.ready ? 'ok' : 'bad'}">${payload.status}</div></div>
        <div class="card"><div class="label">Login denemesi</div><div class="value">${payload.loginAttempts}</div></div>
        <div class="card"><div class="label">Sunucu</div><div class="value">${payload.guilds}</div></div>
        <div class="card"><div class="label">Uptime</div><div class="value">${payload.uptimeSeconds}s</div></div>
      </div>
      <div class="actions">
        <a class="btn primary" href="${inviteUrl()}" target="_blank" rel="noopener">Botu Sunucuya Ekle</a>
        <a class="btn ok" href="${inviteUrl(runtime.clientId || CLIENT_ID, { guildId: TARGET_GUILD_ID })}" target="_blank" rel="noopener">Lutheus Sunucusuna Ekle</a>
        <a class="btn" href="/health">Health JSON</a>
        <a class="btn" href="/diagnostics">Diagnostics</a>
      </div>
      <p class="sub">Kullanilan dogru link <code>${inviteUrl()}</code></p>
      <p class="sub">Son hata: <code>${payload.lastError || '-'}</code></p>
    </section>
  </main>
</body>
</html>`;
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (parsedUrl.pathname === '/') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage());
      return;
    }
    if (parsedUrl.pathname === '/invite' || parsedUrl.pathname === '/invite-lutheus') {
      const guildId = parsedUrl.pathname === '/invite-lutheus' ? TARGET_GUILD_ID : parsedUrl.searchParams.get('guild_id');
      res.writeHead(302, { ...headers, Location: inviteUrl(runtime.clientId || CLIENT_ID, { guildId }) });
      res.end();
      return;
    }
    if (parsedUrl.pathname === '/invite-url') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(inviteDiagnostics(), null, 2));
      return;
    }
    if (parsedUrl.pathname === '/diagnostics') {
      tokenDiagnostics().then((token) => {
        res.writeHead(runtime.ready && token.valid ? 200 : 503, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: runtime.ready && token.valid, runtime: statusPayload(), invite: inviteDiagnostics(), token }, null, 2));
      }).catch((error) => {
        res.writeHead(500, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: error.message }, null, 2));
      });
      return;
    }
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/status') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(statusPayload(), null, 2));
      return;
    }
    if (req.method === 'GET' && !parsedUrl.pathname.startsWith('/api/')) {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage());
      return;
    }
    res.writeHead(404, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }));
  });
  server.listen(PORT, '0.0.0.0', () => audit('HEALTH_SERVER_READY', { port: PORT }));
}

function loadExternalCommands() {
  const commands = new Collection();
  const commandRoot = path.join(__dirname, 'src/commands');
  if (!fs.existsSync(commandRoot)) return commands;
  for (const folder of fs.readdirSync(commandRoot)) {
    const folderPath = path.join(commandRoot, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    for (const file of fs.readdirSync(folderPath).filter((item) => item.endsWith('.js'))) {
      const command = require(path.join(folderPath, file));
      if (command?.data?.name && typeof command.execute === 'function') {
        commands.set(command.data.name, command);
      }
    }
  }
  return commands;
}

function createBuiltInCommands() {
  const commands = new Collection();
  commands.set('panel', {
    data: new SlashCommandBuilder().setName('panel').setDescription('Lutheus Guard kontrol panelini acar.'),
    async execute(interaction) {
      const embed = new EmbedBuilder()
        .setColor(0x8a5cf5)
        .setTitle('Lutheus Guard')
        .setDescription(runtime.ready ? 'Bot aktif ve komutlara hazir.' : 'Bot henuz hazir degil.')
        .addFields(
          { name: 'Durum', value: runtime.status, inline: true },
          { name: 'Uptime', value: `${Math.floor((Date.now() - startedAt) / 1000)}s`, inline: true },
          { name: 'Sunucu', value: String(runtime.guilds), inline: true }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Davet').setStyle(ButtonStyle.Link).setURL(inviteUrl(runtime.clientId || CLIENT_ID, { guildId: interaction.guildId || TARGET_GUILD_ID }))
      );
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  });
  commands.set('yardim', {
    data: new SlashCommandBuilder().setName('yardim').setDescription('Bot komutlarini gosterir.'),
    async execute(interaction) {
      await interaction.reply({ content: Array.from(commands.keys()).map((name) => `/${name}`).join(' '), ephemeral: true });
    }
  });
  commands.set('sunucu', {
    data: new SlashCommandBuilder().setName('sunucu').setDescription('Sunucu ve bot ozetini gosterir.'),
    async execute(interaction) {
      await interaction.reply({ content: `Sunucu: ${interaction.guild?.name || '-'}\nBot: ${runtime.status}\nGuild ID: ${interaction.guildId || '-'}`, ephemeral: true });
    }
  });
  commands.set('uye-bilgi', {
    data: new SlashCommandBuilder()
      .setName('uye-bilgi')
      .setDescription('Bir uyenin Discord adi ve ID bilgisini gosterir.')
      .addUserOption((option) => option.setName('uye').setDescription('Uye').setRequired(false)),
    async execute(interaction) {
      const user = interaction.options.getUser('uye') || interaction.user;
      await interaction.reply({ content: `Ad: ${user.globalName || user.username}\nKullanici: ${user.tag}\nID: ${user.id}`, ephemeral: true });
    }
  });
  commands.set('avatar', {
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('Bir uyenin avatarini gosterir.')
      .addUserOption((option) => option.setName('uye').setDescription('Uye').setRequired(false)),
    async execute(interaction) {
      const user = interaction.options.getUser('uye') || interaction.user;
      await interaction.reply({ content: user.displayAvatarURL({ size: 1024 }), ephemeral: true });
    }
  });
  commands.set('temizle', {
    data: new SlashCommandBuilder()
      .setName('temizle')
      .setDescription('Kanalda belirtilen miktarda mesaji siler.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((option) => option.setName('adet').setDescription('Silinecek mesaj sayisi').setRequired(true).setMinValue(1).setMaxValue(100)),
    async execute(interaction) {
      const amount = interaction.options.getInteger('adet');
      if (!interaction.channel?.bulkDelete) {
        await interaction.reply({ content: 'Bu kanal mesaj temizlemeyi desteklemiyor.', ephemeral: true });
        return;
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `${deleted.size} mesaj temizlendi.`, ephemeral: true });
    }
  });
  return commands;
}

function mergeCommands() {
  const builtIns = createBuiltInCommands();
  const external = loadExternalCommands();
  for (const [name, command] of external) builtIns.set(name, command);
  return builtIns;
}

async function registerCommands(commands) {
  if (!process.env.DISCORD_TOKEN) return;
  const body = Array.from(commands.values()).map((command) => command.data.toJSON());
  const rest = new REST({ timeout: REST_TIMEOUT_MS, retries: 3 }).setToken(process.env.DISCORD_TOKEN);
  const appId = runtime.clientId || CLIENT_ID;
  if (process.env.DISCORD_GUILD_ID) {
    await withTimeout(rest.put(Routes.applicationGuildCommands(appId, process.env.DISCORD_GUILD_ID), { body }), REST_TIMEOUT_MS, 'COMMAND_REGISTER');
    audit('COMMANDS_REGISTERED', { scope: 'guild', guildId: process.env.DISCORD_GUILD_ID, count: body.length });
    return;
  }
  await withTimeout(rest.put(Routes.applicationCommands(appId), { body }), REST_TIMEOUT_MS, 'COMMAND_REGISTER');
  audit('COMMANDS_REGISTERED', { scope: 'global', count: body.length });
}

function createClient(commands) {
  const client = new Client({
    intents: resolveGatewayIntents(),
    rest: { timeout: REST_TIMEOUT_MS, retries: 5 }
  });
  client.commands = commands;

  client.once('ready', async () => {
    runtime.ready = true;
    runtime.status = 'ready';
    runtime.clientId = client.user.id;
    runtime.tag = client.user.tag;
    runtime.guilds = client.guilds.cache.size;
    runtime.lastError = null;
    audit('BOT_READY', { bot: client.user.tag, guilds: runtime.guilds });
    client.user.setActivity('Lutheus Guard | /panel').catch(() => undefined);
    registerCommands(commands).catch((error) => {
      runtime.lastError = error.message;
      audit('COMMAND_REGISTER_ERROR', { error: error.message });
    });
  });

  client.on('guildCreate', (guild) => { runtime.guilds = client.guilds.cache.size; audit('GUILD_JOINED', { guildId: guild.id }); });
  client.on('guildDelete', (guild) => { runtime.guilds = client.guilds.cache.size; audit('GUILD_LEFT', { guildId: guild.id }); });
  client.on('error', (error) => { runtime.lastError = error.message; audit('CLIENT_ERROR', { error: error.message }); });
  client.on('shardDisconnect', (event) => { runtime.ready = false; runtime.status = 'disconnected'; audit('SHARD_DISCONNECTED', { code: event?.code }); });
  client.on('shardReconnecting', () => { runtime.ready = false; runtime.status = 'reconnecting'; audit('SHARD_RECONNECTING'); });
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;
    runtime.commandCount += 1;
    runtime.lastCommandAt = new Date().toISOString();
    try {
      await command.execute(interaction, client);
    } catch (error) {
      runtime.lastError = error.message;
      audit('INTERACTION_ERROR', { command: interaction.commandName, error: error.message });
      const payload = { content: `Islem tamamlanamadi: ${error.message}`, ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => undefined);
      else await interaction.reply(payload).catch(() => undefined);
    }
  });

  return client;
}

async function loginWithRetry(commands) {
  const maxDelay = Number(process.env.DISCORD_LOGIN_MAX_DELAY_MS || 60000);
  let delay = Number(process.env.DISCORD_LOGIN_INITIAL_DELAY_MS || 5000);

  while (!runtime.ready) {
    // Her denemede taze bir client olustur (destroy sonrasi yeniden kullanilmaz)
    const client = createClient(commands);
    runtime.status = 'logging_in';
    runtime.loginAttempts += 1;
    audit('LOGIN_ATTEMPT', { attempt: runtime.loginAttempts });

    try {
      // client.login() sadece token kabul edildiginde resolve olur.
      // Gercek 'ready' eventi icin ayri bekliyoruz.
      await withTimeout(
        new Promise((resolve, reject) => {
          client.once('ready', resolve);
          client.once('error', reject);
          client.login(process.env.DISCORD_TOKEN).catch(reject);
        }),
        LOGIN_TIMEOUT_MS,
        'DISCORD_LOGIN'
      );
      // Basarili: dongu 'ready' eventi ile bitti
      process.on('SIGTERM', () => { audit('SIGTERM_RECEIVED'); client.destroy(); process.exit(0); });
      return;
    } catch (error) {
      runtime.ready = false;
      runtime.status = 'login_retry_wait';
      runtime.lastError = error.message;
      client.destroy();

      if (error.code === 'TokenInvalid' || /invalid token/i.test(error.message || '')) {
        audit('CONFIG_ERROR', { error: 'DISCORD_TOKEN gecersiz - retry durduruldu' });
        return;
      }

      audit('LOGIN_RETRY_SCHEDULED', { attempt: runtime.loginAttempts, retryInMs: delay, error: error.message });
      await sleep(delay);
      delay = Math.min(maxDelay, Math.round(delay * 1.6));
    }
  }
}

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    runtime.status = 'missing_token';
    runtime.lastError = 'DISCORD_TOKEN_MISSING';
    audit('CONFIG_ERROR', { error: runtime.lastError });
    startHealthServer();
    return;
  }

  const commands = mergeCommands();

  // Komutlari gateway baglantisından ONCE REST ile kaydet (anlik etki eder)
  try {
    const body = Array.from(commands.values()).map((c) => c.data.toJSON());
    const rest = new REST({ timeout: REST_TIMEOUT_MS, retries: 3 }).setToken(process.env.DISCORD_TOKEN);
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
      audit('COMMANDS_REGISTERED', { scope: 'guild', guildId, count: body.length });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
      audit('COMMANDS_REGISTERED', { scope: 'global', count: body.length });
    }
  } catch (error) {
    audit('COMMAND_REGISTER_ERROR', { error: error.message });
  }

  startHealthServer();
  await loginWithRetry(commands);
}

main().catch((error) => {
  runtime.status = 'fatal';
  runtime.lastError = error.message;
  audit('FATAL', { error: error.stack || error.message });
  if (!runtime.ready) startHealthServer();
});
