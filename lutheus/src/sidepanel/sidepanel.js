import {
    Storage,
    DEFAULT_POINTTRAIN_CHANNELS,
    DEFAULT_POINT_WEIGHTS
} from '../lib/storage.js';
import {
    getLastWeekRange,
    formatTurkishDateTime,
    parseDate,
    debounce,
    escapeHtml
} from '../lib/utils.js';
import { CUKEngine, PenaltyStatus } from '../lib/cukEngine.js';
import { buildPointtrainMarkdown, buildPointtrainCsv } from '../lib/pointtrainEngine.js';
import { AuthService } from '../auth/authService.js';
import { getRoleColor, getRoleLabel, getVisibleSections, isPrivilegedRole, normalizeRole } from '../auth/rolePolicy.js';
import { bindAvatarFallbacks, resolveAvatar } from '../lib/avatar.js';

const ACTIONS = {
    RUN_AUTONOMOUS_SCAN: 'RUN_AUTONOMOUS_SCAN',
    OPEN_ADMIN: 'OPEN_ADMIN',
    CLOSE_TAB: 'CLOSE_TAB',
    CANCEL_AUTONOMOUS_SCAN: 'CANCEL_AUTONOMOUS_SCAN',
    RUN_POINTTRAIN_SCAN: 'RUN_POINTTRAIN_SCAN',
    CANCEL_POINTTRAIN_SCAN: 'CANCEL_POINTTRAIN_SCAN',
    SCAN_PROGRESS_EVENT: 'SCAN_PROGRESS_EVENT',
    POINTTRAIN_PROGRESS_EVENT: 'POINTTRAIN_PROGRESS_EVENT',
    POINTTRAIN_DONE_EVENT: 'POINTTRAIN_DONE_EVENT',
    OPEN_CASE_PAGE: 'OPEN_CASE_PAGE'
};

const DEFAULT_GUILD_ID = '1223431616081166336';

const DOM = {
    navButtons: document.querySelectorAll('.nav-btn'),
    sections: document.querySelectorAll('.view-section'),
    statusDot: document.getElementById('statusDot'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    totalCases: document.getElementById('totalCases'),
    totalMods: document.getElementById('totalMods'),
    scannedPagesVal: document.getElementById('scannedPagesVal'),
    btnQuickScan: document.getElementById('btnQuickScan'),
    pageInput: document.getElementById('pageInput'),
    toggleAutofill: document.getElementById('toggleAutofill'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    btnToday: document.getElementById('btnToday'),
    btnLastWeek: document.getElementById('btnLastWeek'),
    btnLastMonth: document.getElementById('btnLastMonth'),
    btnAllTime: document.getElementById('btnAllTime'),
    chkOpenAdmin: document.getElementById('chkOpenAdmin'),
    chkCloseDashboard: document.getElementById('chkCloseDashboard'),
    chkCumulativeMode: document.getElementById('chkCumulativeMode'),
    chkDetailScan: document.getElementById('chkDetailScan'),
    detailLimit: document.getElementById('detailLimit'),
    btnStartScan: document.getElementById('btnStartScan'),
    btnStopScan: document.getElementById('btnStopScan'),
    progressBox: document.getElementById('progressBox'),
    progressFill: document.getElementById('progressFill'),
    progressLabel: document.getElementById('progressLabel'),
    progressPercent: document.getElementById('progressPercent'),
    statsMainView: document.getElementById('statsMainView'),
    statsDetailView: document.getElementById('statsDetailView'),
    btnBackToStats: document.getElementById('btnBackToStats'),
    detailModName: document.getElementById('detailModName'),
    detailModId: document.getElementById('detailModId'),
    detailCasesList: document.getElementById('detailCasesList'),
    searchMod: document.getElementById('searchMod'),
    modList: document.getElementById('modList'),
    btnExport: document.getElementById('btnExport'),
    btnOpenAdmin: document.getElementById('btnOpenAdmin'),
    guildId: document.getElementById('guildId'),
    scanDelay: document.getElementById('scanDelay'),
    toggleAutoSave: document.getElementById('toggleAutoSave'),
    btnClearCases: document.getElementById('btnClearCases'),
    btnResetAll: document.getElementById('btnResetAll'),
    logContent: document.getElementById('logContent'),
    btnClearLogs: document.getElementById('btnClearLogs'),
    ptBtnToday: document.getElementById('ptBtnToday'),
    ptBtnLastWeek: document.getElementById('ptBtnLastWeek'),
    ptBtnLastMonth: document.getElementById('ptBtnLastMonth'),
    ptStartDate: document.getElementById('ptStartDate'),
    ptEndDate: document.getElementById('ptEndDate'),
    pointtrainChannelList: document.getElementById('pointtrainChannelList'),
    ptPunishmentWeight: document.getElementById('ptPunishmentWeight'),
    ptMessageWeight: document.getElementById('ptMessageWeight'),
    ptChannelBonus: document.getElementById('ptChannelBonus'),
    ptActiveDayBonus: document.getElementById('ptActiveDayBonus'),
    btnStartPointtrain: document.getElementById('btnStartPointtrain'),
    btnCancelPointtrain: document.getElementById('btnCancelPointtrain'),
    btnPointtrainResetChannels: document.getElementById('btnPointtrainResetChannels'),
    btnPointtrainExport: document.getElementById('btnPointtrainExport'),
    btnPointtrainCopy: document.getElementById('btnPointtrainCopy'),
    pointtrainProgressBox: document.getElementById('pointtrainProgressBox'),
    pointtrainProgressFill: document.getElementById('pointtrainProgressFill'),
    pointtrainProgressLabel: document.getElementById('pointtrainProgressLabel'),
    pointtrainProgressPercent: document.getElementById('pointtrainProgressPercent'),
    pointtrainSummary: document.getElementById('pointtrainSummary'),
    pointtrainResultList: document.getElementById('pointtrainResultList'),
    profilePageAvatar: document.getElementById('profilePageAvatar'),
    profilePageName: document.getElementById('profilePageName'),
    profilePageIdentity: document.getElementById('profilePageIdentity'),
    profilePageRole: document.getElementById('profilePageRole'),
    profileStatsGrid: document.getElementById('profileStatsGrid'),
    btnLogout: document.getElementById('btnLogout')
};

const state = {
    session: null,
    isScanning: false,
    pointtrainRunning: false,
    scannedPages: 0,
    latestPointtrainRun: null,
    currentModeratorStats: []
};

const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toastContainer');
    },

    show(title, message, type = 'info', duration = 4000) {
        if (!this.container) this.init();
        if (!this.container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${getToastIcon(type)}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(title)}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" type="button"><i class="fa-solid fa-xmark"></i></button>
        `;
        toast.querySelector('.toast-close')?.addEventListener('click', () => this.dismiss(toast));
        this.container.appendChild(toast);
        if (duration > 0) setTimeout(() => this.dismiss(toast), duration);
    },

    dismiss(toast) {
        if (!toast || toast.classList.contains('hiding')) return;
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    },

    success(title, message) { this.show(title, message, 'success'); },
    error(title, message) { this.show(title, message, 'error', 6000); },
    warning(title, message) { this.show(title, message, 'warning'); },
    info(title, message) { this.show(title, message, 'info'); }
};

function getToastIcon(type) {
    if (type === 'success') return 'fa-check';
    if (type === 'error') return 'fa-xmark';
    if (type === 'warning') return 'fa-exclamation';
    return 'fa-info';
}

function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function sendRuntimeMessage(message) {
    return chrome.runtime.sendMessage(message);
}

async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

function setStatus(status) {
    DOM.statusDot.className = 'status-dot';
    if (status === 'scanning') DOM.statusDot.classList.add('scanning');
    if (status === 'error') DOM.statusDot.classList.add('error');
}

function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="time">${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="message">${escapeHtml(message)}</span>
    `;
    DOM.logContent.prepend(entry);
    while (DOM.logContent.children.length > 50) {
        DOM.logContent.removeChild(DOM.logContent.lastChild);
    }
}

function parsePageInput(value) {
    const raw = (value || '').trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return [Number(raw)];
    const match = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start > end) return null;
    return Array.from({ length: (end - start) + 1 }, (_, index) => start + index);
}

function switchSection(sectionId) {
    if (!getVisibleSections(state.session?.role).includes(sectionId)) {
        sectionId = 'home';
    }
    DOM.navButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.section === sectionId);
    });
    DOM.sections.forEach((section) => {
        section.classList.toggle('active', section.id === `section-${sectionId}`);
    });
}

function applyRoleVisibility() {
    const visible = new Set(getVisibleSections(state.session?.role));
    DOM.navButtons.forEach((button) => {
        button.classList.toggle('hidden', !visible.has(button.dataset.section));
    });
    if (!isPrivilegedRole(state.session?.role)) {
        DOM.btnOpenAdmin?.classList.add('hidden');
        DOM.chkOpenAdmin.checked = false;
        if (DOM.chkDetailScan) {
            DOM.chkDetailScan.checked = false;
            DOM.chkDetailScan.disabled = true;
        }
        if (DOM.detailLimit) DOM.detailLimit.disabled = true;
    }
}

function setScanProgress(current, total, label) {
    const safeTotal = Math.max(1, Number(total || 1));
    const safeCurrent = Math.min(safeTotal, Math.max(0, Number(current || 0)));
    const percent = Math.min(100, Math.max(0, Math.round((safeCurrent / safeTotal) * 100)));
    DOM.progressBox.classList.add('active');
    DOM.progressLabel.textContent = label || 'Hazirlaniyor...';
    DOM.progressPercent.textContent = `${percent}%`;
    DOM.progressFill.style.width = `${percent}%`;
    DOM.progressFill.setAttribute('aria-valuenow', String(percent));
}

function resetScanProgress() {
    DOM.progressBox.classList.remove('active');
    DOM.progressLabel.textContent = 'Hazirlaniyor...';
    DOM.progressPercent.textContent = '0%';
    DOM.progressFill.style.width = '0%';
}

function setPointtrainProgress(payload = {}) {
    const total = payload.total || 0;
    const current = payload.current || 0;
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    DOM.pointtrainProgressBox.classList.add('active');
    DOM.pointtrainProgressLabel.textContent = payload.staff
        ? `${payload.staff} taraniyor`
        : (payload.label || 'Hazir');
    DOM.pointtrainProgressPercent.textContent = `${percent}%`;
    DOM.pointtrainProgressFill.style.width = `${percent}%`;
}

function resetPointtrainProgress() {
    DOM.pointtrainProgressBox.classList.add('active');
    DOM.pointtrainProgressLabel.textContent = 'Hazir';
    DOM.pointtrainProgressPercent.textContent = '0%';
    DOM.pointtrainProgressFill.style.width = '0%';
}

function toLocalDateString(date) {
    const d = date || new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
}

function getDatePresetRange(preset) {
    const today = new Date();
    const endDate = toLocalDateString(today);

    if (preset === 'today') {
        return { startDate: endDate, endDate };
    }

    const start = new Date(today);
    start.setDate(start.getDate() - (preset === 'last30' ? 30 : 7));
    return { startDate: toLocalDateString(start), endDate };
}

function applyScanPreset(preset) {
    if (preset === 'week') {
        const range = getLastWeekRange();
        DOM.startDate.value = toLocalDateString(range.startDate);
        DOM.endDate.value = toLocalDateString(range.endDate);
        return;
    }

    if (preset === 'today') {
        const range = getDatePresetRange('today');
        DOM.startDate.value = range.startDate;
        DOM.endDate.value = range.endDate;
        return;
    }

    if (preset === 'month') {
        const range = getDatePresetRange('last30');
        DOM.startDate.value = range.startDate;
        DOM.endDate.value = range.endDate;
        return;
    }

    DOM.startDate.value = '';
    DOM.endDate.value = '';
}

function applyPointtrainPreset(preset) {
    const range = getDatePresetRange(preset);
    DOM.ptStartDate.value = range.startDate;
    DOM.ptEndDate.value = range.endDate;
}

function ensurePointtrainChannels(channels) {
    if (!Array.isArray(channels) || channels.length === 0) {
        return DEFAULT_POINTTRAIN_CHANNELS.map((channel) => ({ ...channel, enabled: true }));
    }
    return channels.map((channel) => ({
        id: channel.id || '',
        label: channel.label || channel.id || '',
        weight: Number(channel.weight ?? 1),
        enabled: channel.enabled !== false
    }));
}

function renderPointtrainChannels(channels) {
    DOM.pointtrainChannelList.innerHTML = ensurePointtrainChannels(channels).map((channel) => `
        <div class="channel-config-item">
            <label><input type="checkbox" data-field="enabled" ${channel.enabled ? 'checked' : ''}> Aktif</label>
            <input type="text" data-field="label" value="${escapeHtml(channel.label)}" placeholder="Kanal etiketi">
            <input type="text" data-field="id" value="${escapeHtml(channel.id)}" placeholder="kanal kimligi">
            <input type="number" data-field="weight" step="0.1" min="0" value="${Number(channel.weight || 1)}">
        </div>
    `).join('');
}

function getPointtrainChannelsFromDom() {
    return Array.from(DOM.pointtrainChannelList.querySelectorAll('.channel-config-item')).map((row) => ({
        label: row.querySelector('[data-field="label"]')?.value.trim() || '',
        id: row.querySelector('[data-field="id"]')?.value.trim() || '',
        weight: Number(row.querySelector('[data-field="weight"]')?.value || 1),
        enabled: !!row.querySelector('[data-field="enabled"]')?.checked
    })).filter((channel) => channel.id && channel.label && channel.enabled);
}

function getPointWeightsFromDom() {
    return {
        punishmentWeight: Number(DOM.ptPunishmentWeight.value || DEFAULT_POINT_WEIGHTS.punishmentWeight),
        messageWeight: Number(DOM.ptMessageWeight.value || DEFAULT_POINT_WEIGHTS.messageWeight),
        channelDiversityBonus: Number(DOM.ptChannelBonus.value || DEFAULT_POINT_WEIGHTS.channelDiversityBonus),
        activeDayBonus: Number(DOM.ptActiveDayBonus.value || DEFAULT_POINT_WEIGHTS.activeDayBonus),
        penaltyFlags: DEFAULT_POINT_WEIGHTS.penaltyFlags
    };
}

function getValidation(entry) {
    return CUKEngine.validate(entry);
}

function avatarImg(url, className, alt) {
    return `<img src="${escapeHtml(resolveAvatar(url))}" class="${className}" alt="${escapeHtml(alt || 'Avatar')}" data-avatar-img>`;
}

function isGenericStaffName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || [
        'unknown',
        'bilinmiyor',
        'bilinmeyen yetkili',
        'discord destek ekibi',
        'discord moderatör',
        'discord moderator',
        'discord yöneticisi',
        'discord yoneticisi',
        'yönetici',
        'yonetici',
        'genel sorumlu',
        'moderator',
        'moderatör'
    ].includes(normalized);
}

function pickStaffName(...values) {
    const names = values.map((value) => String(value || '').trim()).filter(Boolean);
    return names.find((name) => !isGenericStaffName(name)) || names[0] || 'Bilinmiyor';
}

function computeModeratorStats(cases, registry) {
    const map = new Map();

    cases.forEach((entry) => {
        const key = entry.authorId || entry.authorName || 'unknown';
        const registryEntry = registry[entry.authorId] || {};
        const validation = getValidation(entry);

        if (!map.has(key)) {
            const role = normalizeRole(registryEntry.role || entry.role || 'moderator');
            map.set(key, {
                id: entry.authorId || '',
                name: pickStaffName(entry.authorName, registryEntry.displayName, registryEntry.name),
                avatar: resolveAvatar(registryEntry.avatar || entry.authorAvatar),
                role,
                count: 0,
                valid: 0,
                invalid: 0,
                pending: 0,
                reasons: {}
            });
        }

        const current = map.get(key);
        current.count += 1;
        current.reasons[entry.reason || 'Bilinmiyor'] = (current.reasons[entry.reason || 'Bilinmiyor'] || 0) + 1;
        if (validation.status === PenaltyStatus.VALID) current.valid += 1;
        if (validation.status === PenaltyStatus.INVALID) current.invalid += 1;
        if (validation.status === PenaltyStatus.PENDING || validation.status === PenaltyStatus.UNKNOWN) current.pending += 1;
    });

    return Array.from(map.values()).map((entry) => {
        const performance = CUKEngine.calculatePerformanceScore({
            valid: entry.valid,
            invalid: entry.invalid,
            pending: entry.pending
        });
        const topReason = Object.entries(entry.reasons).sort((left, right) => right[1] - left[1])[0]?.[0] || '—';
        return { ...entry, topReason, performance };
    }).sort((left, right) => right.count - left.count);
}

async function loadSettings() {
    const settings = await Storage.getSettings();
    DOM.guildId.value = settings.guildId || DEFAULT_GUILD_ID;
    DOM.scanDelay.value = settings.scanDelay || 2000;
    DOM.toggleAutoSave.checked = settings.autoSaveWeekly !== false;
}

async function saveSettings() {
    const current = await Storage.getSettings();
    const next = {
        ...current,
        guildId: DOM.guildId.value.trim() || DEFAULT_GUILD_ID,
        scanDelay: Number(DOM.scanDelay.value || 2000),
        autoSaveWeekly: DOM.toggleAutoSave.checked
    };
    await Storage.saveSettings(next);
    return next;
}

async function loadScanLogs() {
    const logs = await Storage.getScanLogs();
    DOM.logContent.innerHTML = '';
    logs.slice(0, 25).forEach((entry) => log(entry.message || entry.action || 'Tarama kaydi', entry.type || 'info'));
}

async function updateUserProfile() {
    const userInfo = await Storage.getUserInfo();
    const profile = state.session?.profile || {};
    const resolved = {
        name: profile.displayName || userInfo?.name || 'Yetkili',
        avatar: profile.avatar || userInfo?.avatar,
        role: normalizeRole(state.session?.role || profile.role || 'moderator'),
        identity: profile.discordId ? `Discord ID: ${profile.discordId}` : (profile.email || profile.uid || '-')
    };
    DOM.profileAvatar.src = resolveAvatar(resolved.avatar);
    DOM.profileAvatar.dataset.avatarImg = '1';
    DOM.profileName.textContent = resolved.name;
    DOM.profilePageAvatar.src = resolveAvatar(resolved.avatar);
    DOM.profilePageAvatar.dataset.avatarImg = '1';
    DOM.profilePageName.textContent = resolved.name;
    DOM.profilePageIdentity.textContent = resolved.identity;
    DOM.profilePageRole.textContent = resolved.role;
    DOM.profilePageRole.className = `role-badge ${resolved.role}`;
    bindAvatarFallbacks();
}

async function updateStats() {
    const [cases, registry, rules] = await Promise.all([Storage.getCases(), Storage.getUserRegistry(), Storage.getDynamicRules()]);
    CUKEngine.setRules(rules);
    const visibleCases = filterCasesByRole(cases);
    const weekly = Storage.calculateWeeklyStats(visibleCases);
    state.currentModeratorStats = computeModeratorStats(visibleCases, registry);
    DOM.totalCases.textContent = String(weekly.totalCases || 0);
    DOM.totalMods.textContent = String(weekly.totalModerators || 0);
    DOM.scannedPagesVal.textContent = String(state.scannedPages || 0);
    renderProfileStats(visibleCases);
    await renderModList(DOM.searchMod.value);
}

function filterCasesByRole(cases) {
    const role = normalizeRole(state.session?.role);
    if (isPrivilegedRole(role)) return cases;
    // Non-privileged: show only own cases
    const profile = state.session?.profile || {};
    const myId = String(profile.discordId || profile.uid || '').toLowerCase();
    const myName = String(profile.displayName || profile.username || '').toLowerCase();
    return cases.filter((entry) => {
        return (myId && String(entry.authorId || '').toLowerCase() === myId)
            || (myName && String(entry.authorName || '').toLowerCase() === myName);
    });
}

function renderProfileStats(cases) {
    const profile = state.session?.profile || {};
    const myId = String(profile.discordId || profile.uid || '').toLowerCase();
    const myName = String(profile.displayName || profile.username || '').toLowerCase();
    
    const myCases = cases.filter((entry) => {
        return (myId && String(entry.authorId || '').toLowerCase() === myId)
            || (myName && String(entry.authorName || '').toLowerCase() === myName);
    });

    const validCounts = myCases.reduce((acc, entry) => {
        const status = getValidation(entry).status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    
    DOM.profileStatsGrid.innerHTML = `
        <div class="comp-card">
            <div class="comp-label">Kendi Cezalarim</div>
            <div class="comp-value">${myCases.length}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Dogru</div>
            <div class="comp-value">${validCounts.valid || 0}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Inceleme</div>
            <div class="comp-value">${(validCounts.pending || 0) + (validCounts.unknown || 0)}</div>
        </div>
    `;
}

async function renderModList(search = '') {
    const query = search.trim().toLowerCase();
    const list = state.currentModeratorStats.filter((entry) => {
        if (!query) return true;
        return entry.name.toLowerCase().includes(query) || entry.role.toLowerCase().includes(query);
    });

    if (!list.length) {
        DOM.modList.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                <i class="fa-solid fa-inbox" style="font-size:32px; margin-bottom:12px; opacity:0.5;"></i>
                <p>Sonuc bulunamadi</p>
            </div>
        `;
        return;
    }

    DOM.modList.innerHTML = list.map((entry, index) => `
        <button class="mod-item interactive role-framed" type="button" data-id="${escapeHtml(entry.id)}" data-name="${escapeHtml(entry.name)}" style="--role-color:${escapeHtml(getRoleColor(entry.role))}">
            <div class="mod-avatar-wrap">
                ${avatarImg(entry.avatar, 'mod-avatar', entry.name)}
            </div>
            <div class="mod-main">
                <div class="mod-top">
                    <span class="mod-rank">#${index + 1}</span>
                    <span class="mod-name">${escapeHtml(entry.name)}</span>
                    <span class="pointtrain-pill">${escapeHtml(getRoleLabel(entry.role))}</span>
                </div>
                <div class="mod-meta mod-identity">
                    <span>Discord ID: ${escapeHtml(entry.id || 'yok')}</span>
                </div>
                <div class="mod-meta">
                    <span>${entry.count} ceza</span>
                    <span>${entry.valid} dogru</span>
                    <span>${entry.invalid} hatali</span>
                    <span>${entry.pending} bekleyen</span>
                </div>
                <div class="mod-meta">
                    <span>Skor ${entry.performance.score}</span>
                    <span>${escapeHtml(entry.performance.status)}</span>
                    <span>${escapeHtml(entry.topReason)}</span>
                </div>
            </div>
        </button>
    `).join('');
    bindAvatarFallbacks(DOM.modList);

    DOM.modList.querySelectorAll('.mod-item.interactive').forEach((item) => {
        item.addEventListener('click', () => enterFocusMode(item.dataset.name, item.dataset.id));
    });
}

async function enterFocusMode(name, id) {
    const cases = await Storage.getCases();
    const filtered = cases
        .filter((entry) => String(entry.authorId || '') === String(id || '') || entry.authorName === name)
        .sort((left, right) => (parseDate(right.createdRaw)?.getTime() || 0) - (parseDate(left.createdRaw)?.getTime() || 0));

    DOM.statsMainView.classList.add('hidden');
    DOM.statsDetailView.classList.remove('hidden');
    DOM.detailModName.textContent = name || 'Yetkili';
    DOM.detailModId.textContent = `ID: ${id || '-'}`;

    DOM.detailCasesList.innerHTML = filtered.map((entry) => {
        const validation = getValidation(entry);
        return `
            <article class="pointtrain-row">
                <div>
                    <button class="case-inline-link open-case-btn" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">
                        #${escapeHtml(String(entry.id || entry.caseId || '-'))}
                    </button>
                    <div class="pointtrain-meta">
                        <span>${escapeHtml(entry.reason || 'Sebep yok')}</span>
                        <span>${escapeHtml(entry.type || 'tur yok')}</span>
                        <span>${escapeHtml(entry.createdRaw || '-')}</span>
                    </div>
                    <div class="pointtrain-breakdown">${escapeHtml(validation.reason || 'Degerlendirme yok')}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="pointtrain-pill">${escapeHtml(validation.status || 'unknown')}</span>
                    <button class="toolbar-btn open-case-btn" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </div>
            </article>
        `;
    }).join('');

    DOM.detailCasesList.querySelectorAll('.open-case-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            await sendRuntimeMessage({
                action: ACTIONS.OPEN_CASE_PAGE,
                guildId: DOM.guildId.value.trim() || DEFAULT_GUILD_ID,
                caseId: button.dataset.caseId
            });
        });
    });
}

function exitFocusMode() {
    DOM.statsDetailView.classList.add('hidden');
    DOM.statsMainView.classList.remove('hidden');
}

async function exportReport() {
    const cases = await Storage.getCases();
    const registry = await Storage.getUserRegistry();
    const report = {
        exportedAt: new Date().toISOString(),
        cases: cases.length,
        moderators: computeModeratorStats(cases, registry)
    };
    downloadFile(`lutheus-rapor-${Date.now()}.json`, JSON.stringify(report, null, 2), 'application/json;charset=utf-8');
    Toast.success('Rapor hazir', 'JSON raporu indirildi');
}

function renderPointtrainRun(run) {
    if (!run) {
        DOM.pointtrainSummary.innerHTML = `
            <div class="comp-card" style="grid-column: span 3;">
                <div class="comp-label">Pointtrain Hazir Degil</div>
                <div class="comp-value" style="font-size: 13px; opacity: 0.6;">Henüz bir tarama yapilmadi</div>
            </div>
        `;
        DOM.pointtrainResultList.innerHTML = '';
        return;
    }

    DOM.pointtrainSummary.innerHTML = `
        <div class="comp-card">
            <div class="comp-label">Calistirma</div>
            <div class="comp-value">${escapeHtml(formatTurkishDateTime(run.createdAt))}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Lider Puan</div>
            <div class="comp-value">${Number(run.metrics?.[0]?.weightedScore || 0).toFixed(2)}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Partial Failure</div>
            <div class="comp-value">${run.partialFailures || 0}</div>
        </div>
    `;

    DOM.pointtrainResultList.innerHTML = (run.metrics || []).map((metric, index) => `
        <article class="pointtrain-row">
            <div>
                <div class="pointtrain-meta">
                    <span class="pointtrain-rank">#${index + 1}</span>
                    <strong>${escapeHtml(metric.displayName || 'Bilinmiyor')}</strong>
                    <span class="pointtrain-pill">${escapeHtml(metric.role || 'moderator')}</span>
                </div>
                <div class="pointtrain-meta">
                    <span>${metric.sapphirePunishments || 0} ceza</span>
                    <span>${metric.discordMessageCount || 0} mesaj</span>
                    <span>${metric.channelCount || 0} kanal</span>
                    <span>${metric.activeDays || 0} aktif gun</span>
                </div>
                <div class="pointtrain-breakdown">
                    Ceza ${Number(metric.breakdown?.punishmentPoints || 0).toFixed(2)} |
                    Mesaj ${Number(metric.breakdown?.messagePoints || 0).toFixed(2)} |
                    Kanal ${Number(metric.breakdown?.channelBonus || 0).toFixed(2)} |
                    Gun ${Number(metric.breakdown?.activeDayBonus || 0).toFixed(2)}
                </div>
            </div>
            <div class="pointtrain-score">${Number(metric.weightedScore || 0).toFixed(2)}</div>
        </article>
    `).join('');
}

async function loadPointtrainSettings() {
    const [settings, weights, run] = await Promise.all([
        Storage.getPointtrainSettings(),
        Storage.getPointWeights(),
        Storage.getLatestPointtrainRun()
    ]);
    DOM.ptStartDate.value = settings.startDate || '';
    DOM.ptEndDate.value = settings.endDate || '';
    DOM.ptPunishmentWeight.value = weights.punishmentWeight;
    DOM.ptMessageWeight.value = weights.messageWeight;
    DOM.ptChannelBonus.value = weights.channelDiversityBonus;
    DOM.ptActiveDayBonus.value = weights.activeDayBonus;
    renderPointtrainChannels(settings.channels);
    state.latestPointtrainRun = run;
    renderPointtrainRun(run);
}

async function runScan() {
    if (state.isScanning) return;
    if (!isPrivilegedRole(state.session?.role)) {
        Toast.warning('Yetki gerekli', 'Tarama baslatmak icin yonetici veya kidemli rol gerekir');
        return;
    }

    const settings = await saveSettings();
    const pages = parsePageInput(DOM.pageInput.value);

    if (DOM.pageInput.value.trim() && !pages) {
        Toast.error('Gecersiz sayfa', 'Sayfa alani 5 veya 1-10 formatinda olmali');
        return;
    }

    state.isScanning = true;
    DOM.btnStartScan.disabled = true;
    DOM.btnStopScan.disabled = false;
    setStatus('scanning');
    const useDetailScan = Boolean(DOM.chkDetailScan?.checked && isPrivilegedRole(state.session?.role));
    setScanProgress(0, pages?.length || 1, useDetailScan ? 'Detayli Sapphire taramasi baslatiliyor' : 'API destekli hizli Sapphire taramasi baslatiliyor');
    log(useDetailScan ? 'Detayli Sapphire taramasi baslatildi' : 'API destekli hizli Sapphire taramasi baslatildi');

    try {
        const response = await sendRuntimeMessage({
            action: ACTIONS.RUN_AUTONOMOUS_SCAN,
            options: {
                guildId: settings.guildId,
                pages,
                startDate: DOM.startDate.value || null,
                endDate: DOM.endDate.value || null,
                scanDelay: Number(settings.scanDelay || 2000),
                scanMode: useDetailScan ? 'detail' : 'fast',
                enrichDetails: useDetailScan,
                detailLimit: Number(DOM.detailLimit?.value || 0),
                retryCount: 1
            }
        });

        if (!response?.success) {
            throw new Error(response?.error || 'Tarama basarisiz');
        }

        if (Array.isArray(response.cases) && response.cases.length) {
            await Storage.updateCases(response.cases, DOM.chkCumulativeMode?.checked !== false);
        }

        state.scannedPages = response.scanRun?.pagesScanned || pages?.length || 0;
        const totalPages = response.scanRun?.pagesRequested || response.scanRun?.totalPages || state.scannedPages || 1;
        const totalCases = response.scanRun?.totalCases || response.cases?.length || 0;
        const modeLabel = response.apiMode ? 'API' : 'Dashboard';
        setScanProgress(state.scannedPages, totalPages, `${modeLabel}: ${state.scannedPages} / ${totalPages} sayfa - ${response.cases?.length || 0} / ${totalCases} ceza`);
        log(`${modeLabel} tarama tamamlandi, ${state.scannedPages}/${totalPages} sayfa, ${response.cases?.length || 0}/${totalCases} ceza, ${response.scanRun?.failures?.length || 0} hata`, 'success');

        if (settings.autoSaveWeekly) {
            await Storage.saveWeeklySnapshot();
        }

        if (DOM.chkOpenAdmin.checked) {
            await sendRuntimeMessage({ action: ACTIONS.OPEN_ADMIN });
        }

        if (DOM.chkCloseDashboard.checked && response.tabId) {
            await sendRuntimeMessage({ action: ACTIONS.CLOSE_TAB, tabId: response.tabId });
        }

        if (response.cancelled) {
            Toast.warning('Tarama durduruldu', `${response.cases?.length || 0} ceza kaydedildi`);
        } else {
            Toast.success('Tarama tamamlandi', `${response.cases?.length || 0} ceza kaydedildi`);
        }
        await updateStats();
    } catch (error) {
        console.error(error);
        setStatus('error');
        Toast.error('Tarama hatasi', error.message || 'Bilinmeyen hata');
        log(`Tarama hatasi: ${error.message || 'Bilinmeyen hata'}`, 'error');
    } finally {
        state.isScanning = false;
        DOM.btnStartScan.disabled = false;
        DOM.btnStopScan.disabled = true;
        setStatus();
        setTimeout(resetScanProgress, 1000);
    }
}

function stopScan() {
    sendRuntimeMessage({ action: ACTIONS.CANCEL_AUTONOMOUS_SCAN }).catch(() => undefined);
    state.isScanning = false;
    DOM.btnStartScan.disabled = false;
    DOM.btnStopScan.disabled = true;
    resetScanProgress();
    Toast.warning('Tarama', 'Durdurma istegi gonderildi');
}

async function persistPointtrainInputs() {
    const settings = {
        guildId: DOM.guildId.value.trim() || DEFAULT_GUILD_ID,
        discordGuildId: DOM.guildId.value.trim() || DEFAULT_GUILD_ID,
        datePreset: 'custom',
        startDate: DOM.ptStartDate.value || '',
        endDate: DOM.ptEndDate.value || '',
        channels: getPointtrainChannelsFromDom()
    };

    if (!settings.channels.length) {
        throw new Error('En az bir aktif kanal secilmeli');
    }

    const weights = getPointWeightsFromDom();
    await Promise.all([Storage.savePointtrainSettings(settings), Storage.savePointWeights(weights)]);
    return { settings, weights };
}

async function startPointtrainScan() {
    if (state.pointtrainRunning) return;

    try {
        const payload = await persistPointtrainInputs();
        state.pointtrainRunning = true;
        DOM.btnStartPointtrain.disabled = true;
        DOM.btnCancelPointtrain.disabled = false;
        setPointtrainProgress({ current: 0, total: 1, label: 'Discord otomasyonu baslatiliyor' });

        const response = await sendRuntimeMessage({
            action: ACTIONS.RUN_POINTTRAIN_SCAN,
            options: payload
        });

        const run = response?.run || response;
        state.latestPointtrainRun = run;
        renderPointtrainRun(run);
        Toast.success('Pointtrain hazir', `${run.metrics?.length || 0} yetkili puanlandi`);
    } catch (error) {
        console.error(error);
        Toast.error('Pointtrain hatasi', error.message || 'Islem basarisiz');
    } finally {
        state.pointtrainRunning = false;
        DOM.btnStartPointtrain.disabled = false;
        DOM.btnCancelPointtrain.disabled = true;
        setTimeout(resetPointtrainProgress, 800);
    }
}

async function cancelPointtrainScan() {
    await sendRuntimeMessage({ action: ACTIONS.CANCEL_POINTTRAIN_SCAN });
    state.pointtrainRunning = false;
    DOM.btnStartPointtrain.disabled = false;
    DOM.btnCancelPointtrain.disabled = true;
    Toast.warning('Pointtrain', 'Iptal istegi gonderildi');
}

async function exportPointtrainCsv() {
    const run = state.latestPointtrainRun || await Storage.getLatestPointtrainRun();
    if (!run) {
        Toast.warning('Pointtrain', 'Disa aktarilacak veri yok');
        return;
    }
    downloadFile(`pointtrain-${Date.now()}.csv`, buildPointtrainCsv(run), 'text/csv;charset=utf-8');
}

async function copyPointtrainMarkdown() {
    const run = state.latestPointtrainRun || await Storage.getLatestPointtrainRun();
    if (!run) {
        Toast.warning('Pointtrain', 'Kopyalanacak veri yok');
        return;
    }
    await copyText(buildPointtrainMarkdown(run));
    Toast.success('Pointtrain', 'Discord format kopyalandi');
}

async function clearCases() {
    await Storage.clearCases();
    await updateStats();
    Toast.success('Temizlendi', 'Ceza verileri silindi');
}

async function resetAll() {
    await Storage.clear();
    await Promise.all([loadSettings(), loadPointtrainSettings(), updateUserProfile(), updateStats()]);
    DOM.logContent.innerHTML = '';
    Toast.success('Sifirlandi', 'Tum yerel veriler temizlendi');
}

function bindEvents() {
    DOM.navButtons.forEach((button) => {
        button.addEventListener('click', () => switchSection(button.dataset.section));
    });

    DOM.btnQuickScan?.addEventListener('click', () => switchSection('scan'));
    DOM.btnStartScan?.addEventListener('click', runScan);
    DOM.btnStopScan?.addEventListener('click', stopScan);
    DOM.btnToday?.addEventListener('click', () => applyScanPreset('today'));
    DOM.btnLastWeek?.addEventListener('click', () => applyScanPreset('week'));
    DOM.btnLastMonth?.addEventListener('click', () => applyScanPreset('month'));
    DOM.btnAllTime?.addEventListener('click', () => applyScanPreset('all'));
    DOM.btnExport?.addEventListener('click', exportReport);
    DOM.btnOpenAdmin?.addEventListener('click', () => sendRuntimeMessage({ action: ACTIONS.OPEN_ADMIN }));
    DOM.btnLogout?.addEventListener('click', async () => {
        await AuthService.logout();
        AuthService.redirectToLogin(chrome.runtime.getURL('src/sidepanel/sidepanel.html'));
    });
    DOM.btnBackToStats?.addEventListener('click', exitFocusMode);
    DOM.searchMod?.addEventListener('input', debounce((event) => renderModList(event.target.value), 120));
    DOM.guildId?.addEventListener('change', saveSettings);
    DOM.scanDelay?.addEventListener('change', saveSettings);
    DOM.toggleAutoSave?.addEventListener('change', saveSettings);
    DOM.btnClearCases?.addEventListener('click', clearCases);
    DOM.btnResetAll?.addEventListener('click', resetAll);
    DOM.btnClearLogs?.addEventListener('click', async () => {
        await Storage.set('scanLogs', []);
        DOM.logContent.innerHTML = '';
    });
    DOM.ptBtnToday?.addEventListener('click', () => applyPointtrainPreset('today'));
    DOM.ptBtnLastWeek?.addEventListener('click', () => applyPointtrainPreset('last7'));
    DOM.ptBtnLastMonth?.addEventListener('click', () => applyPointtrainPreset('last30'));
    DOM.btnStartPointtrain?.addEventListener('click', startPointtrainScan);
    DOM.btnCancelPointtrain?.addEventListener('click', cancelPointtrainScan);
    DOM.btnPointtrainExport?.addEventListener('click', exportPointtrainCsv);
    DOM.btnPointtrainCopy?.addEventListener('click', copyPointtrainMarkdown);
    DOM.btnPointtrainResetChannels?.addEventListener('click', async () => {
        renderPointtrainChannels(DEFAULT_POINTTRAIN_CHANNELS);
        const settings = await Storage.getPointtrainSettings();
        await Storage.savePointtrainSettings({ ...settings, channels: DEFAULT_POINTTRAIN_CHANNELS });
        Toast.success('Pointtrain', 'Preset kanallar yuklendi');
    });

    // Auto-fill page input toggle
    let autofillActive = false;
    DOM.toggleAutofill?.addEventListener('click', () => {
        autofillActive = !autofillActive;
        if (autofillActive) {
            DOM.toggleAutofill.classList.add('active');
            DOM.toggleAutofill.style.background = 'var(--accent)';
            DOM.toggleAutofill.style.color = '#fff';
            DOM.pageInput.value = '';
            DOM.pageInput.placeholder = 'Otomatik (tüm sayfalar)';
            DOM.pageInput.disabled = true;
            Toast.info('Auto Mod', 'Tüm sayfalar otomatik taranacak');
        } else {
            DOM.toggleAutofill.classList.remove('active');
            DOM.toggleAutofill.style.background = '';
            DOM.toggleAutofill.style.color = '';
            DOM.pageInput.placeholder = 'Örn: 5 veya 1-10';
            DOM.pageInput.disabled = false;
            Toast.info('Auto Mod', 'Manuel sayfa girişi aktif');
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === ACTIONS.SCAN_PROGRESS_EVENT) {
            const payload = message.payload || {};
            setScanProgress(
                payload.scannedCount || 0,
                payload.totalPages || 1,
                `${payload.mode === 'api' ? 'API' : 'Sayfa'} ${payload.currentPage || '-'} / ${payload.totalPages || '-'} - ${payload.casesFound || 0}${payload.totalCases ? ` / ${payload.totalCases}` : ''} ceza`
            );
        }
        if (message.action === ACTIONS.POINTTRAIN_PROGRESS_EVENT) {
            setPointtrainProgress(message.payload || {});
        }
        if (message.action === ACTIONS.POINTTRAIN_DONE_EVENT) {
            state.latestPointtrainRun = message.payload || null;
            renderPointtrainRun(state.latestPointtrainRun);
            state.pointtrainRunning = false;
            DOM.btnStartPointtrain.disabled = false;
            DOM.btnCancelPointtrain.disabled = true;
        }
    });
}

async function init() {
    state.session = await AuthService.requireSession({ returnTo: chrome.runtime.getURL('src/sidepanel/sidepanel.html') });
    Toast.init();
    bindEvents();
    applyRoleVisibility();
    applyScanPreset('week');
    applyPointtrainPreset('last7');
    await Promise.all([
        loadSettings(),
        loadScanLogs(),
        updateUserProfile(),
        updateStats(),
        loadPointtrainSettings()
    ]);
    resetScanProgress();
    resetPointtrainProgress();
    switchSection(getVisibleSections(state.session?.role)[0] || 'home');
}

init().catch((error) => {
    console.error(error);
    Toast.error('Baslatma hatasi', error.message || 'Sidepanel yuklenemedi');
});
