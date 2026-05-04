try {
  require('dotenv').config({ quiet: true });
} catch (error) {
  if (error && error.code !== 'MODULE_NOT_FOUND') throw error;
}

const http = require('http');
const dns = require('dns');
const { createHmac, randomUUID } = require('crypto');
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
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');

const PORT = Number(process.env.PORT || 7860);
const BOT_COLOR = 0x5b7cfa;
const DANGER_COLOR = 0xef4444;
const OK_COLOR = 0x22c55e;
const BRAND = process.env.BOT_BRAND || 'Lutheus Guard';
const INVITE_PERMISSIONS = process.env.DISCORD_INVITE_PERMISSIONS || '8';
const DEFAULT_DISCORD_CLIENT_ID = '1500551629768888542';
const DEFAULT_GUILD_ID = process.env.DISCORD_TARGET_GUILD_ID || process.env.DISCORD_GUILD_ID || '1354854696874938590';
const DISCORD_API_BASE = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';

const startedAt = Date.now();
const runtimeState = {
  ready: false,
  status: 'starting',
  loginAttempts: 0,
  commandCount: 0,
  lastCommandAt: null,
  lastError: null
};

function getClientId() {
  return runtimeState.clientId || process.env.DISCORD_CLIENT_ID || DEFAULT_DISCORD_CLIENT_ID;
}

function inviteUrl(clientId = getClientId(), options = {}) {
  if (!clientId) return '';
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

function inviteDiagnostics(clientId = getClientId()) {
  const canonical = inviteUrl(clientId);
  const targetGuild = inviteUrl(clientId, { guildId: DEFAULT_GUILD_ID });
  return {
    clientId,
    permissions: INVITE_PERMISSIONS,
    scopes: ['bot', 'applications.commands'],
    integrationType: 0,
    targetGuildId: DEFAULT_GUILD_ID,
    canonicalInvite: canonical,
    targetGuildInvite: canonical,
    commonBadInvite: `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}&integration_type=0`,
    checks: [
      'Sadece client_id iceren link botu eklemez; scope=bot+applications.commands zorunludur.',
      'Discord Developer Portal > Installation: Guild Install acik olmali.',
      'Discord Developer Portal > Bot: Public Bot acik olmali veya uygulama sahibi sunucuya eklemelidir.',
      'Bot sunucuya eklense bile gateway baglantisi yoksa offline gorunur; /diagnostics token ve network durumunu gosterir.'
    ]
  };
}

async function discordApi(path, options = {}) {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN eksik');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.DISCORD_REST_TIMEOUT_MS || 8000));
  try {
    const response = await fetch(new URL(path, DISCORD_API_BASE), {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`DISCORD_REST_${response.status}: ${body?.message || response.statusText}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function botDiagnostics() {
  const diagnostics = {
    ok: true,
    runtime: {
      ready: runtimeState.ready,
      status: runtimeState.status,
      loginAttempts: runtimeState.loginAttempts,
      lastError: runtimeState.lastError,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    },
    invite: inviteDiagnostics(),
    token: {
      present: Boolean(process.env.DISCORD_TOKEN),
      valid: false,
      userId: null,
      tag: null,
      matchesConfiguredClientId: null,
      error: null
    }
  };

  try {
    const user = await discordApi('/users/@me');
    diagnostics.token.valid = true;
    diagnostics.token.userId = user.id;
    diagnostics.token.tag = user.discriminator && user.discriminator !== '0'
      ? `${user.username}#${user.discriminator}`
      : user.username;
    diagnostics.token.matchesConfiguredClientId = String(user.id) === String(getClientId());
  } catch (error) {
    diagnostics.ok = false;
    diagnostics.token.error = error.name === 'AbortError' ? 'DISCORD_REST_TIMEOUT' : error.message;
  }

  return diagnostics;
}

function htmlPage(payload) {
  const invite = inviteUrl();
  const targetInvite = inviteUrl(getClientId(), { guildId: DEFAULT_GUILD_ID });
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
    h1{margin:0;font-size:30px;letter-spacing:-.03em}.sub{color:var(--muted);margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
    .card{border:1px solid var(--line);background:#0d0d12;border-radius:8px;padding:14px}.label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.value{font-size:22px;font-weight:800;margin-top:4px}
    .actions{display:flex;gap:10px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:8px;border:1px solid var(--line);color:var(--text);text-decoration:none;background:#181820;font-weight:700}.btn.primary{background:var(--accent);border-color:var(--accent)}.btn.ok{background:#14532d;border-color:#166534}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#c4b5fd}.ok{color:var(--ok)}.bad{color:var(--bad)}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>${BRAND}</h1>
        <p class="sub">Discord bot durum paneli ve sunucuya ekleme bağlantısı.</p>
      </div>
      <div class="grid">
        <div class="card"><div class="label">Durum</div><div class="value ${payload.ready ? 'ok' : 'bad'}">${payload.status}</div></div>
        <div class="card"><div class="label">Login denemesi</div><div class="value">${payload.loginAttempts}</div></div>
        <div class="card"><div class="label">Komut</div><div class="value">${payload.commandCount}</div></div>
        <div class="card"><div class="label">Uptime</div><div class="value">${payload.uptimeSeconds}s</div></div>
      </div>
      <div class="actions">
        ${invite ? `<a class="btn primary" href="${invite}" target="_blank" rel="noopener">Botu Sunucuya Ekle</a>` : '<span class="btn">DISCORD_CLIENT_ID bekleniyor</span>'}
        ${targetInvite ? `<a class="btn ok" href="${targetInvite}" target="_blank" rel="noopener">Lutheus Sunucusuna Ekle</a>` : ''}
        <a class="btn" href="/health">Health JSON</a>
        <a class="btn" href="/diagnostics">Diagnostics</a>
        <a class="btn" href="/invite">Invite Redirect</a>
      </div>
      <p class="sub">Kullanılan doğru link <code>${invite || 'CLIENT_ID eksik'}</code></p>
      <p class="sub">Sadece <code>?client_id=...</code> içeren link botu sunucuya eklemez; <code>scope=bot applications.commands</code> zorunludur.</p>
    </section>
  </main>
</body>
</html>`;
}

function audit(event, meta = {}) {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...meta
  }) + '\n');
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
    const payload = {
      ok: true,
      service: 'lutheus-discord-bot',
      ready: runtimeState.ready,
      status: runtimeState.status,
      loginAttempts: runtimeState.loginAttempts,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      commandCount: runtimeState.commandCount,
      lastCommandAt: runtimeState.lastCommandAt,
      lastError: runtimeState.lastError
    };

    if (parsedUrl.pathname === '/') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage(payload));
      return;
    }

    if (parsedUrl.pathname === '/invite' || parsedUrl.pathname === '/invite-lutheus') {
      const invite = inviteUrl(getClientId(), parsedUrl.pathname === '/invite-lutheus' ? { guildId: DEFAULT_GUILD_ID } : {});
      if (!invite) {
        res.writeHead(503, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'CLIENT_ID_MISSING' }));
        return;
      }
      res.writeHead(302, { ...headers, Location: invite });
      res.end();
      return;
    }

    if (parsedUrl.pathname === '/invite-url') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(inviteDiagnostics(), null, 2));
      return;
    }

    if (parsedUrl.pathname === '/diagnostics') {
      botDiagnostics()
        .then((diagnostics) => {
          res.writeHead(diagnostics.ok ? 200 : 503, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(diagnostics, null, 2));
        })
        .catch((error) => {
          res.writeHead(500, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error.message }, null, 2));
        });
      return;
    }

    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/status') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    if (req.method === 'GET' && !parsedUrl.pathname.startsWith('/api/')) {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage(payload));
      return;
    }

    res.writeHead(404, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    audit('HEALTH_SERVER_READY', { port: PORT });
  });
}

function baseEmbed(title, description, color = BOT_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: BRAND });
}

function dashboardEmbed(guild, client) {
  const uptimeMinutes = Math.floor((Date.now() - startedAt) / 60000);
  return baseEmbed(
    'Lutheus Guard Kontrol Paneli',
    'Sunucu moderasyonu, operasyon komutlari ve durum kontrolleri tek panelde.',
    BOT_COLOR
  )
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: 'Durum', value: runtimeState.ready ? 'Aktif' : 'Hazirlaniyor', inline: true },
      { name: 'Sunucu', value: guild ? guild.name : 'DM / Bilinmiyor', inline: true },
      { name: 'Uptime', value: `${uptimeMinutes} dk`, inline: true },
      { name: 'Komutlar', value: '`/yardim` `/ping` `/sunucu` `/uye-bilgi` `/avatar` `/temizle` `/lockdown`', inline: false }
    );
}

function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lutheus:status')
      .setLabel('Durum')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('lutheus:help')
      .setLabel('Komutlar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lutheus:invite')
      .setLabel('Davet')
      .setStyle(ButtonStyle.Success)
  );
}

function requireManageGuild(interaction) {
  const permissions = interaction.memberPermissions;
  return Boolean(permissions && permissions.has(PermissionFlagsBits.ManageGuild));
}

function requireManageMessages(interaction) {
  const permissions = interaction.memberPermissions;
  return Boolean(permissions && permissions.has(PermissionFlagsBits.ManageMessages));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signedBackendRequest(endpoint, payload) {
  const backendUrl = process.env.BACKEND_BASE_URL;
  const hmacSecret = process.env.BOT_HMAC_SECRET;

  if (!backendUrl || !hmacSecret) {
    throw new Error('BACKEND_BASE_URL veya BOT_HMAC_SECRET eksik');
  }

  const timestamp = Date.now().toString();
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', hmacSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const response = await fetch(new URL(endpoint, backendUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Correlation-Id': payload.correlationId
    },
    body
  });

  const responseBody = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body: responseBody };
}

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Lutheus Guard kontrol panelini acar.'),
    async execute(interaction, client) {
      await interaction.reply({
        embeds: [dashboardEmbed(interaction.guild, client)],
        components: [panelButtons()]
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('yardim')
      .setDescription('Bot komutlarini ve yetki gereksinimlerini gosterir.'),
    async execute(interaction) {
      const embed = baseEmbed('Komutlar', 'Lutheus Guard sunucu operasyonlari icin hazir.', BOT_COLOR)
        .addFields(
          { name: '/panel', value: 'Butonlu kontrol panelini acar.', inline: false },
          { name: '/ping', value: 'Bot gecikmesi ve API durumunu olcer.', inline: false },
          { name: '/sunucu', value: 'Sunucu ozeti ve bot durumunu gosterir.', inline: false },
          { name: '/rol-kontrol', value: 'Bir uyenin temel rol ve yetki ozetini verir.', inline: false },
          { name: '/uye-bilgi', value: 'Discord adi, ID, roller ve tarih bilgilerini gosterir.', inline: false },
          { name: '/avatar', value: 'Bir uyenin avatar linkini ve onizlemesini gosterir.', inline: false },
          { name: '/temizle', value: 'Yetkili kanalda 1-100 mesaj temizler.', inline: false },
          { name: '/lockdown', value: 'Yetkili kullanici icin backend lockdown istegi baslatir.', inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Bot ve Discord API gecikmesini kontrol eder.'),
    async execute(interaction, client) {
      const sent = await interaction.reply({ content: 'Olculuyor...', ephemeral: true, fetchReply: true });
      const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
      const embed = baseEmbed('Durum: Aktif', 'Lutheus Guard calisiyor.', OK_COLOR)
        .addFields(
          { name: 'Round-trip', value: `${roundTrip} ms`, inline: true },
          { name: 'WebSocket', value: `${Math.round(client.ws.ping)} ms`, inline: true },
          { name: 'Health Port', value: String(PORT), inline: true }
        );
      await interaction.editReply({ content: '', embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('sunucu')
      .setDescription('Sunucu ve bot durum ozetini gosterir.'),
    async execute(interaction, client) {
      const guild = interaction.guild;
      const embed = dashboardEmbed(guild, client);
      if (guild) {
        embed.addFields(
          { name: 'Uye Sayisi', value: String(guild.memberCount || 'Bilinmiyor'), inline: true },
          { name: 'Sunucu ID', value: guild.id, inline: true }
        );
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('rol-kontrol')
      .setDescription('Bir uyenin temel rol ozetini gosterir.')
      .addUserOption((option) => option
        .setName('uye')
        .setDescription('Kontrol edilecek uye')
        .setRequired(false)),
    async execute(interaction) {
      const targetUser = interaction.options.getUser('uye') || interaction.user;
      const member = interaction.guild
        ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
        : null;
      const roles = member
        ? member.roles.cache
          .filter((role) => role.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map((role) => role.name)
          .slice(0, 8)
        : [];

      const embed = baseEmbed('Rol Kontrol', `${targetUser} icin sunucu rol ozeti.`, BOT_COLOR)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Kullanici ID', value: targetUser.id, inline: true },
          { name: 'En Yuksek Rol', value: member?.roles.highest?.name || 'Bilinmiyor', inline: true },
          { name: 'Roller', value: roles.length ? roles.join(', ') : 'Rol bulunamadi', inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('uye-bilgi')
      .setDescription('Bir uyenin Discord adi, ID ve rol bilgilerini gosterir.')
      .addUserOption((option) => option
        .setName('uye')
        .setDescription('Bilgisi gosterilecek uye')
        .setRequired(false)),
    async execute(interaction) {
      const targetUser = interaction.options.getUser('uye') || interaction.user;
      const member = interaction.guild
        ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
        : null;
      const roles = member
        ? member.roles.cache
          .filter((role) => role.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map((role) => role.name)
          .slice(0, 12)
        : [];

      const embed = baseEmbed('Uye Bilgi', `${targetUser} icin Discord kimligi.`, BOT_COLOR)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Discord Adi', value: targetUser.globalName || targetUser.username, inline: true },
          { name: 'Kullanici Adi', value: targetUser.tag, inline: true },
          { name: 'Discord ID', value: targetUser.id, inline: true },
          { name: 'Sunucuya Katilim', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Bilinmiyor', inline: true },
          { name: 'Hesap Acilisi', value: `<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: 'En Yuksek Rol', value: member?.roles.highest?.name || 'Bilinmiyor', inline: true },
          { name: 'Roller', value: roles.length ? roles.join(', ') : 'Rol yok', inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('Bir uyenin profil fotografini gosterir.')
      .addUserOption((option) => option
        .setName('uye')
        .setDescription('Avatar sahibi')
        .setRequired(false)),
    async execute(interaction) {
      const targetUser = interaction.options.getUser('uye') || interaction.user;
      const avatar = targetUser.displayAvatarURL({ size: 1024 });
      const embed = baseEmbed('Avatar', `${targetUser} profil fotografi.`, BOT_COLOR)
        .setImage(avatar)
        .addFields(
          { name: 'Discord ID', value: targetUser.id, inline: true },
          { name: 'Link', value: avatar, inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('temizle')
      .setDescription('Bulundugunuz kanalda son mesajlari temizler.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((option) => option
        .setName('adet')
        .setDescription('Silinecek mesaj sayisi (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)),
    async execute(interaction) {
      if (!requireManageMessages(interaction)) {
        await interaction.reply({ content: 'Bu komut icin Mesajlari Yonet yetkisi gerekir.', ephemeral: true });
        return;
      }
      if (!interaction.channel?.bulkDelete) {
        await interaction.reply({ content: 'Bu kanal toplu mesaj silmeyi desteklemiyor.', ephemeral: true });
        return;
      }

      const amount = interaction.options.getInteger('adet');
      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);
      audit('MESSAGES_PRUNED', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        requested: amount,
        deleted: deleted.size
      });
      await interaction.editReply(`${deleted.size} mesaj temizlendi. 14 gunden eski mesajlar Discord tarafindan atlanir.`);
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('lockdown')
      .setDescription('[Kritik] Backend uzerinde acil lockdown istegi baslatir.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      if (!requireManageGuild(interaction)) {
        await interaction.reply({ content: 'Bu komut icin Sunucuyu Yonet yetkisi gerekir.', ephemeral: true });
        return;
      }

      const correlationId = randomUUID();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`lockdown:cancel:${correlationId}`)
          .setLabel('Iptal')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lockdown:confirm:${correlationId}`)
          .setLabel('Muhurle')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = baseEmbed(
        'Kritik Lockdown Onayi',
        'Bu islem backend tarafinda acil blokaj istegi gonderir. Devam etmek icin onay verin.',
        DANGER_COLOR
      ).addFields({ name: 'Correlation ID', value: `\`${correlationId}\`` });

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }
];

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

async function registerCommands(client) {
  const payload = commands.map((command) => command.data.toJSON());
  const guildId = process.env.DISCORD_GUILD_ID;

  if (guildId) {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(payload);
    audit('COMMANDS_REGISTERED', { scope: 'guild', guildId, count: payload.length });
    return;
  }

  await client.application.commands.set(payload);
  audit('COMMANDS_REGISTERED', { scope: 'global', count: payload.length });
}

async function handleButton(interaction, client) {
  if (interaction.customId === 'lutheus:status') {
    await interaction.reply({ embeds: [dashboardEmbed(interaction.guild, client)], ephemeral: true });
    return;
  }

  if (interaction.customId === 'lutheus:help') {
    const names = commands.map((command) => `/${command.data.name}`).join('  ');
    await interaction.reply({ content: names, ephemeral: true });
    return;
  }

  if (interaction.customId === 'lutheus:invite') {
    await interaction.reply({
      content: inviteUrl(client.user.id),
      ephemeral: true
    });
    return;
  }

  if (!interaction.customId.startsWith('lockdown:')) return;

  const [, action, correlationId] = interaction.customId.split(':');
  if (action === 'cancel') {
    await interaction.update({ content: 'Lockdown iptal edildi.', embeds: [], components: [] });
    audit('LOCKDOWN_CANCELLED', { userId: interaction.user.id, guildId: interaction.guildId, correlationId });
    return;
  }

  if (!requireManageGuild(interaction)) {
    await interaction.reply({ content: 'Bu islem icin Sunucuyu Yonet yetkisi gerekir.', ephemeral: true });
    return;
  }

  await interaction.update({ content: 'Backend lockdown istegi gonderiliyor...', embeds: [], components: [] });
  const result = await signedBackendRequest('/v1/ops/lockdown', {
    initiatorDiscordId: interaction.user.id,
    guildId: interaction.guildId,
    correlationId,
    timestamp: Date.now()
  });

  if (!result.ok) {
    audit('LOCKDOWN_REJECTED', { status: result.status, body: result.body, correlationId });
    await interaction.editReply(`Backend istegi reddetti: HTTP ${result.status}. Correlation ID: \`${correlationId}\``);
    return;
  }

  audit('LOCKDOWN_ACTIVATED', { userId: interaction.user.id, guildId: interaction.guildId, correlationId });
  await interaction.editReply(`Lockdown aktif. Correlation ID: \`${correlationId}\``);
}

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    runtimeState.lastError = 'DISCORD_TOKEN eksik';
    audit('CONFIG_ERROR', { error: runtimeState.lastError });
    process.exit(1);
  }

  startHealthServer();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    // Hugging Face ag yapisi icin optimize edilmis rest ayarlari
    rest: {
      timeout: 30000, // 30 saniye
      retries: 5,
      rejectOnRateLimit: (data) => data.timeout > 10000,
    }
  });

  client.once('ready', async () => {
    runtimeState.ready = true;
    runtimeState.status = 'ready';
    runtimeState.clientId = client.user.id;
    runtimeState.lastError = null;
    audit('BOT_READY', {
      bot: client.user.tag,
      guilds: client.guilds.cache.size,
      inviteUrl: inviteUrl(client.user.id)
    });

    try {
      await registerCommands(client);
    } catch (error) {
      runtimeState.lastError = error.message;
      audit('COMMAND_REGISTER_ERROR', { error: error.message });
    }
  });

  client.on('guildCreate', (guild) => {
    audit('GUILD_JOINED', { guildId: guild.id, guildName: guild.name });
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (!command) return;
        runtimeState.commandCount += 1;
        runtimeState.lastCommandAt = new Date().toISOString();
        audit('COMMAND_RECEIVED', {
          command: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId
        });
        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction, client);
      }
    } catch (error) {
      runtimeState.lastError = error.message;
      audit('INTERACTION_ERROR', { error: error.message, customId: interaction.customId, command: interaction.commandName });

      const payload = {
        content: `Islem tamamlanamadi: \`${error.message}\``,
        embeds: [],
        components: [],
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  client.on('error', (error) => {
    runtimeState.lastError = error.message;
    audit('CLIENT_ERROR', { error: error.message });
  });

  client.on('shardDisconnect', (event) => {
    runtimeState.ready = false;
    runtimeState.status = 'disconnected';
    audit('SHARD_DISCONNECTED', { code: event?.code, reason: event?.reason });
  });

  client.on('shardReconnecting', () => {
    runtimeState.ready = false;
    runtimeState.status = 'reconnecting';
    audit('SHARD_RECONNECTING');
  });

  process.on('SIGTERM', () => {
    audit('SIGTERM_RECEIVED');
    client.destroy();
    process.exit(0);
  });

  await loginWithRetry(client);
}

async function deployCommands() {
  const { REST, Routes } = require('discord.js');
  const commands = [];
  const commandsPath = path.join(__dirname, 'src/commands');
  
  if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        }
      }
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
      console.log(`[System] ${commands.length} komut Discord'a kaydediliyor...`);
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands },
      );
      console.log(`[System] Komutlar basariyla güncellendi!`);
    } catch (error) {
      console.error('[Error] Komut kaydi sirasinda hata:', error);
    }
  }
}

async function loginWithRetry(client) {
  await deployCommands();
  const maxDelay = Number(process.env.DISCORD_LOGIN_MAX_DELAY_MS || 60000);
  let delay = Number(process.env.DISCORD_LOGIN_INITIAL_DELAY_MS || 5000);

  while (true) {
    try {
      runtimeState.status = 'logging_in';
      runtimeState.loginAttempts += 1;
      audit('LOGIN_ATTEMPT', { attempt: runtimeState.loginAttempts });
      await client.login(process.env.DISCORD_TOKEN);
      return;
    } catch (error) {
      runtimeState.lastError = error.message;
      runtimeState.ready = false;
      runtimeState.status = 'login_retry_wait';

      if (error.code === 'TokenInvalid' || /invalid token/i.test(error.message || '')) {
        audit('CONFIG_ERROR', { error: 'DISCORD_TOKEN gecersiz' });
        process.exit(1);
      }

      audit('LOGIN_RETRY_SCHEDULED', {
        attempt: runtimeState.loginAttempts,
        retryInMs: delay,
        error: error.message
      });
      await sleep(delay);
      delay = Math.min(maxDelay, Math.round(delay * 1.6));
    }
  }
}

main().catch((error) => {
  runtimeState.lastError = error.message;
  audit('FATAL', { error: error.stack || error.message });
  process.exit(1);
});
