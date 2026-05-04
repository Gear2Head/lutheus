import { AuthService } from '../auth/authService.js';
import { FirebaseRepository } from '../lib/firebaseRepository.js';
import { canAccessAdmin } from '../auth/rolePolicy.js';

const DEFAULT_COMMANDS = ['panel', 'yardim', 'ping', 'sunucu', 'rol-kontrol', 'uye-bilgi', 'avatar', 'temizle', 'lockdown'];
const DEFAULT_DISCORD_CLIENT_ID = '1500551629768888542';
const DOM = Object.fromEntries([
    'botStatus', 'botUptime', 'botCommands', 'botAttempts', 'botBrand', 'botHealthUrl',
    'discordClientId', 'invitePermissions', 'backendBaseUrl', 'commandGrid',
    'maxPrune', 'lockdownEndpoint', 'commandScope', 'guildId', 'lastError',
    'botDiagnostics', 'btnSave', 'btnRefresh', 'btnInvite'
].map((id) => [id, document.getElementById(id)]));

let session = null;
let settings = {};

function toast(message) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = 'toast success';
    item.innerHTML = `<div class="toast-content"><div class="toast-title">${message}</div></div>`;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 2800);
}

function inviteUrl() {
    const clientId = DOM.discordClientId.value.trim();
    if (!clientId) return '#';
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'bot applications.commands');
    url.searchParams.set('permissions', DOM.invitePermissions.value.trim() || '8');
    url.searchParams.set('integration_type', '0');
    if (DOM.guildId.value.trim()) {
        url.searchParams.set('guild_id', DOM.guildId.value.trim());
        url.searchParams.set('disable_guild_select', 'true');
    }
    return url.toString();
}

function renderCommandGrid(enabled = {}) {
    DOM.commandGrid.innerHTML = DEFAULT_COMMANDS.map((name) => `
        <label class="role-limit-item" style="display:flex;align-items:center;justify-content:space-between;">
            <span>/${name}</span>
            <input type="checkbox" data-command="${name}" ${enabled[name] !== false ? 'checked' : ''}>
        </label>
    `).join('');
}

function readSettings() {
    const commands = {};
    DOM.commandGrid.querySelectorAll('[data-command]').forEach((input) => {
        commands[input.dataset.command] = input.checked;
    });
    return {
        brand: DOM.botBrand.value.trim() || 'Lutheus Guard',
        healthUrl: DOM.botHealthUrl.value.trim(),
        discordClientId: DOM.discordClientId.value.trim(),
        invitePermissions: DOM.invitePermissions.value.trim() || '8',
        backendBaseUrl: DOM.backendBaseUrl.value.trim(),
        maxPrune: Number(DOM.maxPrune.value || 100),
        lockdownEndpoint: DOM.lockdownEndpoint.value.trim() || '/v1/ops/lockdown',
        commandScope: DOM.commandScope.value,
        guildId: DOM.guildId.value.trim(),
        commands
    };
}

function applySettings(next = {}) {
    settings = next || {};
    DOM.botBrand.value = settings.brand || 'Lutheus Guard';
    DOM.botHealthUrl.value = settings.healthUrl || 'https://gear2head-lutheus-bot.hf.space/health';
    DOM.discordClientId.value = settings.discordClientId || DEFAULT_DISCORD_CLIENT_ID;
    DOM.invitePermissions.value = settings.invitePermissions || '8';
    DOM.backendBaseUrl.value = settings.backendBaseUrl || 'https://lutheus.vercel.app';
    DOM.maxPrune.value = settings.maxPrune || 100;
    DOM.lockdownEndpoint.value = settings.lockdownEndpoint || '/v1/ops/lockdown';
    DOM.commandScope.value = settings.commandScope || 'global';
    DOM.guildId.value = settings.guildId || '1223431616081166336';
    renderCommandGrid(settings.commands || {});
    DOM.btnInvite.href = inviteUrl();
}

async function refreshStatus() {
    const url = DOM.botHealthUrl.value.trim();
    if (!url) return;
    try {
        const response = await fetch(url, { cache: 'no-store' });
        const payload = await response.json();
        DOM.botStatus.textContent = payload.status || (payload.ready ? 'ready' : 'unknown');
        DOM.botUptime.textContent = `${payload.uptimeSeconds || 0}s`;
        DOM.botCommands.textContent = String(payload.commandCount || 0);
        DOM.botAttempts.textContent = String(payload.loginAttempts || 0);
        DOM.lastError.textContent = payload.lastError || '-';
        document.getElementById('statusPulse')?.classList.toggle('error', !payload.ready);
    } catch (error) {
        DOM.botStatus.textContent = 'offline';
        DOM.lastError.textContent = error.message;
        document.getElementById('statusPulse')?.classList.add('error');
    }

    try {
        const diagnosticsUrl = url.replace(/\/(?:health|status)(?:\?.*)?$/i, '/diagnostics');
        const diagnosticsResponse = await fetch(diagnosticsUrl, { cache: 'no-store' });
        const diagnostics = await diagnosticsResponse.json();
        DOM.botDiagnostics.textContent = JSON.stringify({
            token: diagnostics.token,
            invite: {
                canonicalInvite: diagnostics.invite?.canonicalInvite,
                targetGuildInvite: diagnostics.invite?.targetGuildInvite
            },
            runtime: diagnostics.runtime
        }, null, 2);
    } catch (error) {
        DOM.botDiagnostics.textContent = `Diagnostics alınamadı: ${error.message}`;
    }
}

async function saveSettings() {
    settings = await FirebaseRepository.saveBotSettings(readSettings(), session.profile);
    applySettings(settings);
    toast('Bot ayarları kaydedildi');
}

async function init() {
    const returnTo = new URL('/bot', window.location.origin).toString();
    session = await AuthService.requireSession({ admin: true, returnTo });
    if (!canAccessAdmin(session.role)) {
        AuthService.redirectToLogin(returnTo, 'forbidden');
        return;
    }
    applySettings(await FirebaseRepository.getBotSettings());
    await refreshStatus();
    DOM.btnSave.addEventListener('click', saveSettings);
    DOM.btnRefresh.addEventListener('click', refreshStatus);
    ['input', 'change'].forEach((eventName) => {
        document.body.addEventListener(eventName, () => {
            DOM.btnInvite.href = inviteUrl();
        });
    });
}

init().catch((error) => {
    DOM.botStatus.textContent = 'error';
    DOM.lastError.textContent = error.message;
});
