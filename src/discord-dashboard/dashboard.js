// SECTION: CLIENT_STORE
// PURPOSE: Manages reactive frontend state, form caching, dirty checking, mock rendering, and API communication.

const state = {
    user: { id: '1223431616081166336', username: 'Gear_Head', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' },
    guilds: [],
    activeGuildId: null,
    activeTab: 'server-selector',
    originalConfigs: {}, // module -> config object
    dirtyConfigs: {},    // module -> modified config object
    channels: [],
    roles: [],
    activityLogs: [],
    commands: [],
    reactionRoles: []
};

// Mock data generator for offline-first rendering and sandbox compatibility
const discordDashboardMock = {
    guilds: [
        { id: '1223431616081166336', name: 'Lutheus Ceza Rapor', memberCount: 1542, botInstalled: true, iconUrl: 'https://cdn.discordapp.com/embed/avatars/1.png' },
        { id: '998877665544332211', name: 'Gear Head Laboratory', memberCount: 89, botInstalled: true, iconUrl: 'https://cdn.discordapp.com/embed/avatars/2.png' },
        { id: '112233445566778899', name: 'Vercel Sandbox Server', memberCount: 312, botInstalled: false, iconUrl: 'https://cdn.discordapp.com/embed/avatars/3.png' }
    ],
    channels: [
        { id: '1223431616081166337', name: 'genel', type: 'text' },
        { id: '1223431616081166338', name: 'mod-log', type: 'text' },
        { id: '1223431616081166339', name: 'karsilama', type: 'text' },
        { id: '1223431616081166340', name: 'duyurular', type: 'announcement' }
    ],
    roles: [
        { id: '1223431616081166341', name: 'Kurucu', color: '#ff4757' },
        { id: '1223431616081166342', name: 'Yönetici', color: '#ffa502' },
        { id: '1223431616081166343', name: 'Moderatör', color: '#2ed573' },
        { id: '1223431616081166344', name: 'Destek Ekibi', color: '#1e90ff' },
        { id: '1223431616081166345', name: 'Mute', color: '#57606f' }
    ],
    configs: {
        moderation: { enabled: true, moderatorRoles: ['1223431616081166343'], muteRole: '1223431616081166345', logChannelId: '1223431616081166338', appealLink: 'https://lutheus.vercel.app/appeal', dmOnAction: true, reasonRequired: true },
        automod: { enabled: true, antiSpam_enabled: true, antiSpam_threshold: 5, antiSpam_action: 'timeout', antiLink_enabled: true, antiInvite_enabled: true, antiLink_action: 'warn', antiCaps_enabled: false, antiCaps_maxPercent: 70, badWords_enabled: true, badWords_list: 'reklam,kufur,satis' },
        logging: { enabled: true, logChannelId: '1223431616081166338', events_messageDelete: true, events_messageEdit: true, events_memberJoin: true, events_memberLeave: true, events_roleChange: false, events_channelChange: false, events_voiceState: false, events_modAction: true },
        welcome: { enabled: true, channelId: '1223431616081166339', message: 'Hoş geldin {user}! Seninle birlikte {memberCount} kişi olduk.', embedEnabled: true, embedTitle: 'Lutheus Yetkili Kadrosu Karşılar!', embedColor: '#7c5af5', dmEnabled: false, dmMessage: 'Hey! Sunucumuza hoş geldin. Kuralları okumayı unutma.', goodbyeEnabled: true, goodbyeChannelId: '1223431616081166339', goodbyeMessage: '{username} sunucumuzdan ayrıldı. Görüşmek üzere!' },
        permissions: { adminRoles: ['1223431616081166342'], moderatorRoles: ['1223431616081166343'] },
        levels: { enabled: true, xpMin: 15, xpMax: 25, cooldownSeconds: 60, rewards: {} },
        settings: { language: 'tr', timezone: 'Europe/Istanbul', retentionDays: 30 }
    },
    commands: [
        { name: 'ban', description: 'Kullanıcıyı sunucudan yasaklar', category: 'moderation', cooldown: 3, enabled: true },
        { name: 'kick', description: 'Kullanıcıyı sunucudan atar', category: 'moderation', cooldown: 3, enabled: true },
        { name: 'timeout', description: 'Kullanıcıya susturma cezası verir', category: 'moderation', cooldown: 2, enabled: true },
        { name: 'warn', description: 'Kullanıcıya uyarı cezası verir', category: 'moderation', cooldown: 1, enabled: true },
        { name: 'setup', description: 'Bot ayarlarını yapılandırır', category: 'config', cooldown: 5, enabled: true }
    ],
    activityLogs: [
        { action: 'guild_settings_updated', details: 'Modül ayarları güncellendi', createdAt: new Date().toISOString() },
        { action: 'bot_logged_in', details: 'Lutheus bot aktif edildi', createdAt: new Date(Date.now() - 3600000).toISOString() }
    ]
};

// Browser Token extraction helper
function getLocalAuthToken() {
    return localStorage.getItem('firebaseToken') || '';
}

// SECTION: API_CLIENT
// PURPOSE: Calls serverless administrative APIs on Vercel
const discordDashboardApiClient = {
    async fetchDashboardConfig(guildId) {
        const token = getLocalAuthToken();
        const res = await fetch(`/api/admin/discord-bot-dashboard?guildId=${guildId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('API_FETCH_FAILED');
        const data = await res.json();
        return data.configs;
    },

    async saveDashboardConfig(guildId, configs) {
        const token = getLocalAuthToken();
        const res = await fetch(`/api/admin/discord-bot-dashboard?guildId=${guildId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ configs })
        });
        if (!res.ok) throw new Error('API_SAVE_FAILED');
        return res.json();
    },

    async triggerAction(guildId, action, payload = {}) {
        const token = getLocalAuthToken();
        const res = await fetch('/api/admin/discord-bot-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ guildId, action, payload })
        });
        if (!res.ok) throw new Error('API_ACTION_FAILED');
        return res.json();
    }
};

// UI Elements caching Proxy
const DOM = new Proxy({}, {
    get(target, prop) {
        if (!target[prop]) {
            target[prop] = document.getElementById(prop);
        }
        return target[prop] || {
            textContent: '', innerHTML: '', value: '', style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
            addEventListener: () => {}, querySelectorAll: () => [], appendChild: () => {}
        };
    }
});

// Toast dispatch helper
const Toast = {
    show(title, message, type = 'info') {
        const stack = document.getElementById('toastStack');
        if (!stack) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<strong>${title}</strong><div style="margin-top:2px;">${message}</div>`;
        stack.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },
    success(title, msg) { this.show(title, msg, 'success'); },
    error(title, msg) { this.show(title, msg, 'error'); },
    info(title, msg) { this.show(title, msg, 'info'); }
};

// Confirmation modal controller
let currentConfirmPromise = null;
function showConfirm(title, message) {
    DOM.confirmTitle.textContent = title;
    DOM.confirmMessage.textContent = message;
    DOM.confirmModal.classList.remove('hidden');
    return new Promise((resolve) => {
        currentConfirmPromise = resolve;
    });
}

// Renders server list
function renderServerSelector() {
    const list = DOM.guildsGrid;
    list.innerHTML = '';
    const query = DOM.guildSearchInput.value.toLowerCase();
    const filter = DOM.guildFilterSelect.value;

    const filtered = state.guilds.filter(g => {
        const matchesQuery = g.name.toLowerCase().includes(query);
        if (filter === 'installed') return matchesQuery && g.botInstalled;
        if (filter === 'setup') return matchesQuery && !g.botInstalled;
        return matchesQuery;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="grid-column: span 3; text-align:center; color: var(--text-3); padding:40px;">Aradığınız kriterlere uygun sunucu bulunamadı.</div>';
        return;
    }

    filtered.forEach(g => {
        const card = document.createElement('div');
        card.className = 'guild-card';
        card.innerHTML = `
            <img src="${g.iconUrl}" class="card-icon" alt="">
            <div class="card-name">${g.name}</div>
            <div class="card-members">${g.memberCount} Üye</div>
            <button class="btn ${g.botInstalled ? 'btn-primary' : 'btn-ghost'}" style="width:100%;">
                ${g.botInstalled ? 'Yönet' : 'Davet Et'}
            </button>
        `;
        card.addEventListener('click', () => {
            if (g.botInstalled) {
                selectGuild(g.id);
            } else {
                window.open(`https://discord.com/oauth2/authorize?client_id=1500551629768888542&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}`, '_blank');
            }
        });
        list.appendChild(card);
    });
}

// Selects active guild and switches to Overview
async function selectGuild(guildId) {
    state.activeGuildId = guildId;
    const guild = state.guilds.find(g => g.id === guildId);
    if (!guild) return;

    DOM.sidebarGuildIcon.src = guild.iconUrl;
    DOM.sidebarGuildName.textContent = guild.name;
    DOM.activeGuildWidget.style.display = 'flex';

    // Populate active guild options in sidebar selects
    populateSelectSelectors();

    // Fetch config
    try {
        const configs = await discordDashboardApiClient.fetchDashboardConfig(guildId);
        state.originalConfigs = JSON.parse(JSON.stringify(configs));
    } catch {
        Toast.info('Sandbox Modu', 'Sunucu ayarları yerel mock veritabanından yüklendi.');
        state.originalConfigs = JSON.parse(JSON.stringify(discordDashboardMock.configs));
    }

    state.dirtyConfigs = JSON.parse(JSON.stringify(state.originalConfigs));

    // Update Overview items
    DOM.ovMemberCount.textContent = guild.memberCount;
    DOM.ovRoleCount.textContent = state.roles.length;
    DOM.ovChannelCount.textContent = state.channels.length;

    // Load configurations into DOM Forms
    loadConfigsToForms();
    renderOverviewModuleStatus();
    renderActivityLogs();
    renderBotCommands();
    renderReactionRoles();
    renderLevelRewards();

    switchTab('overview');
}

// Renders the summary toggles inside Overview
function renderOverviewModuleStatus() {
    const grid = DOM.modulesStatusGrid;
    grid.innerHTML = '';
    const modules = [
        { key: 'moderation', name: 'Moderasyon', icon: 'fa-gavel' },
        { key: 'automod', name: 'AutoMod', icon: 'fa-shield-halved' },
        { key: 'logging', name: 'Günlük Kayıtları', icon: 'fa-list-ul' },
        { key: 'welcome', name: 'Karşılama', icon: 'fa-door-open' },
        { key: 'levels', name: 'Seviye & XP', icon: 'fa-ranking-star' }
    ];

    modules.forEach(m => {
        const enabled = state.dirtyConfigs[m.key]?.enabled === true;
        const card = document.createElement('div');
        card.className = 'module-status-card';
        card.innerHTML = `
            <div class="module-info">
              <i class="fa-solid ${m.icon}"></i>
              <div>
                <div class="module-title">${m.name}</div>
                <div class="module-state ${enabled ? 'active' : ''}">${enabled ? 'Aktif' : 'Pasif'}</div>
              </div>
            </div>
            <label class="switch-container">
              <input type="checkbox" class="ov-module-switch" data-module="${m.key}" ${enabled ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
        `;
        card.querySelector('.ov-module-switch').addEventListener('change', (e) => {
            setModuleEnabledState(m.key, e.target.checked);
        });
        grid.appendChild(card);
    });

    // Checklist updates
    const hasLogsChannel = !!state.dirtyConfigs.logging?.logChannelId;
    const hasModConfig = !!state.dirtyConfigs.moderation?.muteRole;
    const hasWelcome = !!state.dirtyConfigs.welcome?.channelId;

    DOM.checkLogsChannel.classList.toggle('done', hasLogsChannel);
    DOM.checkModConfig.classList.toggle('done', hasModConfig);
    DOM.checkWelcome.classList.toggle('done', hasWelcome);
}

// Sets module state from toggles
function setModuleEnabledState(module, enabled) {
    if (!state.dirtyConfigs[module]) state.dirtyConfigs[module] = { enabled: false };
    state.dirtyConfigs[module].enabled = enabled;

    // Sync master forms toggles
    const input = document.querySelector(`[data-module="${module}"]`);
    if (input) {
        input.checked = enabled;
        input.closest('form')?.classList.toggle('module-active', enabled);
    }

    renderOverviewModuleStatus();
    checkDirtyState();
}

// Fill role and channel options in forms dynamically
function populateSelectSelectors() {
    document.querySelectorAll('.select-roles').forEach(select => {
        const name = select.getAttribute('name');
        const isMultiple = select.hasAttribute('multiple');
        select.innerHTML = (isMultiple ? '' : '<option value="">Rol Seçin</option>') +
            state.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    });

    document.querySelectorAll('.select-channels').forEach(select => {
        select.innerHTML = '<option value="">Kanal Seçin</option>' +
            state.channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('');
    });
}

// Load configs into their forms
function loadConfigsToForms() {
    Object.keys(state.dirtyConfigs).forEach(module => {
        const config = state.dirtyConfigs[module];
        const form = document.getElementById(`form-${module}`);
        if (!form) return;

        form.classList.toggle('module-active', config.enabled === true);

        const masterToggle = form.querySelector('.module-master-toggle');
        if (masterToggle) masterToggle.checked = config.enabled === true;

        // Loop form inputs
        const elements = form.elements;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.classList.contains('module-master-toggle') || !el.name) continue;

            const name = el.name;
            const parts = name.split('_');

            // Handle nested config properties (e.g. antiSpam_enabled -> config.antiSpam.enabled)
            let val = config;
            for (const part of parts) {
                if (val && val[part] !== undefined) {
                    val = val[part];
                } else if (val && val[name] !== undefined) {
                    val = val[name];
                    break;
                } else {
                    val = undefined;
                }
            }

            if (val === undefined) continue;

            if (el.type === 'checkbox') {
                el.checked = !!val;
            } else if (el.tagName === 'SELECT' && el.hasAttribute('multiple')) {
                const values = Array.isArray(val) ? val : [];
                for (let option of el.options) {
                    option.selected = values.includes(option.value);
                }
            } else {
                el.value = val;
            }
        }
    });

    updateWelcomePreview();
}

// Collect values from forms to dirtyConfigs
function saveFormValuesToStore() {
    Object.keys(state.dirtyConfigs).forEach(module => {
        const form = document.getElementById(`form-${module}`);
        if (!form) return;

        const config = state.dirtyConfigs[module];

        const elements = form.elements;
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.classList.contains('module-master-toggle') || !el.name) continue;

            const name = el.name;
            const isCheckbox = el.type === 'checkbox';

            let val;
            if (isCheckbox) {
                val = el.checked;
            } else if (el.tagName === 'SELECT' && el.hasAttribute('multiple')) {
                val = Array.from(el.selectedOptions).map(o => o.value);
            } else {
                val = el.value;
                if (el.type === 'number') val = Number(val);
            }

            // Assign back to configs nested or flat
            const parts = name.split('_');
            if (parts.length === 2) {
                if (!config[parts[0]]) config[parts[0]] = {};
                config[parts[0]][parts[1]] = val;
            } else {
                config[name] = val;
            }
        }
    });
}

// Checks if dirty changes exist to toggle sticky save bar
function checkDirtyState() {
    saveFormValuesToStore();
    const isDirty = JSON.stringify(state.originalConfigs) !== JSON.stringify(state.dirtyConfigs);
    DOM.dirtySaveBar.classList.toggle('hidden', !isDirty);
}

// Discard local edits
function discardChanges() {
    state.dirtyConfigs = JSON.parse(JSON.stringify(state.originalConfigs));
    loadConfigsToForms();
    renderOverviewModuleStatus();
    checkDirtyState();
    Toast.info('Değişiklikler İptal Edildi', 'Yapılandırılmış ayarlar sıfırlandı.');
}

// Save edits to API/Database
async function saveChanges() {
    DOM.btnSaveChanges.disabled = true;
    DOM.btnSaveChanges.textContent = 'Kaydediliyor...';

    try {
        await discordDashboardApiClient.saveDashboardConfig(state.activeGuildId, state.dirtyConfigs);
        state.originalConfigs = JSON.parse(JSON.stringify(state.dirtyConfigs));
        checkDirtyState();
        Toast.success('Kaydedildi', 'Sunucu yapılandırması başarıyla güncellendi.');
    } catch {
        // Fallback for sandboxed local environments
        state.originalConfigs = JSON.parse(JSON.stringify(state.dirtyConfigs));
        checkDirtyState();
        Toast.success('Simüle Kayıt Başarılı', 'Ayarlar sanal belleğe başarıyla yazıldı.');
    } finally {
        DOM.btnSaveChanges.disabled = false;
        DOM.btnSaveChanges.textContent = 'Değişiklikleri Kaydet';
    }
}

// Renders the logs of active sunucu
function renderActivityLogs() {
    const list = DOM.overviewActivityFeed;
    list.innerHTML = '';
    if (state.activityLogs.length === 0) {
        list.innerHTML = '<div style="color:var(--text-3); font-size:11px; text-align:center; padding:10px;">Aktivite kaydı bulunmuyor.</div>';
        return;
    }

    state.activityLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <span class="activity-time">${new Date(log.createdAt).toLocaleTimeString()}</span>
            <div><strong>${log.action}</strong>: ${log.details}</div>
        `;
        list.appendChild(item);
    });
}

// Renders slash commands list
function renderBotCommands() {
    const tbody = DOM.botCommandsTableBody;
    tbody.innerHTML = '';
    const query = DOM.commandSearchInput.value.toLowerCase();
    const cat = DOM.commandCategorySelect.value;

    const filtered = state.commands.filter(c => {
        const matchesQuery = c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query);
        if (cat === 'all') return matchesQuery;
        return matchesQuery && c.category === cat;
    });

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>/${c.name}</strong></td>
            <td>${c.description}</td>
            <td><input type="number" class="field-input cmd-cooldown" data-name="${c.name}" value="${c.cooldown}" style="width: 70px; padding: 4px 6px;"></td>
            <td>
              <label class="switch-container">
                <input type="checkbox" class="cmd-toggle" data-name="${c.name}" ${c.enabled ? 'checked' : ''}>
                <span class="switch-slider"></span>
              </label>
            </td>
        `;
        // Listen changes
        tr.querySelector('.cmd-cooldown').addEventListener('change', (e) => {
            c.cooldown = Number(e.target.value);
            if (!state.dirtyConfigs.commands) state.dirtyConfigs.commands = { disabledCommands: [], cooldowns: {} };
            state.dirtyConfigs.commands.cooldowns[c.name] = c.cooldown;
            checkDirtyState();
        });
        tr.querySelector('.cmd-toggle').addEventListener('change', (e) => {
            c.enabled = e.target.checked;
            if (!state.dirtyConfigs.commands) state.dirtyConfigs.commands = { disabledCommands: [], cooldowns: {} };
            const disabled = state.dirtyConfigs.commands.disabledCommands;
            if (!c.enabled) {
                if (!disabled.includes(c.name)) disabled.push(c.name);
            } else {
                const idx = disabled.indexOf(c.name);
                if (idx !== -1) disabled.splice(idx, 1);
            }
            checkDirtyState();
        });
        tbody.appendChild(tr);
    });
}

// Welcome details update preview
function updateWelcomePreview() {
    const text = DOM.welcomeMessageText.value || 'Hoş geldin!';
    const embedEnabled = DOM.chkWelcomeEmbed.checked;
    const title = DOM.welcomeEmbedTitle.value || 'Karşılama';
    const color = DOM.welcomeEmbedColor.value || '#7c5af5';

    const container = DOM.welcomePreviewContainer;
    container.innerHTML = '';

    const formattedText = text
        .replace(/{user}/g, '@Gear_Head')
        .replace(/{username}/g, 'Gear_Head')
        .replace(/{server}/g, 'Lutheus Ceza Rapor')
        .replace(/{memberCount}/g, '1542');

    if (embedEnabled) {
        container.innerHTML = `
            <div class="discord-embed" style="border-left-color: ${color};">
              <div class="embed-title">${title}</div>
              <div class="embed-desc">${formattedText}</div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="background:#2f3136; padding:10px 14px; border-radius:4px; font-family:sans-serif; color:#dcddde;">
              ${formattedText}
            </div>
        `;
    }
}

// Renders Reaction Roles panels list
function renderReactionRoles() {
    const list = DOM.rrPanelsList;
    list.innerHTML = '';

    if (state.reactionRoles.length === 0) {
        list.innerHTML = '<div style="color:var(--text-3); font-size:12px; text-align:center; padding:30px;">Tepki rol paneli bulunmuyor.</div>';
        return;
    }

    state.reactionRoles.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'rr-panel-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <strong>${p.title || 'İsimsiz Panel'}</strong>
              <button class="btn btn-danger btn-icon btn-delete-rr" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="grid-2" style="margin-bottom:12px;">
              <div class="field-group">
                <label class="field-label">Panel Açıklaması</label>
                <input type="text" class="field-input rr-desc" data-idx="${idx}" value="${p.description || ''}">
              </div>
              <div class="field-group">
                <label class="field-label">Gönderilecek Kanal</label>
                <select class="field-input rr-channel" data-idx="${idx}">
                  ${state.channels.map(c => `<option value="${c.id}" ${c.id === p.channelId ? 'selected' : ''}>#${c.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="field-label">Rol & Emoji Eşleşmeleri</div>
            <div class="rr-roles-list">
              ${p.roles.map((r, rIdx) => `
                <div class="rr-role-row">
                  <input type="text" class="field-input rr-emoji" data-idx="${idx}" data-ridx="${rIdx}" value="${r.emoji}" placeholder="Emoji">
                  <select class="field-input rr-role" data-idx="${idx}" data-ridx="${rIdx}">
                    ${state.roles.map(role => `<option value="${role.id}" ${role.id === r.roleId ? 'selected' : ''}>${role.name}</option>`).join('')}
                  </select>
                  <button class="btn btn-danger btn-icon btn-delete-rr-row" data-idx="${idx}" data-ridx="${rIdx}"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
            <button class="btn btn-ghost btn-add-rr-row" data-idx="${idx}" style="margin-top:10px;"><i class="fa-solid fa-plus"></i> Rol Ekle</button>
        `;

        // Listen events on panel card inputs
        card.querySelector('.rr-desc').addEventListener('change', (e) => {
            p.description = e.target.value;
            triggerReactionRolesDirty();
        });
        card.querySelector('.rr-channel').addEventListener('change', (e) => {
            p.channelId = e.target.value;
            triggerReactionRolesDirty();
        });
        card.querySelectorAll('.rr-emoji').forEach(el => el.addEventListener('change', (e) => {
            const pIdx = Number(e.target.dataset.idx);
            const rIdx = Number(e.target.dataset.ridx);
            state.reactionRoles[pIdx].roles[rIdx].emoji = e.target.value;
            triggerReactionRolesDirty();
        }));
        card.querySelectorAll('.rr-role').forEach(el => el.addEventListener('change', (e) => {
            const pIdx = Number(e.target.dataset.idx);
            const rIdx = Number(e.target.dataset.ridx);
            state.reactionRoles[pIdx].roles[rIdx].roleId = e.target.value;
            triggerReactionRolesDirty();
        }));
        card.querySelector('.btn-delete-rr').addEventListener('click', async (e) => {
            const pIdx = Number(e.currentTarget.dataset.idx);
            const confirmed = await showConfirm('Paneli Sil', 'Bu tepki rol panelini silmek istediğinize emin misiniz?');
            if (confirmed) {
                state.reactionRoles.splice(pIdx, 1);
                renderReactionRoles();
                triggerReactionRolesDirty();
            }
        });
        card.querySelector('.btn-add-rr-row').addEventListener('click', (e) => {
            const pIdx = Number(e.currentTarget.dataset.idx);
            state.reactionRoles[pIdx].roles.push({ emoji: '⭐', roleId: state.roles[0]?.id || '' });
            renderReactionRoles();
            triggerReactionRolesDirty();
        });
        card.querySelectorAll('.btn-delete-rr-row').forEach(el => el.addEventListener('click', (e) => {
            const pIdx = Number(e.currentTarget.dataset.idx);
            const rIdx = Number(e.currentTarget.dataset.ridx);
            state.reactionRoles[pIdx].roles.splice(rIdx, 1);
            renderReactionRoles();
            triggerReactionRolesDirty();
        }));

        list.appendChild(card);
    });
}

function triggerReactionRolesDirty() {
    state.dirtyConfigs.reactionRoles = state.reactionRoles;
    checkDirtyState();
}

// Add Level reward role rewards
function renderLevelRewards() {
    const list = DOM.levelRewardsList;
    list.innerHTML = '';

    const rewards = state.dirtyConfigs.levels?.rewards || {};
    const levels = Object.keys(rewards).sort((a,b) => Number(a) - Number(b));

    if (levels.length === 0) {
        list.innerHTML = '<div style="color:var(--text-3); font-size:11px; text-align:center; padding:10px;">Seviye ödülü bulunmuyor.</div>';
        return;
    }

    levels.forEach(lvl => {
        const item = document.createElement('div');
        item.className = 'rr-role-row';
        item.style.gridTemplateColumns = '80px 1fr 28px';
        item.innerHTML = `
            <input type="number" class="field-input r-level" data-level="${lvl}" value="${lvl}" min="1">
            <select class="field-input r-role" data-level="${lvl}">
              ${state.roles.map(r => `<option value="${r.id}" ${r.id === rewards[lvl] ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <button class="btn btn-danger btn-icon btn-delete-reward" data-level="${lvl}"><i class="fa-solid fa-xmark"></i></button>
        `;

        item.querySelector('.r-level').addEventListener('change', (e) => {
            const oldLvl = e.target.dataset.level;
            const newLvl = Number(e.target.value);
            const roleId = rewards[oldLvl];
            delete rewards[oldLvl];
            rewards[newLvl] = roleId;
            checkDirtyState();
            renderLevelRewards();
        });

        item.querySelector('.r-role').addEventListener('change', (e) => {
            const level = e.target.dataset.level;
            rewards[level] = e.target.value;
            checkDirtyState();
        });

        item.querySelector('.btn-delete-reward').addEventListener('click', (e) => {
            const level = e.currentTarget.dataset.level;
            delete rewards[level];
            checkDirtyState();
            renderLevelRewards();
        });

        list.appendChild(item);
    });
}

// Router/Tab Switcher
function switchTab(tabId) {
    state.activeTab = tabId;

    // Toggle nav active state
    document.querySelectorAll('.nav-item').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });

    // Toggle tab contents
    document.querySelectorAll('.tab-content').forEach(view => {
        const isSelector = tabId === 'server-selector';
        const isTarget = view.id === `tab-${tabId}`;
        view.classList.toggle('hidden', !isTarget);
    });

    // Subtitles
    const subtitles = {
        'server-selector': 'sunucu seçimi',
        overview: 'genel sunucu özet',
        moderation: 'modüller :: moderasyon',
        automod: 'modüller :: automod',
        logging: 'modüller :: günlük log kayıtları',
        welcome: 'modüller :: karşılama & dm',
        'reaction-roles': 'modüller :: tepki rolleri',
        commands: 'modüller :: slash komutlar',
        permissions: 'modüller :: yetki matrisi',
        levels: 'modüller :: seviye & xp',
        settings: 'bot :: genel ayarlar'
    };

    DOM.pageSubtitle.textContent = subtitles[tabId] || 'yönetim';
}

// Command Palette searching
function filterPaletteResults() {
    const query = DOM.commandPaletteInput.value.toLowerCase();
    const results = DOM.paletteResults;
    results.innerHTML = '';

    const items = [
        { label: 'Overview / Sunucu Özeti', tab: 'overview' },
        { label: 'Gelişmiş Moderasyon', tab: 'moderation' },
        { label: 'Oto-Moderasyon (AutoMod)', tab: 'automod' },
        { label: 'Günlük Kayıtları (Logging)', tab: 'logging' },
        { label: 'Karşılama & Uğurlama', tab: 'welcome' },
        { label: 'Tepki Rolleri (Reaction)', tab: 'reaction-roles' },
        { label: 'Komut Yapılandırması', tab: 'commands' },
        { label: 'İzinler & Yetkiler', tab: 'permissions' },
        { label: 'Seviye & XP', tab: 'levels' },
        { label: 'Bot Ayarları', tab: 'settings' }
    ];

    const filtered = items.filter(item => item.label.toLowerCase().includes(query));
    if (filtered.length === 0) {
        results.innerHTML = '<div style="color:var(--text-3); font-size:12px; text-align:center; padding:10px;">Eşleşen sayfa bulunamadı.</div>';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'palette-item';
        div.innerHTML = `<i class="fa-solid fa-arrow-right"></i> <span>${item.label}</span>`;
        div.addEventListener('click', () => {
            switchTab(item.tab);
            DOM.commandPaletteModal.classList.add('hidden');
        });
        results.appendChild(div);
    });
}

// Startup loader
async function initDashboard() {
    // Fill local metadata variables
    state.guilds = JSON.parse(JSON.stringify(discordDashboardMock.guilds));
    state.channels = JSON.parse(JSON.stringify(discordDashboardMock.channels));
    state.roles = JSON.parse(JSON.stringify(discordDashboardMock.roles));
    state.commands = JSON.parse(JSON.stringify(discordDashboardMock.commands));
    state.activityLogs = JSON.parse(JSON.stringify(discordDashboardMock.activityLogs));

    DOM.userAvatar.src = state.user.avatarUrl;
    DOM.userName.textContent = state.user.username;

    // Load initial servers selector
    renderServerSelector();
    switchTab('server-selector');
    DOM.activeGuildWidget.style.display = 'none';

    // Set mock avatars in Levels Leaderboard
    document.querySelectorAll('[data-mock-avatar]').forEach((img, idx) => {
        img.src = `https://cdn.discordapp.com/embed/avatars/${idx + 1}.png`;
    });
}

// Global Event Listeners mapping
function bindEvents() {
    DOM.guildSearchInput.addEventListener('input', renderServerSelector);
    DOM.guildFilterSelect.addEventListener('change', renderServerSelector);

    DOM.btnSelectGuild.addEventListener('click', () => {
        switchTab('server-selector');
        DOM.activeGuildWidget.style.display = 'none';
        state.activeGuildId = null;
    });

    // Navigation buttons binding
    DOM.sidebarNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-item');
        if (btn && state.activeGuildId) {
            switchTab(btn.dataset.tab);
        }
    });

    // Form changed list for dirty checking
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('change', checkDirtyState);
        form.addEventListener('input', checkDirtyState);
    });

    // Master toggles forms visibility
    document.querySelectorAll('.module-master-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const active = e.target.checked;
            e.target.closest('form')?.classList.toggle('module-active', active);
            // Sync overview state
            const mod = e.target.dataset.module;
            if (state.dirtyConfigs[mod]) state.dirtyConfigs[mod].enabled = active;
            renderOverviewModuleStatus();
            checkDirtyState();
        });
    });

    // Welcome pre-render
    DOM.welcomeMessageText.addEventListener('input', updateWelcomePreview);
    DOM.chkWelcomeEmbed.addEventListener('change', updateWelcomePreview);
    DOM.welcomeEmbedTitle.addEventListener('input', updateWelcomePreview);
    DOM.welcomeEmbedColor.addEventListener('input', updateWelcomePreview);

    // Save bar buttons
    DOM.btnDiscardChanges.addEventListener('click', discardChanges);
    DOM.btnSaveChanges.addEventListener('click', saveChanges);

    // Command palette binding
    DOM.btnOpenCommandPalette.addEventListener('click', () => {
        DOM.commandPaletteInput.value = '';
        filterPaletteResults();
        DOM.commandPaletteModal.classList.remove('hidden');
        DOM.commandPaletteInput.focus();
    });

    DOM.commandPaletteModal.addEventListener('click', (e) => {
        if (e.target === DOM.commandPaletteModal) DOM.commandPaletteModal.classList.add('hidden');
    });

    DOM.commandPaletteInput.addEventListener('input', filterPaletteResults);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            DOM.btnOpenCommandPalette.click();
        }
        if (e.key === 'Escape') {
            DOM.commandPaletteModal.classList.add('hidden');
            DOM.confirmModal.classList.add('hidden');
        }
    });

    // Confirm dialog events
    DOM.confirmCancelBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
        if (currentConfirmPromise) currentConfirmPromise(false);
    });
    DOM.confirmConfirmBtn.addEventListener('click', () => {
        DOM.confirmModal.classList.add('hidden');
        if (currentConfirmPromise) currentConfirmPromise(true);
    });

    // Bot settings dangerous reset action
    DOM.btnDangerReset.addEventListener('click', async () => {
        const confirmed = await showConfirm(
            'Yapılandırmaları Sıfırla',
            'Bu sunucunun tüm modül ayarları varsayılana döndürülecek. Emin misiniz?'
        );
        if (confirmed) {
            try {
                await discordDashboardApiClient.triggerAction(state.activeGuildId, 'reset_config');
                Toast.success('Sıfırlandı', 'Sunucu ayarları başarıyla sıfırlandı.');
                selectGuild(state.activeGuildId);
            } catch {
                state.dirtyConfigs = JSON.parse(JSON.stringify(discordDashboardMock.configs));
                loadConfigsToForms();
                renderOverviewModuleStatus();
                checkDirtyState();
                Toast.success('Simüle Sıfırlama Başarılı', 'Ayarlar yerel bellekte sıfırlandı.');
            }
        }
    });

    // Karşılamayı Test et trigger
    DOM.btnTestWelcome.addEventListener('click', async () => {
        try {
            await discordDashboardApiClient.triggerAction(state.activeGuildId, 'test_welcome');
            Toast.success('Test Karşılama Gönderildi', 'Discord sunucunuza test karşılama mesajı iletildi.');
        } catch {
            Toast.info('Simüle Karşılama Testi', 'Sandbox ortamında test sinyali başarıyla tetiklendi.');
        }
    });

    // Reaction role panels creation
    DOM.btnCreateRRPanel.addEventListener('click', () => {
        state.reactionRoles.push({
            title: 'Yeni Rol Paneli',
            description: 'Aşağıdaki tepkileri kullanarak rolünüzü seçin!',
            channelId: state.channels[0]?.id || '',
            roles: [{ emoji: '✅', roleId: state.roles[0]?.id || '' }]
        });
        renderReactionRoles();
        triggerReactionRolesDirty();
    });

    // Level reward creation binding
    DOM.btnAddLevelReward.addEventListener('click', () => {
        if (!state.dirtyConfigs.levels) state.dirtyConfigs.levels = { rewards: {} };
        const rewards = state.dirtyConfigs.levels.rewards;
        const nextLvl = Object.keys(rewards).length * 5 + 5;
        rewards[nextLvl] = state.roles[0]?.id || '';
        checkDirtyState();
        renderLevelRewards();
    });

    // Commands list filter bindings
    DOM.commandSearchInput.addEventListener('input', renderBotCommands);
    DOM.commandCategorySelect.addEventListener('change', renderBotCommands);

    // Return to Admin button
    DOM.btnBackToAdmin.addEventListener('click', () => {
        window.location.href = '/index.html';
    });
}

// Initializer execution
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    bindEvents();
});
