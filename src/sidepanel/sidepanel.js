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
import { getVisibleSections, isPrivilegedRole, normalizeRole } from '../auth/rolePolicy.js';
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
    languageSelect: document.getElementById('languageSelect'),
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
    btnDiscordScan: document.getElementById('btnDiscordScan'),
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
    toggleAutoOpen: document.getElementById('toggleAutoOpen'),
    toggleAutoOpenWidget: document.getElementById('toggleAutoOpenWidget'),
    btnTriggerAutoScanNow: document.getElementById('btnTriggerAutoScanNow'),
    autoScanPulse: document.getElementById('autoScanPulse'),
    valLastScanTime: document.getElementById('valLastScanTime'),
    valLastScanStatus: document.getElementById('valLastScanStatus'),
    valNextScanCountdown: document.getElementById('valNextScanCountdown'),
    valNewCasesCount: document.getElementById('valNewCasesCount'),
    autoScanLogs: document.getElementById('autoScanLogs'),
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
    language: 'tr',
    currentModeratorStats: []
};

const SIDE_PANEL_I18N = {
    tr: {
        languageChangedTitle: 'Dil',
        languageChangedMessage: 'Dil Türkçe olarak ayarlandı',
        ready: 'Hazır',
        scanAllPages: 'Tüm sayfalar otomatik taranacak',
        manualPageInput: 'Manuel sayfa girişi aktif',
        autoMode: 'Otomatik Mod'
    },
    en: {
        languageChangedTitle: 'Language',
        languageChangedMessage: 'Language set to English',
        ready: 'Ready',
        scanAllPages: 'All pages will be scanned automatically',
        manualPageInput: 'Manual page input enabled',
        autoMode: 'Auto Mode'
    }
};

function text(key) {
    return SIDE_PANEL_I18N[state.language]?.[key] || SIDE_PANEL_I18N.tr[key] || key;
}

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

// SECTION: LANGUAGE_SYNC
// PURPOSE: Sidepanel dil seçimini dashboard-v2 ile ortak Chrome storage anahtarında tutar.
async function loadLanguage() {
    const stored = await new Promise((resolve) => chrome.storage.local.get(['language'], resolve));
    const lang = stored?.language === 'en' ? 'en' : 'tr';
    state.language = lang;
    if (DOM.languageSelect) DOM.languageSelect.value = lang;
    localStorage.setItem('language', lang);
}

async function saveLanguage(lang) {
    state.language = lang === 'en' ? 'en' : 'tr';
    await new Promise((resolve) => chrome.storage.local.set({ language: state.language }, resolve));
    localStorage.setItem('language', state.language);
    if (DOM.languageSelect) DOM.languageSelect.value = state.language;
    Toast.info(text('languageChangedTitle'), text('languageChangedMessage'));
}

function setStatus(status) {
    DOM.statusDot.className = 'status-dot';
    if (status === 'connected') DOM.statusDot.classList.add('connected');
    if (status === 'scanning' || status === 'waiting') DOM.statusDot.classList.add('scanning');
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
    const isPrivileged = isPrivilegedRole(state.session?.role);
    const visible = new Set(getVisibleSections(state.session?.role));
    
    DOM.navButtons.forEach((button) => {
        const sect = button.dataset.section;
        if (!sect) return; // Skip buttons without data-section (like btnOpenAdmin)
        const shouldHide = !visible.has(sect) || (button.classList.contains('privileged-only') && !isPrivileged);
        button.classList.toggle('hidden', shouldHide);
    });

    document.querySelectorAll('.privileged-only').forEach((element) => {
        element.classList.toggle('hidden', !isPrivileged);
    });

    if (!isPrivileged) {
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
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    DOM.progressBox.classList.add('active');
    DOM.progressLabel.textContent = label || 'Hazirlaniyor...';
    DOM.progressPercent.textContent = `${percent}%`;
    DOM.progressFill.style.width = `${percent}%`;
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

function verdictLabel(status) {
    if (status === PenaltyStatus.VALID) return 'DOĞRU';
    if (status === PenaltyStatus.INVALID) return 'HATALI';
    if (status === PenaltyStatus.PENDING) return 'BEKLEYEN';
    return 'BİLİNMEYEN';
}

function verdictPillClass(status) {
    if (status === PenaltyStatus.INVALID) return 'pointtrain-pill status-badge invalid';
    if (status === PenaltyStatus.VALID) return 'pointtrain-pill status-badge valid';
    return 'pointtrain-pill status-badge pending';
}

function verdictRowClass(status) {
    if (status === PenaltyStatus.INVALID) return 'pointtrain-row case-card-status invalid';
    if (status === PenaltyStatus.VALID) return 'pointtrain-row case-card-status valid';
    return 'pointtrain-row case-card-status pending';
}

function avatarImg(url, className, alt) {
    return `<img src="${escapeHtml(resolveAvatar(url))}" class="${className}" alt="${escapeHtml(alt || 'Avatar')}" data-avatar-img>`;
}

function computeModeratorStats(cases, registry, roleCache = []) {
    const map = new Map();

    cases.forEach((entry) => {
        const id = entry.authorId || '';
        const rawName = entry.authorName || '';

        // ASSUME: Query role cache mapping first using actual Discord ID
        const roleEntry = roleCache.find((r) => {
            const cacheId = r.discordId || String(r.identityKey || r.id || '').replace(/^discord:/, '');
            return cacheId === id;
        });

        if (!roleEntry) return;

        const registryEntry = registry[id] || {};
        const validation = getValidation(entry);
        const isGeneric = (name) => {
            if (!name) return true;
            const lower = name.toLowerCase().trim();
            return lower === 'discord desteg ekibi' || lower === 'discord destek ekibi' || 
                   lower === 'discord moderator' || lower === 'discord moderatoru' ||
                   lower === 'discord yoneticisi' || lower === 'genel sorumlu' ||
                   lower === 'yonetici' || lower === 'bilinmeyen yetkili' ||
                   lower === 'kidemli' || lower === 'kidemli_discord_moderatoru' ||
                   lower === 'kidemli discord moderatoru';
        };

        const key = id || rawName || 'unknown';
        let displayName = roleEntry.displayName || registryEntry.name;
        if (rawName && (!displayName || isGeneric(displayName))) {
            displayName = rawName;
        }
        if (!displayName) {
            displayName = 'Bilinmiyor';
        }

        let caseAvatar = null;
        if (id && cases) {
            const matchingCase = cases.find(c => 
                (c.authorId && String(c.authorId) === id) && c.authorAvatar
            );
            if (matchingCase) caseAvatar = matchingCase.authorAvatar;
        }

        if (!map.has(key)) {
            map.set(key, {
                id: id,
                name: displayName,
                avatar: resolveAvatar(roleEntry.avatar || registryEntry.avatar || caseAvatar || entry.authorAvatar),
                role: normalizeRole(roleEntry.role || registryEntry.role || entry.role || 'moderator'),
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

    return Array.from(map.values()).map((entry) => ({
        ...entry,
        performance: CUKEngine.calculatePerformanceScore({
            valid: entry.valid,
            invalid: entry.invalid,
            pending: entry.pending
        })
    })).sort((left, right) => {
        const roleHierarchyPriority = {
            'kurucu': 0,
            'admin': 1,
            'yonetici': 2,
            'genel_sorumlu': 3,
            'discord_yoneticisi': 4,
            'kidemli_discord_moderatoru': 5,
            'senior_moderator': 6,
            'moderator': 7,
            'discord_moderatoru': 7,
            'support': 8,
            'discord_destek_ekibi': 8,
            'viewer': 9,
            'pending': 10,
            'blocked': 11
        };
        const pLeft = roleHierarchyPriority[left.role] ?? 99;
        const pRight = roleHierarchyPriority[right.role] ?? 99;
        if (pLeft !== pRight) return pLeft - pRight;
        if (right.count !== left.count) return right.count - left.count;
        return String(left.name).localeCompare(String(right.name));
    });
}

async function loadSettings() {
    const settings = await Storage.getSettings();
    DOM.guildId.value = settings.guildId || DEFAULT_GUILD_ID;
    DOM.scanDelay.value = settings.scanDelay || 2000;
    DOM.toggleAutoSave.checked = settings.autoSaveWeekly !== false;
    DOM.toggleAutoOpen.checked = settings.autoOpenHourly === true;
    if (DOM.toggleAutoOpenWidget) {
        DOM.toggleAutoOpenWidget.checked = settings.autoOpenHourly === true;
    }
    updateAutoScanUIState();
}

async function saveSettings(event) {
    const current = await Storage.getSettings();
    
    if (event && event.target) {
        if (event.target.id === 'toggleAutoOpen' && DOM.toggleAutoOpenWidget) {
            DOM.toggleAutoOpenWidget.checked = DOM.toggleAutoOpen.checked;
        } else if (event.target.id === 'toggleAutoOpenWidget' && DOM.toggleAutoOpen) {
            DOM.toggleAutoOpen.checked = DOM.toggleAutoOpenWidget.checked;
        }
    }

    const next = {
        ...current,
        guildId: DOM.guildId.value.trim() || DEFAULT_GUILD_ID,
        scanDelay: Number(DOM.scanDelay.value || 2000),
        autoSaveWeekly: DOM.toggleAutoSave.checked,
        autoOpenHourly: DOM.toggleAutoOpen.checked
    };
    await Storage.saveSettings(next);
    updateAutoScanUIState();
    return next;
}

async function updateAutoScanUIState() {
    const settings = await Storage.getSettings();
    const isEnabled = settings.autoOpenHourly === true;

    if (DOM.autoScanPulse) {
        if (isEnabled) {
            DOM.autoScanPulse.classList.remove('inactive');
        } else {
            DOM.autoScanPulse.classList.add('inactive');
        }
    }

    if (!isEnabled) {
        if (DOM.valNextScanCountdown) DOM.valNextScanCountdown.textContent = 'Pasif';
    } else {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
            chrome.alarms.get('lutheus-sapphire-auto-open', (alarm) => {
                if (alarm) {
                    const diffMs = alarm.scheduledTime - Date.now();
                    if (diffMs > 0) {
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffSecs = Math.floor((diffMs % 60000) / 1000);
                        if (DOM.valNextScanCountdown) {
                            DOM.valNextScanCountdown.textContent = `${diffMins}dk ${diffSecs}sn`;
                        }
                    } else {
                        if (DOM.valNextScanCountdown) DOM.valNextScanCountdown.textContent = 'Taranıyor...';
                    }
                } else {
                    if (DOM.valNextScanCountdown) DOM.valNextScanCountdown.textContent = 'Alarm Yok';
                }
            });
        } else {
            if (DOM.valNextScanCountdown) DOM.valNextScanCountdown.textContent = 'Beklemede';
        }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['autoScanStatus'], (result) => {
            const status = result.autoScanStatus;
            if (status) {
                if (DOM.valLastScanTime) {
                    if (status.lastRunTime && status.lastRunTime !== '-') {
                        const date = new Date(status.lastRunTime);
                        DOM.valLastScanTime.textContent = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        DOM.valLastScanTime.title = date.toLocaleString('tr-TR');
                    } else {
                        DOM.valLastScanTime.textContent = '-';
                    }
                }
                
                if (DOM.valLastScanStatus) {
                    DOM.valLastScanStatus.textContent = 
                        status.lastRunStatus === 'success' ? 'Başarılı' :
                        status.lastRunStatus === 'failed' ? 'Başarısız' :
                        status.lastRunStatus === 'running' ? 'Çalışıyor...' : '-';
                    
                    DOM.valLastScanStatus.className = 'auto-scan-stat-value ' + (
                        status.lastRunStatus === 'success' ? 'success' :
                        status.lastRunStatus === 'failed' ? 'failed' :
                        status.lastRunStatus === 'running' ? 'pending' : ''
                    );
                }

                if (DOM.valNewCasesCount) {
                    DOM.valNewCasesCount.textContent = status.newCasesCount ?? 0;
                }

                if (DOM.autoScanLogs && status.logs && status.logs.length) {
                    DOM.autoScanLogs.innerHTML = status.logs.map(log => `<div class="auto-scan-log-item">${DOM.autoScanPulse ? escapeHtml(log) : log}</div>`).join('');
                }
            }
        });
    }
}

async function triggerAutoScanNow() {
    if (!isPrivilegedRole(state.session?.role)) {
        Toast.warning('Yetki Gerekli', 'Yalnızca yöneticiler bu işlemi başlatabilir.');
        return;
    }
    if (DOM.btnTriggerAutoScanNow) {
        DOM.btnTriggerAutoScanNow.disabled = true;
        DOM.btnTriggerAutoScanNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Çalışıyor...';
    }
    try {
        const response = await sendRuntimeMessage({ action: 'RUN_SAPPHIRE_AUTO_OPEN_TASK' });
        if (response && response.success) {
            Toast.success('Başarılı', `Tarama tamamlandı. ${response.newCasesCount || 0} yeni kayıt alındı.`);
        } else {
            Toast.error('Hata', response?.error || 'Tarama başarısız oldu.');
        }
    } catch (e) {
        Toast.error('Hata', e.message || 'İstek gönderilemedi.');
    } finally {
        if (DOM.btnTriggerAutoScanNow) {
            DOM.btnTriggerAutoScanNow.disabled = false;
            DOM.btnTriggerAutoScanNow.innerHTML = '<i class="fa-solid fa-arrow-rotate-right"></i> Şimdi Tetikle';
        }
        updateAutoScanUIState();
    }
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
    const [cases, registry, rules, roleCache] = await Promise.all([
        Storage.getCases(),
        Storage.getUserRegistry(),
        Storage.getDynamicRules(),
        Storage.getRoleCache()
    ]);
    CUKEngine.setRules(rules);
    const visibleCases = filterCasesByRole(cases);
    const weekly = Storage.calculateWeeklyStats(visibleCases);
    state.currentModeratorStats = computeModeratorStats(visibleCases, registry, roleCache);
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
            <div class="comp-label">Hatali</div>
            <div class="comp-value" style="color: var(--status-invalid);">${validCounts.invalid || 0}</div>
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
        <button class="mod-item interactive" type="button" data-id="${escapeHtml(entry.id)}" data-name="${escapeHtml(entry.name)}">
            <div class="mod-avatar-wrap">
                ${avatarImg(entry.avatar, 'mod-avatar', entry.name)}
            </div>
            <div class="mod-main">
                <div class="mod-top">
                    <span class="mod-rank">#${index + 1}</span>
                    <span class="mod-name">${escapeHtml(entry.name)}</span>
                    <span class="pointtrain-pill">${escapeHtml(entry.role)}</span>
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
        const durationText = entry.duration || (entry.isPermanent ? 'Süresiz' : '—');
        return `
            <article class="${verdictRowClass(validation.status)}">
                <div>
                    <button class="case-inline-link open-case-btn" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">
                        #${escapeHtml(String(entry.id || entry.caseId || '-'))}
                    </button>
                    <div class="pointtrain-meta">
                        <span>${escapeHtml(entry.reason || 'Sebep yok')}</span>
                        <span>${escapeHtml(durationText)}</span>
                        <span>${escapeHtml(entry.type || 'tur yok')}</span>
                        <span>${escapeHtml(entry.createdRaw || '-')}</span>
                    </div>
                    <div class="pointtrain-breakdown">${escapeHtml(validation.reason || 'Degerlendirme yok')}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="${verdictPillClass(validation.status)}">${escapeHtml(verdictLabel(validation.status))}</span>
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
    const [cases, registry, roleCache] = await Promise.all([
        Storage.getCases(),
        Storage.getUserRegistry(),
        Storage.getRoleCache()
    ]);
    const report = {
        exportedAt: new Date().toISOString(),
        cases: cases.length,
        moderators: computeModeratorStats(cases, registry, roleCache)
    };
    downloadFile(`lutheus-rapor-${Date.now()}.json`, JSON.stringify(report, null, 2), 'application/json;charset=utf-8');
    Toast.success('Rapor hazir', 'JSON raporu indirildi');
}

function renderPointtrainRun(run) {
    if (!run) {
        DOM.pointtrainSummary.innerHTML = `
            <div class="comp-card" style="grid-column: span 3;">
                <div class="comp-label">Pointtrain Hazir Degil</div>
                <div class="comp-value" style="font-size: 13px; opacity: 0.6;">Henüz bir tarama yapılmadı</div>
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
    setScanProgress(0, 1, useDetailScan ? 'Detayli Sapphire taramasi baslatiliyor' : 'Hizli Sapphire taramasi baslatiliyor');
    log(useDetailScan ? 'Detayli Sapphire taramasi baslatildi' : 'Hizli Sapphire taramasi baslatildi');

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
        const totalPages = response.scanRun?.totalPages || response.scanRun?.pagesRequested || state.scannedPages || 1;
        const totalCases = response.scanRun?.totalCases || response.cases?.length || 0;
        setScanProgress(state.scannedPages, totalPages, `${state.scannedPages} / ${totalPages} sayfa - ${response.cases?.length || 0} / ${totalCases} ceza`);
        log(`Tarama tamamlandi, ${state.scannedPages}/${totalPages} sayfa, ${response.cases?.length || 0}/${totalCases} ceza, ${response.scanRun?.failures?.length || 0} hata`, 'success');

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

const UNKNOWN_STAFF_NAME_RE = /^(unknown|bilinmiyor|bilinmeyen yetkili|yetkili)$/i;
const cleanupResultsEl = () => document.getElementById('cleanupResults');

function evaluateStaffEntry(key, entry = {}) {
    const rawId = String(
        entry.discordId ||
        entry.sapphireAuthorId ||
        entry.id ||
        (String(key).startsWith('discord:') ? String(key).replace(/^discord:/, '') : '')
    ).trim();
    const hasDiscordId = /^\d{17,20}$/.test(rawId);
    const displayName = String(entry.displayName || entry.name || '').trim();
    const hasName = displayName.length > 0 && !UNKNOWN_STAFF_NAME_RE.test(displayName);

    if (!hasDiscordId && !hasName) {
        return { invalid: true, reason: 'ID ve isim bos' };
    }
    if (!hasDiscordId && (String(key).startsWith('name:') || !hasName)) {
        return { invalid: true, reason: 'Gecerli Discord ID yok' };
    }
    if (hasDiscordId && !hasName) {
        return { invalid: true, reason: 'Gorunen ad bos' };
    }
    return { invalid: false, reason: '' };
}

async function collectInvalidStaffKeys() {
    const registry = (await Storage.getUserRegistry()) || {};
    const directory = (await Storage.getStaffDirectory()) || {};
    const invalid = [];

    for (const [key, entry] of Object.entries(registry)) {
        const verdict = evaluateStaffEntry(key, entry);
        if (verdict.invalid) invalid.push({ source: 'userRegistry', key, reason: verdict.reason });
    }
    for (const [key, entry] of Object.entries(directory)) {
        const verdict = evaluateStaffEntry(key, entry);
        if (verdict.invalid) invalid.push({ source: 'staffDirectory', key, reason: verdict.reason });
    }
    return invalid;
}

function renderCleanupResults(lines) {
    const el = cleanupResultsEl();
    if (!el) return;
    el.innerHTML = lines.length
        ? lines.map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join('')
        : '<div class="log-line">Gecersiz kayit bulunamadi.</div>';
}

async function scanInvalidStaff() {
    const invalid = await collectInvalidStaffKeys();
    renderCleanupResults(
        invalid.length
            ? invalid.map((item) => `[${item.source}] ${item.key} — ${item.reason}`)
            : ['Tum yerel yetkili kayitlari gecerli gorunuyor.']
    );
    Toast.info('Tarama', `${invalid.length} gecersiz kayit`);
}

async function cleanInvalidStaff() {
    if (!confirm('Gecersiz yerel yetkili kayitlari silinecek. Supabase DB etkilenmez. Devam edilsin mi?')) {
        return;
    }
    const invalid = await collectInvalidStaffKeys();
    const registry = (await Storage.getUserRegistry()) || {};
    const directory = (await Storage.getStaffDirectory()) || {};

    for (const item of invalid) {
        if (item.source === 'userRegistry') delete registry[item.key];
        if (item.source === 'staffDirectory') delete directory[item.key];
    }

    await chrome.storage.local.set({ userRegistry: registry, staffDirectory: directory });
    await updateStats();
    renderCleanupResults([`Temizlendi: ${invalid.length} kayit`]);
    Toast.success('Temizlik', `${invalid.length} kayit kaldirildi`);
}

async function resetLocalRegistry() {
    if (!confirm('userRegistry ve staffDirectory sifirlenecek. DB etkilenmez. Emin misiniz?')) {
        return;
    }
    await chrome.storage.local.set({ userRegistry: {}, staffDirectory: {} });
    await updateStats();
    renderCleanupResults(['Local registry sifirlandi.']);
    Toast.success('Sifirlandi', 'Yerel yetkili registry temizlendi');
}

async function resyncStaffFromDb() {
    const stored = await chrome.storage.local.get(['lutheusAuthSession']);
    const token = stored.lutheusAuthSession?.idToken;
    if (!token) {
        Toast.error('Oturum', 'Giris gerekli — DB esitleme yapilamadi');
        return;
    }

    const supabaseUrl = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1/staff_profiles';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';

    try {
        const response = await fetch(
            `${supabaseUrl}?is_active_staff=eq.true&select=discord_id,display_name,avatar_url,staff_rank`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = await response.json();
        const directory = (await Storage.getStaffDirectory()) || {};

        for (const row of rows || []) {
            if (!row.discord_id) continue;
            directory[row.discord_id] = {
                ...(directory[row.discord_id] || {}),
                sapphireAuthorId: row.discord_id,
                discordUserId: row.discord_id,
                displayName: row.display_name || directory[row.discord_id]?.displayName || 'Bilinmiyor',
                avatar: row.avatar_url || directory[row.discord_id]?.avatar || null,
                role: row.staff_rank || directory[row.discord_id]?.role || 'discord_destek_ekibi',
                source: 'supabase-resync',
                updatedAt: new Date().toISOString(),
            };
        }

        await Storage.saveStaffDirectory(directory);
        await updateStats();
        renderCleanupResults([`DB esitleme tamam: ${(rows || []).length} aktif profil.`]);
        Toast.success('Esitleme', `${(rows || []).length} profil yuklendi`);
    } catch (error) {
        Toast.error('Esitleme', error.message || 'DB okunamadi');
    }
}

async function handleDiscordScan() {
    const targetUrl = 'https://discord.com/channels/1223431616081166336/1445462327141863657';
    
    // Check auth session
    const session = await Storage.get('lutheusAuthSession');
    const token = session?.idToken;
    if (!token) {
        Toast.error('Oturum', 'Giris gerekli — Kanit taramasi yapilamadi');
        return;
    }

    Toast.info('Discord', 'Kanit kanali kontrol ediliyor...');

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({}, async (tabs) => {
            const discordTab = tabs.find(t => t.url && t.url.includes('1445462327141863657'));
            
            if (discordTab) {
                chrome.tabs.update(discordTab.id, { active: true }, async (tab) => {
                    if (tab.windowId) {
                        chrome.windows.update(tab.windowId, { focused: true });
                    }
                    
                    Toast.info('Discord', 'Kanitlar taraniyor...');
                    setTimeout(() => {
                        executeScraping(discordTab.id, token);
                    }, 500);
                });
            } else {
                chrome.tabs.create({ url: targetUrl }, (newTab) => {
                    Toast.success('Discord', 'Kanit kanali acildi. Sayfa yuklenince butona tekrar basarak taramayi tetikleyin.');
                });
            }
        });
    } else {
        Toast.error('Eklenti', 'Chrome tabs API bulunamadi.');
    }
}

function executeScraping(tabId, token) {
    if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
        Toast.error('Eklenti', 'chrome.scripting API bulunamadi.');
        return;
    }

    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
            console.log("Lutheus Scraper: executeScraping running inside Discord tab!");
            
            // Discord stable selectors: li elements with id starting with "chat-messages-"
            let messageContainers = document.querySelectorAll('li[id^="chat-messages-"]');
            console.log(`Lutheus Scraper: Found ${messageContainers.length} messages via id selector.`);
            
            if (messageContainers.length === 0) {
                const msgList = document.querySelector('ol[data-list-id="chat-messages"], ol[class*="scrollerInner"]');
                if (msgList) {
                    messageContainers = msgList.querySelectorAll('li');
                    console.log(`Lutheus Scraper: Fallback found ${messageContainers.length} li elements.`);
                }
            }
            
            if (messageContainers.length === 0) {
                messageContainers = document.querySelectorAll('div[class*="message_"], div[class*="messageContent"]');
                console.log(`Lutheus Scraper: Second fallback found ${messageContainers.length} elements.`);
            }

            const proofs = [];
            const seenMessages = new Set();

            messageContainers.forEach(container => {
                const msgId = container.id || '';
                if (msgId && seenMessages.has(msgId)) return;
                if (msgId) seenMessages.add(msgId);

                // Content: Discord puts message text in div[id^="message-content-"]
                const contentEl = container.querySelector('div[id^="message-content-"]') 
                    || container.querySelector('[class*="messageContent"]')
                    || container.querySelector('[class*="markup"]');
                const text = contentEl ? contentEl.textContent.trim() : '';
                if (!text) return;

                console.log(`Lutheus Scraper: Message text: "${text.slice(0, 80)}"`);

                const words = text.split(/[\s,.:;/#_\-()[\]"'@]+/);
                let caseId = null;
                let userId = null;

                for (const word of words) {
                    if (!word) continue;
                    
                    // Discord user ID: 17-20 digit number
                    if (/^\d{17,20}$/.test(word)) {
                        if (!userId) {
                            userId = word;
                            console.log(`Lutheus Scraper: Found Discord userId: ${word}`);
                        }
                    // Numeric caseId: 5-9 digits, NOT a year (exclude 1900-2099 range)
                    } else if (/^\d{5,9}$/.test(word) && !caseId) {
                        const num = parseInt(word, 10);
                        if (num < 1900 || num > 2099) { // yıl değil gerçek case ID
                            caseId = word;
                            console.log(`Lutheus Scraper: Found numeric caseId: ${word}`);
                        } else {
                            console.log(`Lutheus Scraper: Skipping year-like number: ${word}`);
                        }
                    // Alphanumeric case id like "gwm6yH8" — must have both letters and digits
                    } else if (/^[A-Za-z0-9]{4,12}$/.test(word) && /[A-Za-z]/.test(word) && /\d/.test(word) && !caseId) {
                        caseId = word;
                        console.log(`Lutheus Scraper: Found alphanumeric caseId: ${word}`);
                    }
                }

                if (!caseId && !userId) return;

                // ── Görseller: YALNIZCA /attachments/ URL'li görseller ──────────────────
                // Avatar görselleri (/avatars/ URL'li) kasıtlı olarak dışlanıyor
                let proofUrl = '';

                // Önce attachments alanını bul (mesajın medya bölümü)
                const attachmentsWrapper = container.querySelector(
                    '[class*="attachments"], [class*="imageWrapper"], [class*="mediaAttachment"]'
                );
                
                if (attachmentsWrapper) {
                    // Attachment wrapper içindeki img'yi al
                    const attachImg = attachmentsWrapper.querySelector('img[src*="/attachments/"]');
                    if (attachImg) {
                        proofUrl = attachImg.src;
                        console.log(`Lutheus Scraper: Found attachment img: ${proofUrl.slice(0, 80)}`);
                    }
                }
                
                // Attachment img bulunamazsa tüm container'da /attachments/ URL'li img ara
                if (!proofUrl) {
                    const allImgs = container.querySelectorAll('img');
                    for (const img of allImgs) {
                        const src = img.src || '';
                        // /attachments/ varsa ve /avatars/ yoksa kanıt görseli
                        if (src.includes('/attachments/') && !src.includes('/avatars/')) {
                            proofUrl = src;
                            console.log(`Lutheus Scraper: Found attachment img (fallback): ${proofUrl.slice(0, 80)}`);
                            break;
                        }
                    }
                }

                // Direkt attachment linki
                if (!proofUrl) {
                    const linkEl = container.querySelector(
                        'a[href*="cdn.discordapp.com/attachments/"], a[href*="media.discordapp.net/attachments/"]'
                    );
                    if (linkEl) {
                        proofUrl = linkEl.href;
                        console.log(`Lutheus Scraper: Found attachment link: ${proofUrl.slice(0, 80)}`);
                    }
                }

                // Video/gif attachment
                if (!proofUrl) {
                    const videoEl = container.querySelector('video source[src*="/attachments/"]');
                    if (videoEl) {
                        proofUrl = videoEl.src;
                        console.log(`Lutheus Scraper: Found video attachment: ${proofUrl.slice(0, 80)}`);
                    }
                }

                proofs.push({
                    case_id: caseId || null,
                    user_id: userId || null,
                    proof_url: proofUrl || null,
                    raw_text: text || null
                });
            });

            console.log(`Lutheus Scraper: Done. Returning ${proofs.length} extracted proofs.`);
            return proofs;
        }
    }, async (results) => {

        if (chrome.runtime.lastError) {
            Toast.error('Tarama', `DOM Kazima Hatasi: ${chrome.runtime.lastError.message}`);
            return;
        }

        if (!results || !results[0] || !results[0].result || results[0].result.length === 0) {
            Toast.warning('Tarama', 'Kanalda taranacak gecerli kanit mesaji bulunamadi. Lutfen kanit kanalinda oldugunuzdan emin olun.');
            return;
        }

        const scrapedResults = results[0].result;
        Toast.info('Tarama', `${scrapedResults.length} mesaj inceleniyor, veritabani eslemesi yapiliyor...`);

        const supabaseUrl = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1/case_proofs';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';
        
        // ── Çözümle: user_id → case_id ──────────────────────────────
        const rawProofs = [];
        for (const proof of scrapedResults) {
            if (proof.case_id) {
                rawProofs.push({
                    case_id: proof.case_id,
                    proof_url: proof.proof_url,
                    raw_text: proof.raw_text
                });
            } else if (proof.user_id) {
                try {
                    const fetchUrl = `https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1/sapphire_cases?punished_user_discord_id=eq.${proof.user_id}&order=created_at_sapphire.desc&limit=1`;
                    const res = await fetch(fetchUrl, {
                        headers: {
                            apikey: supabaseKey,
                            Authorization: `Bearer ${token}`
                        }
                    });
                    if (res.ok) {
                        const cases = await res.json();
                        if (cases && cases.length > 0) {
                            rawProofs.push({
                                case_id: cases[0].case_id,
                                proof_url: proof.proof_url,
                                raw_text: proof.raw_text
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error resolving user ID ${proof.user_id} to case ID:`, err);
                }
            }
        }

        // ── Dedup: aynı batch'te duplicate satır varsa PostgreSQL CONFLICT hatası verir ──
        // case_id + raw_text kombinasyonuna göre benzersiz kayıtları tut
        const seenKeys = new Set();
        const finalProofs = rawProofs.filter(p => {
            const key = `${p.case_id}||${p.raw_text || ''}||${p.proof_url || ''}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
        console.log(`[Lutheus] Dedup: ${rawProofs.length} → ${finalProofs.length} benzersiz kanit`);

        if (finalProofs.length === 0) {
            Toast.warning('Tarama', 'Taranan mesajlar veritabanindaki hicbir ceza kaydiyla eslesmedi.');
            return;
        }

        Toast.info('Tarama', `${finalProofs.length} kanit eslestirildi, veritabanina kaydediliyor...`);

        try {
            // Her kaydı tek tek gönder — batch upsert'te aynı satırı iki kez güncelleyemez
            let successCount = 0;
            let errorCount = 0;
            for (const proof of finalProofs) {
                try {
                    const response = await fetch(supabaseUrl, {
                        method: 'POST',
                        headers: {
                            apikey: supabaseKey,
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify(proof)
                    });
                    if (response.ok) {
                        successCount++;
                    } else {
                        const errText = await response.text();
                        console.warn(`[Lutheus] Kanit kayit hatasi (case_id=${proof.case_id}):`, errText);
                        errorCount++;
                    }
                } catch (innerErr) {
                    console.error(`[Lutheus] Fetch hatasi:`, innerErr);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                Toast.success('Tarama', `${successCount} kanit basariyla kaydedildi! ${errorCount > 0 ? `(${errorCount} hata)` : '🎉'}`);
            } else {
                Toast.error('Tarama', `Hicbir kanit kaydedilemedi (${errorCount} hata)`);
            }

            // ── Dashboard: varsa focus et (reload etme — profiller sıfırlanıyor), yoksa aç ──
            if (successCount > 0 && typeof chrome !== 'undefined' && chrome.tabs?.query) {
                const adminUrl = chrome.runtime.getURL('src/dashboard-v2/dist/index.html');
                chrome.tabs.query({}, (allTabs) => {
                    // Dashboard URL'si ile eşleşen tab'ı bul (hash farklı olabilir)
                    const dashTab = allTabs.find(t => t.url && t.url.includes('dashboard-v2/dist/index.html'));
                    if (dashTab) {
                        // Sadece focus et — reload etme, profiller kaybolmasın
                        chrome.tabs.update(dashTab.id, { active: true });
                        if (dashTab.windowId) {
                            chrome.windows.update(dashTab.windowId, { focused: true });
                        }
                        console.log('[Lutheus] Dashboard bulundu, focus yapildi (reload yok)');
                    } else {
                        // Dashboard kapalıysa yeni tab aç
                        chrome.tabs.create({ url: adminUrl + '#/cases' });
                        console.log('[Lutheus] Dashboard acildi (yeni tab)');
                    }
                });
            }
        } catch (err) {
            console.error('Error saving scraped proofs:', err);
            Toast.error('Tarama', `Veritabani Kayit Hatasi: ${err.message}`);
        }
    });
}

function bindEvents() {
    DOM.navButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.section) {
                switchSection(button.dataset.section);
            }
        });
    });

    DOM.btnQuickScan?.addEventListener('click', () => switchSection('scan'));
    DOM.languageSelect?.addEventListener('change', (event) => saveLanguage(event.target.value));
    DOM.btnStartScan?.addEventListener('click', runScan);
    DOM.btnStopScan?.addEventListener('click', stopScan);
    DOM.btnDiscordScan?.addEventListener('click', handleDiscordScan);
    DOM.btnToday?.addEventListener('click', () => applyScanPreset('today'));
    DOM.btnLastWeek?.addEventListener('click', () => applyScanPreset('week'));
    DOM.btnLastMonth?.addEventListener('click', () => applyScanPreset('month'));
    DOM.btnAllTime?.addEventListener('click', () => applyScanPreset('all'));
    DOM.btnExport?.addEventListener('click', exportReport);
    DOM.btnOpenAdmin?.addEventListener('click', () => sendRuntimeMessage({ action: ACTIONS.OPEN_ADMIN }));
    document.getElementById('btnOpenDashboardDirect')?.addEventListener('click', () => sendRuntimeMessage({ action: ACTIONS.OPEN_ADMIN }));
    DOM.btnLogout?.addEventListener('click', async () => {
        await AuthService.logout();
        AuthService.redirectToLogin(chrome.runtime.getURL('src/sidepanel/sidepanel.html'));
    });
    DOM.btnBackToStats?.addEventListener('click', exitFocusMode);
    DOM.searchMod?.addEventListener('input', debounce((event) => renderModList(event.target.value), 120));
    DOM.guildId?.addEventListener('change', saveSettings);
    DOM.scanDelay?.addEventListener('change', saveSettings);
    DOM.toggleAutoSave?.addEventListener('change', saveSettings);
    DOM.toggleAutoOpen?.addEventListener('change', saveSettings);
    DOM.toggleAutoOpenWidget?.addEventListener('change', saveSettings);
    DOM.btnTriggerAutoScanNow?.addEventListener('click', triggerAutoScanNow);
    DOM.btnClearCases?.addEventListener('click', clearCases);
    DOM.btnResetAll?.addEventListener('click', resetAll);
    document.getElementById('btnScanInvalidStaff')?.addEventListener('click', scanInvalidStaff);
    document.getElementById('btnCleanInvalidStaff')?.addEventListener('click', cleanInvalidStaff);
    document.getElementById('btnResetLocalRegistry')?.addEventListener('click', resetLocalRegistry);
    document.getElementById('btnResyncStaffFromDb')?.addEventListener('click', resyncStaffFromDb);
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
            Toast.info(text('autoMode'), text('scanAllPages'));
        } else {
            DOM.toggleAutofill.classList.remove('active');
            DOM.toggleAutofill.style.background = '';
            DOM.toggleAutofill.style.color = '';
            DOM.pageInput.placeholder = 'Örn: 5 veya 1-10';
            DOM.pageInput.disabled = false;
            Toast.info(text('autoMode'), text('manualPageInput'));
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === ACTIONS.SCAN_PROGRESS_EVENT) {
            const payload = message.payload || {};
            setScanProgress(
                payload.scannedCount || 0,
                payload.totalPages || 1,
                `Sayfa ${payload.currentPage || '-'} / ${payload.totalPages || '-'} - ${payload.casesFound || 0}${payload.totalCases ? ` / ${payload.totalCases}` : ''} ceza`
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
        if (message.action === 'AUTO_SCAN_STATUS_UPDATED') {
            updateAutoScanUIState();
        }
    });
}

async function init() {
    Toast.init();
    await loadLanguage();

    // Register storage change listener to reload sidepanel when session state updates
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.lutheusAuthSession) {
                window.location.reload();
            }
            if (areaName === 'local' && changes.language) {
                state.language = changes.language.newValue === 'en' ? 'en' : 'tr';
                if (DOM.languageSelect) DOM.languageSelect.value = state.language;
                localStorage.setItem('language', state.language);
            }
        });
    }

    state.session = await AuthService.getSession();
    const appLayout = document.querySelector('.app-layout');
    const sidepanelLoginView = document.getElementById('sidepanel-login-view');
    const btnSidepanelLogin = document.getElementById('btnSidepanelLogin');

    if (!state.session) {
        if (appLayout) appLayout.classList.add('hidden');
        if (sidepanelLoginView) sidepanelLoginView.classList.remove('hidden');

        if (btnSidepanelLogin) {
            btnSidepanelLogin.addEventListener('click', () => {
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/login.html') });
                } else {
                    window.open('/src/auth/login.html', '_blank');
                }
            });
        }
        return;
    }

    if (appLayout) appLayout.classList.remove('hidden');
    if (sidepanelLoginView) sidepanelLoginView.classList.add('hidden');

    setStatus('connected');
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
    setInterval(updateAutoScanUIState, 1000);
    resetScanProgress();
    resetPointtrainProgress();
    switchSection(getVisibleSections(state.session?.role)[0] || 'home');
}

init().catch((error) => {
    console.error(error);
    Toast.error('Baslatma hatasi', error.message || 'Sidepanel yuklenemedi');
});
