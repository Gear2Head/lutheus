import { Storage } from '../lib/storage.js';
import { APP_CONFIG } from '../config/appConfig.js';
import {
    formatTurkishDate,
    formatTurkishDateTime,
    parseDate,
    escapeHtml
} from '../lib/utils.js';
import { CUKEngine, PenaltyStatus } from '../lib/cukEngine.js';
import { buildPointtrainMarkdown, buildPointtrainCsv } from '../lib/pointtrainEngine.js';
import { AuthService } from '../auth/authService.js';
import { FirebaseRepository } from '../lib/firebaseRepository.js';
import {
    DEFAULT_GROQ_LIMITS,
    canAccessAdmin,
    getRoleColor,
    getRoleLabel,
    getRoleLevel,
    normalizeRole
} from '../auth/rolePolicy.js';
import { analyzeCaseWithGroq } from '../lib/aiAnalysisClient.js';
import { bindAvatarFallbacks, resolveAvatar } from '../lib/avatar.js';

const DOM_RAW = {
    totalCases: document.getElementById('st-total'),
    validCases: document.getElementById('st-valid'),
    invalidCases: document.getElementById('st-invalid'),
    pendingCases: document.getElementById('st-pending'),
    modsCount: document.getElementById('st-mods'),
    topModName: document.getElementById('topModName'),
    topModCount: document.getElementById('topModCount'),
    topReasonName: document.getElementById('topReasonName'),
    topReasonCount: document.getElementById('topReasonCount'),
    comparisonGrid: document.getElementById('deltaGrid'),
    deltaNew: document.getElementById('d-new'),
    deltaInv: document.getElementById('d-inv'),
    deltaAcc: document.getElementById('d-acc'),
    deltaMods: document.getElementById('d-mods'),
    navBtns: document.querySelectorAll('.nav-item'),
    pages: document.querySelectorAll('.page-section'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    dashboardView: document.getElementById('page-dashboard'),
    managementView: document.getElementById('page-management'),
    rulesView: document.getElementById('page-cuk'),
    pointtrainView: document.getElementById('page-pointtrain'),
    authView: document.getElementById('page-auth'),
    adminProfileAvatar: document.getElementById('userAvatar'),
    adminProfileName: document.getElementById('userName'),
    adminProfileRole: document.getElementById('userRole'),
    modTableBody: document.getElementById('modTableBody'),
    tableSearch: document.getElementById('tableSearch'),
    dateFilter: document.getElementById('dateFilter'),
    reasonList: document.getElementById('reasonList'),
    mgmtModList: document.getElementById('mgmtModList'),
    mgmtCaseList: document.getElementById('mgmtCaseList'),
    cukSearch: document.getElementById('cukSearch'),
    caseSearch: document.getElementById('caseSearch'),
    casePeriodFilter: document.getElementById('casePeriodFilter'),
    caseSortFilter: document.getElementById('caseSortFilter'),
    refreshBtn: document.getElementById('btnRefresh'),
    exportBtn: document.getElementById('btnExport'),
    copyDiscordBtn: document.getElementById('btnCopyDiscord'),
    revalidateBtn: document.getElementById('btnRevalidate'),
    lastScanTime: document.getElementById('lastScanTime'),
    detailModal: document.getElementById('detailModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal'),
    roleModal: document.getElementById('roleModal'),
    closeRoleModal: document.getElementById('closeRoleModal'),
    saveRoleBtn: document.getElementById('saveRoleBtn'),
    roleUserId: document.getElementById('roleUserId'),
    roleDisplayName: document.getElementById('roleDisplayName'),
    roleSelect: document.getElementById('roleSelect'),
    manualAccuracy: document.getElementById('manualAccuracy'),
    roleUserNameHint: document.getElementById('roleUserNameHint'),
    roleBtn: document.getElementById('roleBtn'),
    lookupUserBtn: document.getElementById('lookupUserBtn'),
    noRuleSelected: document.getElementById('cukEmptyState'),
    ruleCategoriesList: document.getElementById('cukCategoryList'),
    ruleEditorContent: document.getElementById('cukEditorContent'),
    btnAddCategory: document.getElementById('btnAddCategory'),
    editCategoryName: document.getElementById('cukCatName'),
    repeatsList: document.getElementById('repeatStepsList'),
    btnAddStep: document.getElementById('btnAddStep'),
    categoryKeywords: document.getElementById('keywordInput'),
    btnDeleteCategory: document.getElementById('btnDeleteCategory'),
    btnCukSave: document.getElementById('btnCukSave'),
    btnDuplicateCategory: document.getElementById('btnDuplicateCategory'),
    btnSaveCategoryInline: document.getElementById('btnSaveCategoryInline'),
    btnBackToDashboard: document.getElementById('btnBackToDashboard'),
    stepsTimeline: document.getElementById('stepsTimeline'),
    keywordTagsArea: document.getElementById('keywordTagsArea'),
    autoInvalidTagsArea: document.getElementById('autoInvalidTagsArea'),
    autoInvalidInput: document.getElementById('autoInvalidInput'),
    globalInvalidArea: document.getElementById('globalInvalidArea'),
    globalInvalidInput: document.getElementById('globalInvalidInput'),
    pointtrainRefreshBtn: document.getElementById('pointtrainRefreshBtn'),
    pointtrainCopyBtn: document.getElementById('pointtrainCopyBtn'),
    pointtrainExportBtn: document.getElementById('pointtrainExportBtn'),
    pointtrainAdminSummary: document.getElementById('pointtrainAdminSummary'),
    pointtrainTableBody: document.getElementById('pointtrainTableBody'),
    allowEmail: document.getElementById('allowEmail'),
    allowRole: document.getElementById('allowRole'),
    saveAllowBtn: document.getElementById('saveAllowBtn'),
    allowlistTableBody: document.getElementById('allowlistTableBody'),
    roleCacheIdentity: document.getElementById('roleCacheIdentity'),
    roleCacheName: document.getElementById('roleCacheName'),
    roleCacheRole: document.getElementById('roleCacheRole'),
    saveRoleCacheBtn: document.getElementById('saveRoleCacheBtn'),
    roleCacheTableBody: document.getElementById('roleCacheTableBody'),
    groqLimitGrid: document.getElementById('groqLimitGrid'),
    saveGroqPolicyBtn: document.getElementById('saveGroqPolicyBtn'),
    refreshAuditBtn: document.getElementById('refreshAuditBtn'),
    auditList: document.getElementById('auditList'),
    roleUserPreview: document.getElementById('roleUserPreview'),
    roleUserPreviewAvatar: document.getElementById('roleUserPreviewAvatar'),
    roleUserPreviewName: document.getElementById('roleUserPreviewName'),
    roleUserPreviewId: document.getElementById('roleUserPreviewId'),
    simReasonInput: document.getElementById('simReasonInput'),
    simRepeatInput: document.getElementById('simRepeatInput'),
    simTypeInput: document.getElementById('simTypeInput'),
    btnRunSimulation: document.getElementById('btnRunSimulation'),
    simResultPanel: document.getElementById('simResultPanel'),
    simStatusBadge: document.getElementById('simStatusBadge'),
    simResultCategory: document.getElementById('simResultCategory'),
    simResultPunishment: document.getElementById('simResultPunishment'),
    simResultAccuracy: document.getElementById('simResultAccuracy'),
    simResultDetails: document.getElementById('simResultDetails'),
    botLogChannelId: document.getElementById('botLogChannelId'),
    btnSaveBotConfig: document.getElementById('btnSaveBotConfig'),
    btnSyncProfiles: document.getElementById('btnSyncProfiles'),
    btnTestBotLog: document.getElementById('btnTestBotLog'),
    profileView: document.getElementById('page-profile'),
    profileSearchInput: document.getElementById('profileSearchInput'),
    profileStaffList: document.getElementById('profileStaffList'),
    profileEmptyState: document.getElementById('profileEmptyState'),
    profileDetailContent: document.getElementById('profileDetailContent'),
    profHeaderCard: document.getElementById('profHeaderCard'),
    profAvatarGlow: document.getElementById('profAvatarGlow'),
    profAvatar: document.getElementById('profAvatar'),
    profName: document.getElementById('profName'),
    profRoleBadge: document.getElementById('profRoleBadge'),
    profDiscordId: document.getElementById('profDiscordId'),
    profJoinDateContainer: document.getElementById('profJoinDateContainer'),
    profJoinDate: document.getElementById('profJoinDate'),
    profStatTotal: document.getElementById('profStatTotal'),
    profStatAccuracy: document.getElementById('profStatAccuracy'),
    profStatInvalid: document.getElementById('profStatInvalid'),
    profStatPtScore: document.getElementById('profStatPtScore'),
    profWarnDots: document.getElementById('profWarnDots'),
    profWarnLimitLabel: document.getElementById('profWarnLimitLabel'),
    profIkazDots: document.getElementById('profIkazDots'),
    profAdminForm: document.getElementById('profAdminForm'),
    profFormJoinDate: document.getElementById('profFormJoinDate'),
    profFormNotes: document.getElementById('profFormNotes'),
    profFormWarns: document.getElementById('profFormWarns'),
    profFormIkaz: document.getElementById('profFormIkaz'),
    btnSaveProfileDetails: document.getElementById('btnSaveProfileDetails'),
    toastStack: document.getElementById('toastStack')
};

const DOM = new Proxy(DOM_RAW, {
    get(target, prop) {
        const el = target[prop];
        if (!el && prop !== 'navBtns' && prop !== 'pages') {
            return {
                textContent: '', innerHTML: '', value: '', dataset: {}, style: {},
                classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
                querySelectorAll: () => [], appendChild: () => {}, addEventListener: () => {},
                querySelector: () => null, insertBefore: () => {}, removeAttribute: () => {}, setAttribute: () => {}
            };
        }
        return el;
    }
});

const state = {
    session: null,
    activeTab: 'dashboard',
    selectedRuleCategory: '',
    allCases: [],
    userRegistry: {},
    staffDirectory: {},
    roleCache: [],
    dynamicRules: { categories: {}, autoInvalid: { keywords: [] } },
    latestPointtrainRun: null
};

const Toast = {
    container: null,

    init() {
        this.container = DOM.toastStack;
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

async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

function getRankLevel(role) {
    return getRoleLevel(role);
}

function getValidation(entry) {
    return CUKEngine.validate(entry);
}

function avatarImg(url, className, alt) {
    return `<img src="${escapeHtml(resolveAvatar(url))}" class="${className}" alt="${escapeHtml(alt || 'Avatar')}" data-avatar-img>`;
}

function extractSnowflake(value) {
    return String(value || '').match(/\d{17,20}/)?.[0] || '';
}

function isValidDiscordId(value) {
    return /^\d{17,20}$/.test(String(value || '').trim());
}

function isManagementRole(role) {
    return getRoleLevel(role) >= 68;
}

function isGenericProfileName(name) {
    if (!name) return true;
    const lower = String(name).toLowerCase().trim();
    return lower === 'discord desteg ekibi' || lower === 'discord destek ekibi'
        || lower === 'discord moderator' || lower === 'discord moderatoru'
        || lower === 'discord yoneticisi' || lower === 'genel sorumlu'
        || lower === 'yonetici' || lower === 'bilinmeyen yetkili'
        || lower === 'bilinmiyor' || lower === 'unknown'
        || lower === 'kidemli' || lower === 'kidemli_discord_moderatoru'
        || lower === 'kidemli discord moderatoru';
}

function isDisplayableStaffEntry(entry, { requireCases = false } = {}) {
    if (!entry || !isValidDiscordId(entry.id)) return false;
    const role = normalizeRole(entry.role);
    if (['viewer', 'pending', 'blocked'].includes(role)) return false;
    if (requireCases && !Number(entry.count || 0)) return false;
    return !(isGenericProfileName(entry.name) && !Number(entry.count || 0));
}

function cleanReason(value) {
    const text = String(value || '').trim();
    if (!text || /^\d{4,20}$/.test(text)) return 'Bilinmiyor';
    return text;
}

function getPunishmentDistribution(cases = []) {
    const counts = { mute: 0, ban: 0, warn: 0, other: 0 };
    cases.forEach((entry) => {
        const type = String(entry.type || '').toLowerCase();
        if (/mute|timeout/.test(type)) counts.mute += 1;
        else if (/ban/.test(type)) counts.ban += 1;
        else if (/warn|uyar/.test(type)) counts.warn += 1;
        else counts.other += 1;
    });
    const total = cases.length || 1;
    return {
        counts,
        percentages: {
            mute: Math.round((counts.mute / total) * 100),
            ban: Math.round((counts.ban / total) * 100),
            warn: Math.round((counts.warn / total) * 100),
            other: Math.round((counts.other / total) * 100)
        }
    };
}

function cleanStaffName(value, id = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let text = raw.replace(/\s+/g, ' ');
    if (id) text = text.replaceAll(id, '').trim();
    text = text.replace(/\d{17,20}/g, '').replace(/[-_]{2,}/g, '-').trim();
    return text || raw;
}

function findProfileByName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    const pools = [
        ...Object.values(state.userRegistry || {}),
        ...Object.values(state.staffDirectory || {}),
        ...(state.roleCache || [])
    ];
    return pools.find((entry) => {
        const names = [
            entry.name,
            entry.displayName,
            entry.username,
            ...(entry.aliases || [])
        ].filter(Boolean).map((item) => String(item).trim().toLowerCase());
        return names.includes(normalized);
    }) || null;
}

function resolveStaffProfile(source = {}) {
    const isCase = Boolean(source.caseId || source.reason || source.authorName);
    const rawId = source.authorId || (!isCase ? source.id : '') || source.discordUserId || source.sapphireAuthorId || source.discordId || '';
    const rawName = source.authorName || (!isCase ? source.name : '') || source.displayName || source.username || '';
    const embeddedId = extractSnowflake(rawId) || extractSnowflake(rawName);
    let id = embeddedId || String(rawId || '').trim();
    if (id && !/^\d{17,20}$/.test(id)) {
        id = '';
    }
    const directoryEntry = id ? (state.staffDirectory[id] || {}) : (state.staffDirectory[`name:${rawName}`] || {});
    const registryEntry = id ? (state.userRegistry[id] || {}) : {};
    const roleEntry = (state.roleCache || []).find((entry) => {
        const cacheId = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        return id ? cacheId === id : (rawName && String(entry.displayName || entry.name || '').toLowerCase() === rawName.toLowerCase());
    }) || {};
    const nameEntry = findProfileByName(cleanStaffName(rawName, id)) || {};

    const mergeProfile = (...objects) => {
        const result = {};
        objects.forEach(obj => {
            if (!obj) return;
            Object.keys(obj).forEach(key => {
                if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
                    result[key] = obj[key];
                }
            });
        });
        return result;
    };
    const profile = mergeProfile(nameEntry, directoryEntry, registryEntry, roleEntry);

    const scrapedName = cleanStaffName(rawName, id);
    let displayName = profile.displayName || profile.name;
    if (scrapedName && (!displayName || isGenericProfileName(displayName))) {
        displayName = scrapedName;
    }
    if (!displayName) {
        displayName = id ? `Yetkili ${id.slice(-4)}` : 'Bilinmeyen Yetkili';
    }

    let caseAvatar = null;
    if (id && state.allCases) {
        const matchingCase = state.allCases.find(c =>
            (c.authorId && String(c.authorId) === id) && c.authorAvatar
        );
        if (matchingCase) caseAvatar = matchingCase.authorAvatar;
    }

    return {
        id: id || profile.discordId || profile.discordUserId || profile.sapphireAuthorId || '',
        name: displayName,
        avatar: resolveAvatar(profile.avatar || caseAvatar || source.authorAvatar || source.avatar),
        role: normalizeRole(profile.role || source.role || 'moderator'),
        missing: !id && !displayName
    };
}

function staffIdentityHtml(profile, { compact = false } = {}) {
    const id = profile.id || '';
    return `
        <button class="staff-identity ${compact ? 'compact' : ''}" type="button" data-copy-id="${escapeHtml(id)}" title="${id ? 'Yetkili ID kopyala' : 'Yetkili ID yok'}">
            ${avatarImg(profile.avatar, 'staff-avatar', profile.name)}
            <span class="staff-copy">
                <strong>${escapeHtml(profile.name || 'Bilinmeyen Yetkili')}</strong>
                <small>${escapeHtml(id || 'ID yok')}</small>
            </span>
        </button>
    `;
}

function bindStaffCopyHandlers(root = document) {
    root.querySelectorAll('.staff-identity[data-copy-id]').forEach((button) => {
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.addEventListener('click', async () => {
            const id = button.dataset.copyId;
            if (!id) {
                Toast.warning('Yetkili', 'Kopyalanacak ID yok');
                return;
            }
            await copyText(id);
            Toast.success('Yetkili ID kopyalandı', id);
        });
    });
}

function roleBadge(role) {
    const normalized = normalizeRole(role);
    return `<span class="role-chip" style="--role-color:${escapeHtml(getRoleColor(normalized))}">${escapeHtml(getRoleLabel(normalized))}</span>`;
}

function sapphireCaseUrl(entry) {
    return entry.sourceUrl || `https://dashboard.sapph.xyz/${entry.guildId || '1223431616081166336'}/moderation/cases/${entry.id || entry.caseId}`;
}

function openCaseUrl(entry) {
    const url = sapphireCaseUrl(entry);
    if (url) window.open(url, '_blank', 'noopener');
}

function caseTimestamp(entry = {}) {
    return parseDate(entry.createdRaw)?.getTime()
        || parseDate(entry.createdAt)?.getTime()
        || Number(entry.scrapedAt || entry.lastSeen || 0);
}

function isCaseInPeriod(entry, period) {
    if (period === 'all') return true;
    const ts = caseTimestamp(entry);
    if (!ts) return true;
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (period === 'today') return ts >= startToday;
    if (period === 'week') return ts >= Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (period === 'month') return ts >= Date.now() - (30 * 24 * 60 * 60 * 1000);
    return true;
}

function compareCasesForAdmin(left, right, sort) {
    if (sort === 'oldest') return caseTimestamp(left) - caseTimestamp(right);
    if (sort === 'status') return String(getValidation(left).status).localeCompare(String(getValidation(right).status), 'tr');
    if (sort === 'staff') return resolveStaffProfile(left).name.localeCompare(resolveStaffProfile(right).name, 'tr');
    return caseTimestamp(right) - caseTimestamp(left);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    DOM.navBtns?.forEach((button) => {
        button.classList.toggle('active', button.dataset.page === tabId);
    });

    [
        ['dashboard', DOM.dashboardView],
        ['management', DOM.managementView],
        ['cuk', DOM.rulesView],
        ['pointtrain', DOM.pointtrainView],
        ['auth', DOM.authView],
        ['profile', DOM.profileView]
    ].forEach(([id, view]) => {
        if (!view) return;
        view.classList.toggle('hidden', tabId !== id);
        view.classList.toggle('active', tabId === id);
    });

    const subtitles = {
        dashboard: 'admin :: dashboard',
        management: 'admin :: yönetim',
        cuk: 'admin :: cuk rule editor',
        pointtrain: 'admin :: pointtrain',
        auth: 'admin :: erişim yönetimi',
        profile: 'admin :: yetkili profilleri'
    };
    if (DOM.pageSubtitle) DOM.pageSubtitle.textContent = subtitles[tabId] || subtitles.dashboard;
    if (tabId === 'auth') loadAuthAdminData();
    if (tabId === 'profile') renderProfilePage();
}

function renderAuthTables({ allowlist = [], roleCache = [], policy = {}, audit = [] } = {}) {
    DOM.allowlistTableBody.innerHTML = allowlist.length
        ? allowlist.map((entry) => `
            <tr class="data-row auth-card-row">
                <td>${escapeHtml(entry.email || entry.id || '-')}</td>
                <td>${roleBadge(entry.role || '-')}</td>
                <td>${entry.allowed === false ? 'Kapali' : 'Aktif'}</td>
                <td>
                    <button class="btn btn-ghost btn-icon btn-del-allow" data-email="${escapeHtml(entry.email || entry.id)}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty-cell">Allowlist kaydi yok</td></tr>';

    DOM.roleCacheTableBody.innerHTML = roleCache.length
        ? roleCache.map((entry) => `
            <tr class="data-row auth-card-row">
                <td>${escapeHtml(entry.identityKey || entry.id || '-')}</td>
                <td>${escapeHtml(entry.displayName || '-')}</td>
                <td>${roleBadge(entry.role || '-')}</td>
                <td>
                    <button class="btn btn-ghost btn-icon btn-del-cache" data-key="${escapeHtml(entry.identityKey || entry.id)}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty-cell">Role cache kaydi yok</td></tr>';

    DOM.allowlistTableBody.querySelectorAll('.btn-del-allow').forEach(btn => {
        btn.addEventListener('click', () => deleteAllowlist(btn.dataset.email));
    });
    DOM.roleCacheTableBody.querySelectorAll('.btn-del-cache').forEach(btn => {
        btn.addEventListener('click', () => deleteRoleCache(btn.dataset.key));
    });

    if (DOM.botLogChannelId && policy.discordBot) {
        DOM.botLogChannelId.value = policy.discordBot.logChannelId || '';
    }

    const limits = { ...DEFAULT_GROQ_LIMITS, ...(policy.groqLimits || {}) };
    DOM.groqLimitGrid.innerHTML = Object.keys(DEFAULT_GROQ_LIMITS).map((role) => `
        <label class="role-limit-item">
            <span>${escapeHtml(getRoleLabel(role))}</span>
            <input type="number" min="0" step="1" data-role="${escapeHtml(role)}" value="${Number(limits[role] || 0)}">
        </label>
    `).join('');

    DOM.auditList.innerHTML = audit.length
        ? audit.map((entry) => `
            <article class="audit-item">
                <strong>${escapeHtml(entry.action || '-')}</strong>
                <small>${escapeHtml(formatTurkishDateTime(entry.createdAt))} - ${escapeHtml(entry.actorUid || 'system')}</small>
            </article>
        `).join('')
        : '<div class="audit-item"><strong>Audit log yok</strong><small>Henüz kayıt oluşmadı</small></div>';
}

async function loadAuthAdminData() {
    const [allowlist, roleCache, policy, audit] = await Promise.all([
        FirebaseRepository.listGoogleAllowlist().catch(() => []),
        FirebaseRepository.listRoleCache().catch(() => []),
        FirebaseRepository.ensureRolePolicy(state.session?.profile).catch(() => FirebaseRepository.getRolePolicy().catch(() => null)),
        FirebaseRepository.listAuditLogs().catch(() => [])
    ]);
    state.roleCache = roleCache;
    renderAuthTables({ allowlist, roleCache, policy: policy || {}, audit });
}

async function saveAllowlist() {
    const email = DOM.allowEmail.value.trim().toLowerCase();
    if (!email) {
        Toast.warning('Allowlist', 'Email gerekli');
        return;
    }
    await FirebaseRepository.setGoogleAllowlist(email, {
        role: DOM.allowRole.value,
        allowed: true
    }, state.session?.profile);
    DOM.allowEmail.value = '';
    await loadAuthAdminData();
    Toast.success('Allowlist', 'Google erisimi kaydedildi');
}

async function saveRoleCache() {
    const raw = DOM.roleCacheIdentity.value.trim();
    if (!raw) {
        Toast.warning('Role cache', 'Discord ID veya identity key gerekli');
        return;
    }
    const identityKey = raw.includes(':') ? raw : `discord:${raw}`;
    await FirebaseRepository.setRoleCache(identityKey, {
        discordId: identityKey.startsWith('discord:') ? identityKey.replace('discord:', '') : '',
        displayName: DOM.roleCacheName.value.trim() || identityKey,
        role: DOM.roleCacheRole.value
    }, state.session?.profile);
    DOM.roleCacheIdentity.value = '';
    DOM.roleCacheName.value = '';
    await loadAuthAdminData();
    Toast.success('Role cache', 'Rol kaydi guncellendi');
}

async function saveGroqPolicy() {
    const groqLimits = {};
    DOM.groqLimitGrid.querySelectorAll('input[data-role]').forEach((input) => {
        groqLimits[input.dataset.role] = Number(input.value || 0);
    });
    const current = await FirebaseRepository.getRolePolicy().catch(() => ({}));
    await FirebaseRepository.saveRolePolicy({
        ...(current || {}),
        groqLimits
    }, state.session?.profile);
    await loadAuthAdminData();
    Toast.success('Groq', 'Rol bazli limitler kaydedildi');
}

async function deleteAllowlist(email) {
    if (!confirm(`${email} allowlist'ten silinecek. Emin misiniz?`)) return;
    await FirebaseRepository.deleteGoogleAllowlist(email, state.session?.profile);
    await loadAuthAdminData();
    Toast.success('Allowlist', 'Erisim silindi');
}

async function deleteRoleCache(identityKey) {
    if (!confirm(`${identityKey} cache'den silinecek. Emin misiniz?`)) return;
    await FirebaseRepository.deleteRoleCache(identityKey, state.session?.profile);
    await loadAuthAdminData();
    Toast.success('Role cache', 'Rol kaydi silindi');
}

function calculateStats() {
    const filterType = DOM.dateFilter?.value || 'all';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    const filteredCases = state.allCases.filter(c => {
        if (filterType === 'all') return true;
        const ts = parseDate(c.createdRaw)?.getTime() || c.scrapedAt || 0;
        if (filterType === 'today') return ts >= startOfToday;
        if (filterType === 'week') return ts >= startOfWeek;
        if (filterType === 'month') return ts >= startOfMonth;
        return true;
    });

    const moderatorMap = new Map();
    const reasonMap = new Map();
    const unresolved = [];

    filteredCases.forEach((entry) => {
        const profile = resolveStaffProfile(entry);
        const validation = getValidation(entry);
        const reason = cleanReason(entry.reason);

        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);

        if (!isValidDiscordId(profile.id)) {
            unresolved.push({
                caseId: entry.id || entry.caseId || '',
                reason,
                rawAuthor: entry.authorName || entry.authorId || ''
            });
            return;
        }

        if (!moderatorMap.has(profile.id)) {
            moderatorMap.set(profile.id, {
                id: profile.id,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar,
                count: 0,
                valid: 0,
                invalid: 0,
                pending: 0
            });
        }

        const bucket = moderatorMap.get(profile.id);
        bucket.count += 1;
        if (validation.status === PenaltyStatus.VALID) bucket.valid += 1;
        if (validation.status === PenaltyStatus.INVALID) bucket.invalid += 1;
        if (validation.status === PenaltyStatus.PENDING || validation.status === PenaltyStatus.UNKNOWN) bucket.pending += 1;
    });

    const ranked = Array.from(moderatorMap.values())
        .map((entry) => ({
            ...entry,
            performance: CUKEngine.calculatePerformanceScore({
                valid: entry.valid,
                invalid: entry.invalid,
                pending: entry.pending
            })
        }))
        .filter((entry) => isDisplayableStaffEntry(entry, { requireCases: true }))
        .sort((left, right) => right.count - left.count);

    const management = ranked.filter((entry) => isManagementRole(entry.role));
    const staff = ranked.filter((entry) => !isManagementRole(entry.role));
    const reasons = Array.from(reasonMap.entries()).sort((left, right) => right[1] - left[1]);

    return {
        staff,
        management,
        unresolved,
        reasons,
        topMod: staff[0] || null,
        topReason: reasons[0] || null,
        filteredCases
    };
}

function updateSidebarBadges({ staffCount = 0, unresolvedCount = 0 } = {}) {
    const setBadge = (page, value, label) => {
        const button = Array.from(DOM.navBtns || []).find((item) => item.dataset.page === page);
        if (!button) return;
        let badge = button.querySelector('.nav-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-count';
            button.appendChild(badge);
        }
        badge.textContent = String(value);
        badge.title = label;
        badge.classList.toggle('warning', unresolvedCount > 0 && page === 'management');
    };
    setBadge('dashboard', staffCount, 'Aktif yetkili');
    setBadge('management', unresolvedCount, 'Cozumlenmemis ceza kaydi');
    setBadge('profile', staffCount, 'Profil sayisi');
}

function renderStats() {
    const { staff, management, topMod, topReason, reasons, filteredCases, unresolved } = calculateStats();

    // Core numbers
    if (DOM.totalCases) DOM.totalCases.textContent = String(filteredCases.length);

    const validCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.VALID).length;
    const invalidCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.INVALID).length;
    const pendingCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.PENDING).length;

    if (DOM.validCases) DOM.validCases.textContent = String(validCount);
    if (DOM.invalidCases) DOM.invalidCases.textContent = String(invalidCount);
    if (DOM.pendingCases) DOM.pendingCases.textContent = String(pendingCount);
    if (DOM.modsCount) {
        DOM.modsCount.innerHTML = `
            <span class="stat-split">Yonetim: ${management.length}</span>
            <span class="stat-split">Yetkili: ${staff.length}</span>
        `;
    }

    if (DOM.topModName) DOM.topModName.textContent = topMod?.name || '-';
    if (DOM.topModCount) DOM.topModCount.textContent = `${topMod?.count || 0} islem`;
    if (DOM.topReasonName) DOM.topReasonName.textContent = topReason?.[0] || '-';
    if (DOM.topReasonCount) DOM.topReasonCount.textContent = `${topReason?.[1] || 0} kez`;

    if (DOM.reasonList) {
        const maxC = reasons[0]?.[1] || 1;
        DOM.reasonList.innerHTML = reasons.slice(0, 12).map(([name, count]) => `
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                  <span style="color:var(--text-2);">${escapeHtml(name)}</span>
                  <span style="color:var(--text-3);font-family:var(--font-mono);">${count}</span>
                </div>
                <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                  <div style="width:${Math.round(count/maxC*100)}%;height:100%;background:var(--purple-hi);border-radius:2px;"></div>
                </div>
              </div>
            </div>
        `).join('');
    }

    if (DOM.deltaNew) DOM.deltaNew.textContent = `+${filteredCases.length}`;
    if (DOM.deltaMods) DOM.deltaMods.textContent = `Y:${management.length} / S:${staff.length}`;
    const efficiency = filteredCases.length ? Math.round((validCount / filteredCases.length) * 100) : 0;
    if (DOM.deltaAcc) DOM.deltaAcc.textContent = `${efficiency}%`;
    if (DOM.deltaInv) DOM.deltaInv.textContent = String(invalidCount);
    updateSidebarBadges({ staffCount: staff.length, unresolvedCount: unresolved.length });
}

function renderModRow(entry, index) {
    const acc = entry.performance?.validPercent || 0;
    const color = acc >= 90 ? 'var(--emerald)' : acc >= 80 ? 'var(--amber)' : 'var(--red)';
    return `
        <tr class="data-row">
            <td style="color:var(--text-3);font-family:var(--font-mono);font-size:12px;">${index + 1}</td>
            <td>${staffIdentityHtml(entry)}</td>
            <td><span class="role-chip ${escapeHtml(entry.role)}">${escapeHtml(getRoleLabel(entry.role))}</span></td>
            <td style="font-family:var(--font-mono);">${entry.count}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                        <div style="width:${acc}%;height:100%;background:${color};border-radius:2px;"></div>
                    </div>
                    <span style="font-size:12px;color:var(--text-2);font-family:var(--font-mono);width:36px;">${acc}%</span>
                </div>
            </td>
            <td>
                <button class="btn btn-ghost btn-icon btn-view" type="button" data-id="${escapeHtml(entry.id)}" data-name="${escapeHtml(entry.name)}" style="width:28px;height:28px;font-size:11px;">
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </td>
        </tr>
    `;
}

function renderManagementRosterRow(entry) {
    return `
        <tr class="data-row management-row">
            <td style="color:var(--text-3);font-family:var(--font-mono);font-size:12px;">-</td>
            <td>${staffIdentityHtml(entry)}</td>
            <td><span class="role-chip ${escapeHtml(entry.role)}">${escapeHtml(getRoleLabel(entry.role))}</span></td>
            <td colspan="3" class="management-note">Yonetim kadrosu performans siralamasina dahil edilmez</td>
        </tr>
    `;
}

function renderTable(search = '') {
    try {
        const query = (search || '').trim().toLowerCase();
        const { staff, management } = calculateStats();
        const filter = (entry) => !query
            || (entry?.name && String(entry.name).toLowerCase().includes(query))
            || (entry?.role && String(entry.role).toLowerCase().includes(query));
        const filteredManagement = management.filter(filter);
        const filteredStaff = staff.filter(filter);

        if (DOM.modTableBody) {
            const rows = [];
            if (filteredManagement.length) {
                rows.push('<tr class="table-section-row"><td colspan="6">Yonetim Kadrosu</td></tr>');
                rows.push(...filteredManagement.map((entry) => renderManagementRosterRow(entry)));
            }
            rows.push('<tr class="table-section-row"><td colspan="6">Haftalik Yetkili Performansi</td></tr>');
            rows.push(...filteredStaff.map((entry, index) => renderModRow(entry, index)));
            if (!filteredStaff.length && !filteredManagement.length) {
                rows.push('<tr><td colspan="6" style="text-align:center; padding:20px;">Kayit bulunamadi</td></tr>');
            } else if (!filteredStaff.length) {
                rows.push('<tr><td colspan="6" style="text-align:center; padding:20px;">Yetkili performans kaydi yok</td></tr>');
            }
            DOM.modTableBody.innerHTML = rows.join('');
        }
    } catch (error) {
        console.error("renderTable error:", error);
    }

    document.querySelectorAll('.btn-view').forEach((button) => {
        button.addEventListener('click', () => openModal({ id: button.dataset.id, name: button.dataset.name }));
    });
    bindStaffCopyHandlers();
    bindAvatarFallbacks();
}

function renderManagement() {
    const merged = new Map();
    Object.values(state.staffDirectory || {}).forEach((entry) => {
        const id = entry.discordUserId || entry.sapphireAuthorId || entry.id;
        if (!id) return;
        merged.set(id, {
            id,
            name: entry.displayName || entry.name || 'Bilinmiyor',
            avatar: entry.avatar || null,
            role: entry.role ? normalizeRole(entry.role) : null,
            aliases: entry.aliases || [],
            source: entry.source || 'staffDirectory'
        });
    });
    Object.values(state.userRegistry || {}).forEach((entry) => {
        if (!entry.id) return;
        merged.set(entry.id, {
            ...(merged.get(entry.id) || {}),
            ...entry,
            name: entry.name || merged.get(entry.id)?.name || 'Bilinmiyor',
            role: entry.role ? normalizeRole(entry.role) : (merged.get(entry.id)?.role || null)
        });
    });
    (state.roleCache || []).forEach((entry) => {
        const id = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        if (!id) return;
        merged.set(id, {
            ...(merged.get(id) || {}),
            id,
            name: entry.displayName || merged.get(id)?.name || id,
            role: entry.role ? normalizeRole(entry.role) : (merged.get(id)?.role || null)
        });
    });

    const knownCaseIds = new Set(state.allCases.map((entry) => resolveStaffProfile(entry).id).filter(isValidDiscordId));
    const moderators = Array.from(merged.values())
        .map((entry) => {
            const profile = resolveStaffProfile(entry);
            return {
                ...entry,
                ...profile,
                count: knownCaseIds.has(profile.id) ? 1 : 0
            };
        })
        .filter((entry) => isDisplayableStaffEntry(entry))
        .sort((left, right) => getRankLevel(right.role) - getRankLevel(left.role) || String(left.name).localeCompare(String(right.name), 'tr'));

    DOM.mgmtModList.innerHTML = moderators.length ? moderators.map((entry) => {
        const profile = entry;
        const role = profile.role || entry.role || 'moderator';
        const roleColor = getRoleColor(role);
        const roleLabel = getRoleLabel(role);
        const id = profile.id || entry.id || '';
        return `
        <div class="mod-card animate-in" style="--role-color: ${escapeHtml(roleColor)}">
            <div class="mod-card-left">
                <button class="staff-identity" type="button" data-copy-id="${escapeHtml(id)}" title="${id ? 'Yetkili ID kopyala' : 'Yetkili ID yok'}">
                    <div class="mod-avatar-wrapper" style="border-color: ${escapeHtml(roleColor)}">
                        ${avatarImg(profile.avatar, 'staff-avatar', profile.name)}
                    </div>
                    <div class="mod-info">
                        <span class="mod-name">${escapeHtml(profile.name)}</span>
                        ${id ? `<span class="mod-id">Discord ID: ${escapeHtml(id)}</span>` : ''}
                        <span class="mod-role-badge" style="color: ${escapeHtml(roleColor)}">${escapeHtml(roleLabel)}</span>
                    </div>
                </button>
            </div>
            <button class="btn btn-ghost btn-open-role" type="button" data-id="${escapeHtml(id)}">
                <i class="fa-solid fa-user-pen"></i> Düzenle
            </button>
        </div>
    `;
    }).join('') : '<div class="empty-cell">Yetkili kaydı yok</div>';

    const search = (DOM.caseSearch?.value || '').trim().toLowerCase();
    const period = DOM.casePeriodFilter?.value || 'all';
    const sort = DOM.caseSortFilter?.value || 'newest';
    const { unresolved } = calculateStats();
    const filteredCases = state.allCases.filter((entry) => {
        if (!search) return true;
        const profile = resolveStaffProfile(entry);
        return String(entry.id || '').includes(search)
            || String(entry.caseId || '').includes(search)
            || (entry.reason || '').toLowerCase().includes(search)
            || profile.name.toLowerCase().includes(search)
            || profile.id.includes(search);
    }).filter((entry) => isCaseInPeriod(entry, period)).sort((left, right) => compareCasesForAdmin(left, right, sort));

    const unresolvedRow = unresolved.length ? `
        <tr class="data-row unresolved-row">
            <td colspan="4">Cozumlenmemis: ${unresolved.length} ceza kaydi yetkili listesine dahil edilmedi.</td>
        </tr>
    ` : '';
    const caseRows = filteredCases.length ? filteredCases.map((entry) => {
        const validation = getValidation(entry);
        const profile = resolveStaffProfile(entry);
        const reason = cleanReason(entry.reason);
        return `
            <tr class="data-row">
                <td><button class="case-link" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">#${escapeHtml(String(entry.id || entry.caseId || '-'))}</button></td>
                <td>${staffIdentityHtml(profile, { compact: true })}</td>
                <td class="reason-cell" title="${escapeHtml(reason)}">${escapeHtml(reason)}</td>
                <td><span class="status-badge ${escapeHtml(validation.status || 'unknown')}">${escapeHtml(validation.status || 'unknown')}</span></td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="4" class="empty-cell">Ceza kaydı yok</td></tr>';

    DOM.mgmtCaseList.innerHTML = unresolvedRow + caseRows;

    document.querySelectorAll('.btn-open-role').forEach((button) => {
        button.addEventListener('click', () => openRoleModal(button.dataset.id));
    });
    DOM.mgmtCaseList.querySelectorAll('.case-link').forEach((button) => {
        button.addEventListener('click', () => {
            const entry = state.allCases.find((item) => String(item.id || item.caseId) === button.dataset.caseId);
            if (entry) openCaseUrl(entry);
        });
    });
    bindStaffCopyHandlers(DOM.mgmtModList);
    bindStaffCopyHandlers(DOM.mgmtCaseList);
    bindAvatarFallbacks();
}

function bindModalSaveHandlers() {
    if (!DOM.modalContent) return;
    DOM.modalContent.querySelectorAll('.case-review-save').forEach((button) => {
        button.addEventListener('click', async () => {
            const caseId = button.dataset.caseId;
            const note = DOM.modalContent.querySelector(`[data-note-for="${caseId}"]`)?.value || '';
            const reviewStatus = DOM.modalContent.querySelector(`[data-status-for="${caseId}"]`)?.value || '';
            await Storage.updateCaseMetadata(caseId, { note, reviewStatus });
            Toast.success('Kaydedildi', `Case #${caseId} guncellendi`);
        });
    });
    DOM.modalContent.querySelectorAll('.case-ai-analyze').forEach((button) => {
        button.addEventListener('click', async () => {
            const caseId = button.dataset.caseId;
            const entry = state.allCases.find((item) => String(item.id || item.caseId) === String(caseId));
            const output = DOM.modalContent.querySelector(`[data-ai-for="${caseId}"]`);
            if (!entry || !output) return;
            output.classList.remove('hidden');
            output.textContent = 'AI yorum hazirlaniyor...';
            const result = await analyzeCaseWithGroq(entry, getValidation(entry));
            output.textContent = result.success
                ? [
                    result.analysis.summary,
                    result.analysis.recommendedAction,
                    result.analysis.confidenceNote
                ].filter(Boolean).join(' | ')
                : `AI pasif: ${result.error}`;
        });
    });
    DOM.modalContent.querySelectorAll('.case-open-source').forEach((button) => {
        button.addEventListener('click', () => {
            const entry = state.allCases.find((item) => String(item.id || item.caseId) === String(button.dataset.caseId));
            if (entry) openCaseUrl(entry);
        });
    });
}

function openModal(moderator) {
    const modalProfile = resolveStaffProfile(moderator);
    const list = state.allCases
        .filter((entry) => {
            const profile = resolveStaffProfile(entry);
            return String(profile.id || '') === String(modalProfile.id || '') || profile.name === modalProfile.name;
        })
        .sort((left, right) => (caseTimestamp(right) || 0) - (caseTimestamp(left) || 0));

    DOM.modalTitle.textContent = `${modalProfile.name} - Ceza geçmişi`;
    DOM.modalContent.innerHTML = list.length ? list.map((entry) => {
        const validation = getValidation(entry);
        const profile = resolveStaffProfile(entry);
        return `
            <article class="case-history-card ${escapeHtml(validation.status || 'unknown')}">
                <div class="case-history-head">
                    <button class="case-link case-open-source" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">
                        #${escapeHtml(String(entry.id || entry.caseId || '-'))}
                    </button>
                    <div class="case-chip-row">
                        <span class="penalty-type ${escapeHtml(entry.type || 'unknown')}">${escapeHtml(String(entry.type || 'bilinmiyor').toUpperCase())}</span>
                        <span class="status-badge ${escapeHtml(validation.status || 'unknown')}">${escapeHtml(validation.status || 'unknown')}</span>
                    </div>
                </div>
                <div class="case-history-body">
                    <div>
                        <span class="field-label">Kullanıcı</span>
                        <strong>${escapeHtml(entry.user || 'Bilinmiyor')}</strong>
                        <small>${escapeHtml(entry.userId || '-')}</small>
                    </div>
                    <div>
                        <span class="field-label">Yetkili</span>
                        ${staffIdentityHtml(profile, { compact: true })}
                    </div>
                    <div>
                        <span class="field-label">Süre</span>
                        <strong>${escapeHtml(entry.duration || '-')}</strong>
                    </div>
                    <div>
                        <span class="field-label">Tarih</span>
                        <strong>${escapeHtml(entry.createdRaw || '-')}</strong>
                    </div>
                </div>
                <div class="case-history-reason">${escapeHtml(entry.reason || 'Sebep yok')}</div>
                <div class="case-history-validation">${escapeHtml(validation.reason || 'CUK değerlendirmesi yok')}</div>
                <div class="case-history-actions">
                        <select data-status-for="${escapeHtml(String(entry.id || ''))}">
                            <option value="">Otomatik</option>
                            <option value="valid" ${entry.reviewStatus === 'valid' ? 'selected' : ''}>Valid</option>
                            <option value="invalid" ${entry.reviewStatus === 'invalid' ? 'selected' : ''}>Invalid</option>
                        </select>
                        <input type="text" value="${escapeHtml(entry.note || '')}" data-note-for="${escapeHtml(String(entry.id || ''))}" placeholder="Not">
                        <button class="case-review-save" type="button" data-case-id="${escapeHtml(String(entry.id || ''))}">Kaydet</button>
                        <button class="case-ai-analyze" type="button" data-case-id="${escapeHtml(String(entry.id || ''))}">AI</button>
                </div>
                <div class="pointtrain-breakdown hidden" data-ai-for="${escapeHtml(String(entry.id || ''))}"></div>
            </article>
        `;
    }).join('') : '<div class="empty-state">Bu yetkili için ceza kaydı yok.</div>';
    DOM.detailModal?.classList.remove('hidden');
    bindStaffCopyHandlers(DOM.modalContent);
    bindAvatarFallbacks(DOM.modalContent);
    if (DOM.modalContent) bindModalSaveHandlers();
}
function closeModal() {
    DOM.detailModal?.classList.add('hidden');
}

function openRoleModal(userId = '') {
    if (!DOM.roleModal) return;
    const entry = state.userRegistry[userId] || {};
    if (DOM.roleUserId) DOM.roleUserId.value = userId || '';
    if (DOM.roleDisplayName) DOM.roleDisplayName.value = entry.name || '';
    if (DOM.roleSelect) DOM.roleSelect.value = normalizeRole(entry.role || 'discord_moderatoru');
    if (DOM.manualAccuracy) DOM.manualAccuracy.value = entry.manualAccuracy ?? '';
    if (DOM.roleUserNameHint) DOM.roleUserNameHint.textContent = entry.name ? `${entry.name} bulundu` : 'Kullanıcı seçin';

    if (userId) {
        const profile = resolveStaffProfile({ id: userId });
        if (DOM.roleUserPreview) {
            DOM.roleUserPreview.classList.remove('hidden');
            DOM.roleUserPreviewAvatar.src = profile.avatar;
            DOM.roleUserPreviewName.textContent = profile.name;
            DOM.roleUserPreviewId.textContent = userId;
        }
    } else {
        if (DOM.roleUserPreview) DOM.roleUserPreview.classList.add('hidden');
    }

    DOM.roleUserNameHint.style.color = 'var(--text-3)';
    DOM.roleModal.classList.remove('hidden');
}

function closeRoleModal() {
    DOM.roleModal.classList.add('hidden');
}

async function lookupUserIdentity() {
    const userId = DOM.roleUserId.value.trim();
    if (!userId) {
        Toast.warning('Arama', 'Discord ID girmelisiniz');
        return;
    }

    const registryEntry = state.userRegistry[userId] || {};
    const roleEntry = (state.roleCache || []).find((entry) => {
        const cacheId = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        return cacheId === userId;
    }) || {};

    let caseAvatar = null;
    let caseName = null;
    if (state.allCases) {
        const matchingCase = state.allCases.find(c =>
            (c.authorId && String(c.authorId) === userId) && (c.authorAvatar || c.authorName)
        );
        if (matchingCase) {
            caseAvatar = matchingCase.authorAvatar;
            caseName = matchingCase.authorName;
        }
    }

    const resolvedName = registryEntry.name || roleEntry.displayName || caseName || '';
    const resolvedAvatar = registryEntry.avatar || roleEntry.avatar || caseAvatar || '';

    if (resolvedName) {
        DOM.roleDisplayName.value = resolvedName;
        DOM.roleUserNameHint.textContent = 'Kullanıcı sistemden saptandı!';
        DOM.roleUserNameHint.style.color = 'var(--emerald)';
    } else {
        DOM.roleUserNameHint.textContent = 'Kullanıcı kaydı bulunamadı, yeni olarak kaydedilecek.';
        DOM.roleUserNameHint.style.color = 'var(--text-3)';
    }

    if (DOM.roleUserPreview) {
        DOM.roleUserPreview.classList.remove('hidden');
        DOM.roleUserPreviewAvatar.src = resolveAvatar(resolvedAvatar);
        DOM.roleUserPreviewName.textContent = resolvedName || 'Yeni Yetkili';
        DOM.roleUserPreviewId.textContent = userId;
        bindAvatarFallbacks(DOM.roleUserPreview);
    }
}

function runSimulation() {
    const reasonText = DOM.simReasonInput.value.trim();
    if (!reasonText) {
        DOM.simResultPanel?.classList.add('hidden');
        return;
    }

    const mockCase = {
        reason: reasonText,
        type: DOM.simTypeInput.value || 'mute',
        duration: DOM.simRepeatInput.value ? `${DOM.simRepeatInput.value} days` : '1 day'
    };

    CUKEngine.setRules(state.dynamicRules);
    const result = CUKEngine.validate(mockCase);

    if (DOM.simResultPanel) {
        DOM.simResultPanel.classList.remove('hidden');
    }

    const badge = DOM.simStatusBadge;
    if (badge) {
        badge.className = `status-badge ${result.status}`;
        badge.textContent = String(result.status || 'pending').toUpperCase();
    }

    const categoryVal = DOM.simResultCategory;
    if (categoryVal) {
        categoryVal.textContent = result.details?.category || result.details?.parsed?.category || 'Kategori Yok';
        categoryVal.style.color = result.status === 'valid' ? 'var(--emerald)' : result.status === 'invalid' ? 'var(--red)' : 'var(--purple-hi)';
    }

    const punishmentVal = DOM.simResultPunishment;
    if (punishmentVal) {
        punishmentVal.textContent = `${String(mockCase.type).toUpperCase()} (${mockCase.duration})`;
    }

    const accuracyVal = DOM.simResultAccuracy;
    if (accuracyVal) {
        accuracyVal.textContent = result.status === 'valid' ? 'Başarılı (%100)' : result.status === 'invalid' ? 'Hatalı (%0)' : 'İncelenmeli';
        accuracyVal.style.color = result.status === 'valid' ? 'var(--emerald)' : result.status === 'invalid' ? 'var(--red)' : 'var(--amber)';
    }

    const detailsVal = DOM.simResultDetails;
    if (detailsVal) {
        let detailsHtml = `<strong>Kural Saptama Detayları:</strong><br>`;
        detailsHtml += `• Girdi Sebebi: <em>"${escapeHtml(reasonText)}"</em><br>`;
        detailsHtml += `• Değerlendirme Gerekçesi: <strong>${escapeHtml(result.reason || 'Saptanamadı')}</strong><br>`;
        if (result.details?.rule) {
            detailsHtml += `• Tetiklenen Kural: <code>${escapeHtml(result.details.rule)}</code><br>`;
        }
        if (result.details?.parsed?.keywords?.length) {
            detailsHtml += `• Eşleşen Anahtar Kelimeler: <code>${escapeHtml(result.details.parsed.keywords.join(', '))}</code><br>`;
        }
        detailsVal.innerHTML = detailsHtml;
    }
}

async function saveBotConfig() {
    const channelId = DOM.botLogChannelId.value.trim();
    if (!channelId) {
        Toast.warning('Discord Bot', 'Log kanal ID gerekli');
        return;
    }

    const policy = await FirebaseRepository.getRolePolicy().catch(() => ({}));
    policy.discordBot = {
        logChannelId: channelId,
        active: true,
        updatedAt: new Date().toISOString()
    };

    await FirebaseRepository.saveRolePolicy(policy, state.session?.profile);
    Toast.success('Kaydedildi', 'Discord bot log kanalı güncellendi');
}

async function syncModeratorProfiles() {
    Toast.info('Senkronizasyon', 'Eşitleme başlatılıyor...');
    const policy = await FirebaseRepository.getRolePolicy().catch(() => ({}));
    policy.syncTrigger = {
        timestamp: Date.now(),
        actor: state.session?.profile?.email || 'system'
    };
    await FirebaseRepository.saveRolePolicy(policy, state.session?.profile);
    Toast.success('Tepki Gönderildi', 'Discord bot profil eşitleme sinyali gönderildi.');
}

async function testDiscordBotLog() {
    Toast.info('Test Logu', 'Test ceza embedi tetikleniyor...');
    const mockTestCase = {
        id: 'TEST-EMBED',
        caseId: 'TEST-EMBED',
        type: 'mute',
        duration: '10 minutes',
        reason: 'Sistem Entegrasyon Testi (Bu bir denemedir)',
        authorName: 'Gear_Head',
        authorId: '758769576778661989',
        authorAvatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
        user: 'TestUser',
        userId: '123456789012345678',
        scrapedAt: Date.now(),
        isTest: true
    };

    await FirebaseRepository.saveCases([mockTestCase], APP_CONFIG.guildId, state.session?.profile);
    Toast.success('Başarılı', 'Test kaydı Firestore\'a yazıldı, log gönderilecektir.');
}

async function saveRoleAssignment() {
    const id = DOM.roleUserId.value.trim();
    if (!id) {
        Toast.warning('Rol yonetimi', 'Kullanici ID gerekli');
        return;
    }

    await Storage.updateUserRole(
        id,
        DOM.roleSelect.value,
        DOM.manualAccuracy.value ? Number(DOM.manualAccuracy.value) : null,
        DOM.roleDisplayName.value.trim() || null
    );

    await loadData();
    closeRoleModal();
    Toast.success('Rol kaydedildi', 'Yetkili profili guncellendi');
}

function ensureRulesShape() {
    if (!state.dynamicRules.categories) state.dynamicRules.categories = {};
    if (!state.dynamicRules.autoInvalid) state.dynamicRules.autoInvalid = { keywords: [] };
}

function renderRuleCategories() {
    ensureRulesShape();
    const categories = Object.keys(state.dynamicRules.categories).sort((left, right) => left.localeCompare(right, 'tr'));
    DOM.ruleCategoriesList.innerHTML = categories.map((category, i) => {
        const catData = state.dynamicRules.categories[category];
        const stepCount = Object.keys(catData.repeats || {}).length;
        const colors = ['c-purple','c-blue','c-emerald','c-amber','c-red','c-cyan','c-pink','c-orange'];
        const colorClass = colors[i % colors.length];
        return `
            <div class="cuk-cat-item ${state.selectedRuleCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}" style="animation-delay: ${i * 40}ms">
                <div class="cuk-cat-color ${colorClass}"></div>
                <span class="cuk-cat-name">${escapeHtml(category)}</span>
                <span class="cuk-cat-badge">${stepCount}</span>
            </div>
        `;
    }).join('');

    DOM.ruleCategoriesList.querySelectorAll('.cuk-cat-item').forEach((item) => {
        item.addEventListener('click', () => {
            commitRuleEditor();
            state.selectedRuleCategory = item.dataset.category;
            renderRuleCategories();
            renderRuleEditor();
        });
    });
}

function renderRuleEditor() {
    const category = state.selectedRuleCategory;
    if (!category || !state.dynamicRules.categories[category]) {
        DOM.noRuleSelected.classList.remove('hidden');
        DOM.ruleEditorContent.classList.add('hidden');
        return;
    }

    const rule = state.dynamicRules.categories[category];
    DOM.noRuleSelected.classList.add('hidden');
    DOM.ruleEditorContent.classList.remove('hidden');
    DOM.editCategoryName.value = category;

    renderTags(DOM.keywordTagsArea, DOM.categoryKeywords, rule.keywords || [], 'keywords');
    renderTags(DOM.autoInvalidTagsArea, DOM.autoInvalidInput, rule.autoInvalid || [], 'autoInvalid');
    renderTags(DOM.globalInvalidArea, DOM.globalInvalidInput, state.dynamicRules.autoInvalid?.keywords || [], 'global');

    const repeats = rule.repeats || {};
    DOM.repeatsList.innerHTML = Object.keys(repeats).sort((left, right) => Number(left) - Number(right)).map((key, i) => `
        <div class="repeat-step-card" data-repeat="${key}" style="animation-delay: ${i * 30}ms">
            <div class="step-index">${key}</div>
            <input type="number" class="step-number" data-field="duration" value="${repeats[key].duration || ''}" placeholder="Dakika">
            <select class="step-select" data-field="unit">
                <option value="dakika" selected>Dakika</option>
            </select>
            <select class="step-select" data-field="type">
                <option value="mute" ${repeats[key].type === 'mute' ? 'selected' : ''}>Mute</option>
                <option value="ban" ${repeats[key].type === 'ban' ? 'selected' : ''}>Ban</option>
                <option value="warn" ${repeats[key].type === 'warn' ? 'selected' : ''}>Warn</option>
                <option value="kick" ${repeats[key].type === 'kick' ? 'selected' : ''}>Kick</option>
            </select>
            <button class="step-del-btn" data-idx="${key}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');

    renderTimeline(rule.repeats || {});
}

function renderTags(area, input, keywords, type) {
    if (!area || !input) return;
    area.querySelectorAll('.keyword-tag').forEach(t => t.remove());
    keywords.forEach(kw => {
        const tag = document.createElement('div');
        tag.className = 'keyword-tag';
        tag.innerHTML = `<span>${escapeHtml(kw)}</span><button class="keyword-tag-del"><i class="fa-solid fa-xmark"></i></button>`;
        tag.querySelector('.keyword-tag-del').addEventListener('click', () => {
            if (type === 'global') {
                state.dynamicRules.autoInvalid.keywords = state.dynamicRules.autoInvalid.keywords.filter(k => k !== kw);
            } else {
                const cat = state.dynamicRules.categories[state.selectedRuleCategory];
                cat[type] = cat[type].filter(k => k !== kw);
            }
            renderRuleEditor();
        });
        area.insertBefore(tag, input);
    });
}

function renderTimeline(repeats) {
    const tl = DOM.stepsTimeline;
    if (!tl) return;
    tl.innerHTML = '';
    const keys = Object.keys(repeats).sort((a, b) => Number(a) - Number(b));
    keys.forEach((key, i) => {
        const r = repeats[key];
        const stepEl = document.createElement('div');
        stepEl.className = 'timeline-step';
        stepEl.innerHTML = `
            <div class="timeline-node">
                <div class="timeline-dot ${r.type === 'ban' ? 'ban-dot' : r.type === 'warn' ? 'warn-dot' : ''}">${key}</div>
                <div class="timeline-label">${r.duration} dk</div>
            </div>
            ${i < keys.length - 1 ? '<div class="timeline-line"></div>' : ''}
        `;
        tl.appendChild(stepEl);
    });
}

function commitRuleEditor() {
    const category = state.selectedRuleCategory;
    if (!category || !state.dynamicRules.categories[category]) return;

    const nextName = DOM.editCategoryName?.value.trim() || category;
    if (nextName !== category && state.dynamicRules.categories[nextName]) {
        Toast.warning('İsim Çakışması', `"${nextName}" isimli kategori zaten mevcut.`);
        return;
    }

    const repeats = {};
    // Use .repeat-step-card (rendered by renderRuleEditor)
    DOM.repeatsList?.querySelectorAll('.repeat-step-card').forEach((row) => {
        const repeat = row.dataset.repeat;
        const type = row.querySelector('[data-field="type"]')?.value.trim() || '';
        const duration = row.querySelector('[data-field="duration"]')?.value;
        repeats[repeat] = {
            ...(type ? { type } : {}),
            ...(duration ? { duration: Number(duration) } : {})
        };
    });

    const nextRule = {
        ...state.dynamicRules.categories[category],
        repeats
    };

    delete state.dynamicRules.categories[category];
    state.dynamicRules.categories[nextName] = nextRule;
    state.selectedRuleCategory = nextName;
}

async function saveRules() {
    commitRuleEditor();
    const syncResult = await Storage.saveDynamicRules(state.dynamicRules);
    CUKEngine.setRules(state.dynamicRules);
    renderRuleCategories();
    renderRuleEditor();
    if (syncResult?.synced === false) {
        Toast.warning('Kurallar lokal kaydedildi', `Firestore senkronu basarisiz: ${syncResult.error || 'bilinmeyen hata'}`);
    } else {
        Toast.success('Kurallar kaydedildi', 'CUK editor ve Firestore guncellendi');
    }
}

function addRuleCategory() {
    commitRuleEditor();
    const name = `Yeni Kategori ${Object.keys(state.dynamicRules.categories).length + 1}`;
    state.dynamicRules.categories[name] = { keywords: [], repeats: {} };
    state.selectedRuleCategory = name;
    renderRuleCategories();
    renderRuleEditor();
}

function addRepeatRow() {
    if (!DOM.repeatsList) return;
    const count = DOM.repeatsList.querySelectorAll('.repeat-step-card').length + 1;
    DOM.repeatsList.insertAdjacentHTML('beforeend', `
        <div class="repeat-step-card" data-repeat="${count}">
            <div class="step-index">${count}</div>
            <input type="number" class="step-number" data-field="duration" placeholder="Dakika">
            <select class="step-select" data-field="unit"><option value="dakika">Dakika</option></select>
            <select class="step-select" data-field="type">
                <option value="mute">Mute</option>
                <option value="ban">Ban</option>
                <option value="warn">Warn</option>
                <option value="kick">Kick</option>
            </select>
            <button class="step-del-btn" data-idx="${count}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `);
}

function deleteRuleCategory() {
    if (!state.selectedRuleCategory) return;
    delete state.dynamicRules.categories[state.selectedRuleCategory];
    state.selectedRuleCategory = Object.keys(state.dynamicRules.categories)[0] || '';
    renderRuleCategories();
    renderRuleEditor();
}

function renderPointtrainTab() {
    const run = state.latestPointtrainRun;
    if (!run) {
        DOM.pointtrainAdminSummary.innerHTML = `
            <div class="comp-card" style="grid-column: span 3;">
                <div class="comp-label">Pointtrain verisi yok</div>
                <div class="comp-value" style="font-size:13px; opacity:0.7;">Sidepanel uzerinden once scan calistirin</div>
            </div>
        `;
        DOM.pointtrainTableBody.innerHTML = '';
        return;
    }

    const rawMetrics = run.metrics || [];
    const managementMetrics = rawMetrics.filter((metric) => isManagementRole(metric.role));
    const staffMetrics = rawMetrics.filter((metric) => !isManagementRole(metric.role));

    DOM.pointtrainAdminSummary.innerHTML = `
        <div class="comp-card">
            <div class="comp-label">Calistirma</div>
            <div class="comp-value">${escapeHtml(formatTurkishDateTime(run.createdAt))}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Yetkili</div>
            <div class="comp-value">${staffMetrics.length}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Yonetim Haric</div>
            <div class="comp-value">${managementMetrics.length}</div>
            <div class="comp-note">Yonetim kadrosu pointtrain degerlendirmesine dahil edilmez</div>
        </div>
    `;

    const metrics = [...staffMetrics].sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

    DOM.pointtrainTableBody.innerHTML = metrics.length ? metrics.map((metric, index) => `
        <tr class="data-row">
            <td>${index + 1}</td>
            <td>${escapeHtml(metric.displayName || 'Bilinmiyor')}</td>
            <td>${escapeHtml(metric.role || 'moderator')}</td>
            <td>${metric.sapphirePunishments || 0}</td>
            <td>${metric.discordMessageCount || 0}</td>
            <td>${metric.channelCount || 0}</td>
            <td>${metric.activeDays || 0}</td>
            <td>${Number(metric.weightedScore || 0).toFixed(2)}</td>
            <td>${metric.failures ? escapeHtml(String(metric.failures)) : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="9" class="empty-cell">Pointtrain siralamasina dahil edilecek yetkili yok</td></tr>';
}

async function loadData() {
    if (state.session?.profile) {
        await FirebaseRepository.ensureRolePolicy(state.session.profile).catch(() => null);
        await FirebaseRepository.seedRoleCacheMembers(state.session.profile).catch(() => null);
        await FirebaseRepository.seedGoogleAllowlist(state.session.profile).catch(() => null);
    }

    const [cases, registry, staffDirectory, rules, pointtrainRun, userInfo] = await Promise.all([
        Storage.getCases(),
        Storage.getUserRegistry(),
        Storage.getStaffDirectory(),
        Storage.getDynamicRules(),
        Storage.getLatestPointtrainRun(),
        Storage.getUserInfo()
    ]);

    state.allCases = cases;
    state.userRegistry = registry;
    state.staffDirectory = staffDirectory;
    state.dynamicRules = rules;
    CUKEngine.setRules(state.dynamicRules);
    state.latestPointtrainRun = pointtrainRun;

    const profile = state.session?.profile || {};
    DOM.adminProfileAvatar.src = resolveAvatar(profile.avatar || userInfo?.avatar);
    DOM.adminProfileAvatar.dataset.avatarImg = '1';
    DOM.adminProfileName.textContent = profile.displayName || userInfo?.name || 'Yetkili';
    DOM.adminProfileRole.textContent = normalizeRole(state.session?.role || profile.role || userInfo?.role || 'moderator');

    if (!state.selectedRuleCategory) {
        state.selectedRuleCategory = Object.keys(state.dynamicRules.categories || {})[0] || '';
    }

    await loadAuthAdminData().catch(() => null);

    renderStats();
    renderTable(DOM.tableSearch?.value || '');
    renderManagement();
    renderRuleCategories();
    renderRuleEditor();
    renderPointtrainTab();
    if (state.activeTab === 'profile') renderProfilePage();
    bindAvatarFallbacks();
}

async function exportAll() {
    const { staff, management, reasons, filteredCases } = calculateStats();
    const totalCount = filteredCases.length;
    const validCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.VALID).length;
    const invalidCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.INVALID).length;
    const pendingCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.PENDING).length;
    const efficiency = totalCount ? Math.round((validCount / totalCount) * 100) : 0;

    let txt = `=========================================\n`;
    txt += `LUTHEUS CEZARAPOR - YONETICI RAPORU\n`;
    txt += `Olusturulma Tarihi: ${formatTurkishDateTime(new Date())}\n`;
    txt += `=========================================\n\n`;

    txt += `GENEL ISTATISTIKLER\n`;
    txt += `-----------------------------------------\n`;
    txt += `Toplam Ceza: ${totalCount}\n`;
    txt += `Dogrulanmis (Valid): ${validCount}\n`;
    txt += `Hatali (Invalid): ${invalidCount}\n`;
    txt += `Bekleyen (Pending): ${pendingCount}\n`;
    txt += `Yonetim Kadrosu: ${management.length}\n`;
    txt += `Aktif Yetkili Sayisi: ${staff.length}\n`;
    txt += `Genel Dogruluk Orani: %${efficiency}\n\n`;

    txt += `YONETIM KADROSU\n`;
    txt += `-----------------------------------------\n`;
    management.forEach((entry, index) => {
        txt += `${index + 1}. ${entry.name} (${getRoleLabel(entry.role)})\n`;
    });
    txt += management.length ? `\n` : `Yonetim kaydi yok\n\n`;

    txt += `YETKILI PERFORMANSI\n`;
    txt += `-----------------------------------------\n`;
    staff.forEach((entry, index) => {
        const acc = entry.performance?.validPercent || 0;
        txt += `${index + 1}. ${entry.name} (${getRoleLabel(entry.role)}) - ${entry.count} islem, %${acc} Dogruluk\n`;
    });
    txt += `\n`;

    txt += `EN SIK CEZA SEBEPLERI\n`;
    txt += `-----------------------------------------\n`;
    reasons.slice(0, 15).forEach(([name, count], index) => {
        txt += `${index + 1}. ${name} - ${count} kez\n`;
    });
    txt += `\n`;

    txt += `SON CEZA KAYITLARI\n`;
    txt += `-----------------------------------------\n`;
    filteredCases.slice(0, 100).forEach((entry) => {
        const validation = getValidation(entry);
        const profile = resolveStaffProfile(entry);
        txt += `#${entry.id || entry.caseId || '-'} | Yetkili: ${profile.name} | Sebep: ${entry.reason || '-'} | Durum: ${validation.status || 'unknown'}\n`;
    });

    downloadFile(`lutheus-rapor-${Date.now()}.txt`, txt, 'text/plain;charset=utf-8');
}

async function copyDiscordReport() {
    return copyDiscordReportPremium();
}
async function copyDiscordReportPremium() {
    const { staff, management, filteredCases, reasons } = calculateStats();
    const totalCount = filteredCases.length;
    const validCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.VALID).length;
    const invalidCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.INVALID).length;
    const pendingCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.PENDING).length;
    const efficiency = totalCount ? Math.round((validCount / totalCount) * 100) : 0;
    const distribution = getPunishmentDistribution(filteredCases).percentages;

    let md = `## \u{1F4CA} Lutheus CezaRapor - Haftalik Ozet\n`;
    md += `*Tarih: ${formatTurkishDate(new Date())}*\n\n`;
    md += `### \u{1F3DB}\u{FE0F} Yonetim Kadrosu\n`;
    md += management.length
        ? `> ${management.map((entry) => `${entry.name} (${getRoleLabel(entry.role)})`).join(', ')}\n\n`
        : `> Kayit yok\n\n`;
    md += `### \u{1F4C8} Genel Istatistikler\n`;
    md += `> \u{1F528} Toplam: \`${totalCount}\` | \u{2705} Valid: \`${validCount}\` | \u{274C} Invalid: \`${invalidCount}\` | \u{23F3} Pending: \`${pendingCount}\` | \u{1F3AF} Basari: \`%${efficiency}\`\n\n`;
    md += `### \u{1F3C6} Yetkili Performans Siralamasi\n`;
    md += `\`\`\`md\n`;
    md += `Sira | Yetkili | Rutbe | Islem | Dogruluk\n`;
    md += `---|---|---|---|---\n`;
    staff.slice(0, 15).forEach((entry, index) => {
        const acc = entry.performance?.validPercent || 0;
        const roleLabel = getRoleLabel(entry.role);
        md += `${String(index + 1).padStart(2, '0')} | ${entry.name.padEnd(16)} | ${roleLabel.padEnd(16)} | ${String(entry.count).padEnd(5)} | %${acc}\n`;
    });
    md += `\`\`\`\n\n`;
    md += `### \u{1F4CB} Top 5 Ceza Sebebi\n`;
    reasons.slice(0, 5).forEach(([name, count], index) => {
        md += `${index + 1}. ${name} - ${count} kez\n`;
    });
    if (!reasons.length) md += `Kayit yok\n`;
    md += `\n### \u{1F4CA} Ceza Dagilimi\n`;
    md += `> \u{1F507} Mute: %${distribution.mute} | \u{26D4} Ban: %${distribution.ban} | \u{26A0}\u{FE0F} Warn: %${distribution.warn} | \u{1F4E6} Diger: %${distribution.other}\n\n`;
    md += `*Rapor otomatik olarak Lutheus v3 panelinden olusturulmustur.*`;

    await copyText(md);
    Toast.success('Kopyalandi', 'Premium Discord raporu panoya alindi');
}
function bindEvents() {
    DOM.navBtns.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.page)));
    DOM.tableSearch?.addEventListener('input', (event) => renderTable(event.target.value));
    DOM.dateFilter?.addEventListener('change', () => {
        renderStats();
        renderTable(DOM.tableSearch.value);
    });
    DOM.cukSearch?.addEventListener('input', () => renderRuleCategories());
    DOM.caseSearch?.addEventListener('input', renderManagement);
    DOM.casePeriodFilter?.addEventListener('change', renderManagement);
    DOM.caseSortFilter?.addEventListener('change', renderManagement);
    DOM.refreshBtn?.addEventListener('click', loadData);
    DOM.exportBtn?.addEventListener('click', exportAll);
    DOM.copyDiscordBtn?.addEventListener('click', copyDiscordReportPremium);
    document.getElementById('topbarUser')?.addEventListener('click', () => {
        switchTab('profile');
        const myId = state.session?.profile?.discordId;
        if (isValidDiscordId(myId)) {
            state.selectedProfileId = myId;
            loadProfileDetails(myId);
        }
    });
    DOM.revalidateBtn?.addEventListener('click', () => {
        renderStats();
        renderTable(DOM.tableSearch.value);
        renderManagement();
        Toast.success('Yeniden hesaplandi', 'CUK durumlari yenilendi');
    });
    DOM.closeModal?.addEventListener('click', closeModal);
    DOM.detailModal?.addEventListener('click', (event) => {
        if (event.target === DOM.detailModal) closeModal();
    });
    DOM.roleBtn?.addEventListener('click', () => openRoleModal(''));
    DOM.lookupUserBtn?.addEventListener('click', lookupUserIdentity);
    DOM.saveRoleBtn?.addEventListener('click', saveRoleAssignment);
    DOM.closeRoleModal?.addEventListener('click', closeRoleModal);
    DOM.roleModal?.addEventListener('click', (event) => {
        if (event.target === DOM.roleModal) closeRoleModal();
    });
    DOM.btnAddCategory?.addEventListener('click', addRuleCategory);
    DOM.btnDeleteCategory?.addEventListener('click', deleteRuleCategory);
    DOM.btnDuplicateCategory?.addEventListener('click', () => {
        const cat = state.dynamicRules.categories[state.selectedRuleCategory];
        if (!cat) return;
        const dupName = `${state.selectedRuleCategory} (Kopya)`;
        state.dynamicRules.categories[dupName] = JSON.parse(JSON.stringify(cat));
        state.selectedRuleCategory = dupName;
        renderRuleCategories();
        renderRuleEditor();
        Toast.info('Kategori kopyalandı');
    });
    DOM.btnSaveCategoryInline?.addEventListener('click', () => {
        const cat = state.dynamicRules.categories[state.selectedRuleCategory];
        if (!cat) return;
        const nextName = DOM.editCategoryName.value.trim();
        if (nextName && nextName !== state.selectedRuleCategory) {
            if (state.dynamicRules.categories[nextName]) {
                Toast.warning('İsim Çakışması', `"${nextName}" isimli kategori zaten mevcut.`);
                return;
            }
            state.dynamicRules.categories[nextName] = cat;
            delete state.dynamicRules.categories[state.selectedRuleCategory];
            state.selectedRuleCategory = nextName;
        }
        renderRuleCategories();
        Toast.success('Kategori güncellendi');
    });
    DOM.btnCukSave?.addEventListener('click', saveRules);
    DOM.btnAddStep?.addEventListener('click', addRepeatRow);
    DOM.btnBackToDashboard?.addEventListener('click', () => switchTab('dashboard'));
    DOM.pointtrainRefreshBtn?.addEventListener('click', loadData);
    DOM.pointtrainCopyBtn?.addEventListener('click', async () => {
        if (!state.latestPointtrainRun) return;
        await copyText(buildPointtrainMarkdown(state.latestPointtrainRun));
        Toast.success('Pointtrain', 'Markdown kopyalandi');
    });
    DOM.pointtrainExportBtn?.addEventListener('click', () => {
        if (!state.latestPointtrainRun) return;
        downloadFile(`pointtrain-${Date.now()}.csv`, buildPointtrainCsv(state.latestPointtrainRun), 'text/csv;charset=utf-8');
    });
    DOM.saveAllowBtn?.addEventListener('click', saveAllowlist);
    DOM.saveRoleCacheBtn?.addEventListener('click', saveRoleCache);
    DOM.saveGroqPolicyBtn?.addEventListener('click', saveGroqPolicy);
    DOM.refreshAuditBtn?.addEventListener('click', loadAuthAdminData);
    document.getElementById('closeRoleModalFooter')?.addEventListener('click', closeRoleModal);

    const setupTagInput = (input, area, type) => {
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = input.value.trim();
                if (!val) return;
                if (type === 'global') {
                    if (!state.dynamicRules.autoInvalid.keywords.includes(val)) {
                        state.dynamicRules.autoInvalid.keywords.push(val);
                    }
                } else {
                    const cat = state.dynamicRules.categories[state.selectedRuleCategory];
                    if (!cat) return;
                    if (type === 'keywords' && !cat.keywords.includes(val)) cat.keywords.push(val);
                    if (type === 'autoInvalid' && !cat.autoInvalid?.includes(val)) {
                        if (!cat.autoInvalid) cat.autoInvalid = [];
                        cat.autoInvalid.push(val);
                    }
                }
                input.value = '';
                renderRuleEditor();
            }
        });
    };

    setupTagInput(DOM.categoryKeywords, DOM.keywordTagsArea, 'keywords');
    setupTagInput(DOM.autoInvalidInput, DOM.autoInvalidTagsArea, 'autoInvalid');
    setupTagInput(DOM.globalInvalidInput, DOM.globalInvalidArea, 'global');

    // CUK Simulator Sandbox Listeners
    DOM.btnRunSimulation?.addEventListener('click', runSimulation);
    DOM.simReasonInput?.addEventListener('input', runSimulation);
    DOM.simRepeatInput?.addEventListener('input', runSimulation);
    DOM.simTypeInput?.addEventListener('change', runSimulation);

    // Discord Bot Integration Listeners
    DOM.btnSaveBotConfig?.addEventListener('click', saveBotConfig);
    DOM.btnSyncProfiles?.addEventListener('click', syncModeratorProfiles);
    DOM.btnTestBotLog?.addEventListener('click', testDiscordBotLog);

    // Yetkili Profilleri Listeners
    DOM.profileSearchInput?.addEventListener('input', renderProfilePage);
    DOM.btnSaveProfileDetails?.addEventListener('click', saveProfileDetails);
}

// Yetkili Profilleri Page Logic
function renderProfilePage() {
    try {
        const query = (DOM.profileSearchInput?.value || '').trim().toLowerCase();

        // Resolve all unique moderators from calculated stats and roleCache
        const { staff, management } = calculateStats();
        const statsStaff = [...management, ...staff].filter((entry) => isDisplayableStaffEntry(entry, { requireCases: true }));

        const merged = new Map();

        // Add everyone from stats first
        statsStaff.forEach(entry => {
            const profile = resolveStaffProfile(entry);
            const id = profile.id;
            if (isValidDiscordId(id)) {
                merged.set(id, {
                    id,
                    name: profile.name,
                    role: profile.role,
                    avatar: profile.avatar,
                    totalCases: entry.count,
                    validCases: entry.valid,
                    invalidCases: entry.invalid,
                    pendingCases: entry.pending
                });
            }
        });

        // Add everyone from roleCache that might not have processed stats in this period
        (state.roleCache || []).forEach(entry => {
            const cacheId = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
            if (isValidDiscordId(cacheId) && !merged.has(cacheId)) {
                const profile = resolveStaffProfile({ id: cacheId });
                const candidate = {
                    id: cacheId,
                    name: profile.name,
                    role: profile.role,
                    avatar: profile.avatar,
                    totalCases: 0,
                    validCases: 0,
                    invalidCases: 0,
                    pendingCases: 0
                };
                if (isDisplayableStaffEntry(candidate)) merged.set(cacheId, candidate);
            }
        });

        const allMods = Array.from(merged.values())
            .filter(entry => {
                if (!query) return true;
                return entry.name.toLowerCase().includes(query) ||
                       entry.id.includes(query) ||
                       getRoleLabel(entry.role).toLowerCase().includes(query);
            })
            .sort((left, right) => getRoleLevel(right.role) - getRoleLevel(left.role) || left.name.localeCompare(right.name, 'tr'));

        const emptyMessage = (!state.allCases.length && !(state.roleCache || []).length)
            ? 'Veri henuz yuklenmedi veya ceza kaydi bulunamadi'
            : 'Yetkili bulunamadi';

        DOM.profileStaffList.innerHTML = allMods.length ? allMods.map(entry => {
            const roleColor = getRoleColor(entry.role);
            const roleLabel = getRoleLabel(entry.role);
            const isActive = state.selectedProfileId === entry.id;
            return `
            <div class="mod-card animate-in ${isActive ? 'active-profile-card' : ''}" data-id="${escapeHtml(entry.id)}" style="--role-color: ${escapeHtml(roleColor)}; cursor:pointer; ${isActive ? 'background:var(--bg-hover); border-color:var(--purple);' : ''}">
                <div class="mod-card-left">
                    <div class="mod-avatar-wrapper" style="border-color: ${escapeHtml(roleColor)}">
                        ${avatarImg(entry.avatar, 'staff-avatar', entry.name)}
                    </div>
                    <div class="mod-info">
                        <span class="mod-name">${escapeHtml(entry.name)}</span>
                        <span class="mod-id">Discord ID: ${escapeHtml(entry.id)}</span>
                        <span class="mod-role-badge" style="color: ${escapeHtml(roleColor)}">${escapeHtml(roleLabel)}</span>
                    </div>
                </div>
            </div>
            `;
        }).join('') : '<div class="empty-cell">Yetkili bulunamadı</div>';

        // Bind card clicks
        DOM.profileStaffList.querySelectorAll('.mod-card').forEach(card => {
            card.addEventListener('click', () => {
                state.selectedProfileId = card.dataset.id;
                renderProfilePage(); // Refresh active highlights
                loadProfileDetails(card.dataset.id);
            });
        });

        bindAvatarFallbacks();

    } catch (error) {
        console.error("renderProfilePage error:", error);
    }
}

async function loadProfileDetails(userId) {
    if (!userId) return;

    try {
        const profile = resolveStaffProfile({ id: userId });
        const role = profile.role || 'moderator';
        const roleColor = getRoleColor(role);

        // Find stats for this user
        const { staff, management } = calculateStats();
        const everyone = [...management, ...staff];
        const userStats = everyone.find(e => e.id === userId) || { count: 0, valid: 0, invalid: 0, pending: 0 };
        const acc = userStats.count ? Math.round((userStats.valid / userStats.count) * 100) : 0;

        // Pointtrain score calculation: base points + performance score
        const performance = CUKEngine.calculatePerformanceScore({
            valid: userStats.valid,
            invalid: userStats.invalid,
            pending: userStats.pending
        });
        const ptBase = ['kurucu', 'admin', 'yonetici'].includes(role) ? 100 : ['genel_sorumlu', 'discord_yoneticisi', 'kidemli'].includes(role) ? 80 : 40;
        const ptScore = Math.max(0, ptBase + performance.score);

        // Show detail content & hide empty state
        DOM.profileEmptyState.classList.add('hidden');
        DOM.profileDetailContent.classList.remove('hidden');

        // Populate header details
        DOM.profHeaderCard.style.setProperty('--role-color', roleColor);
        DOM.profAvatarGlow.style.setProperty('--role-color', roleColor);
        DOM.profAvatar.src = profile.avatar;
        DOM.profName.textContent = profile.name;
        DOM.profRoleBadge.textContent = getRoleLabel(role);
        DOM.profRoleBadge.className = `role-chip ${role}`;
        DOM.profDiscordId.textContent = `Discord ID: ${userId}`;

        // Join Date
        const cachedRoleEntry = (state.roleCache || []).find(e => {
            const cid = e.discordId || String(e.identityKey || e.id || '').replace(/^discord:/, '');
            return cid === userId;
        }) || {};
        const joinDate = cachedRoleEntry.joinDate || profile.joinDate || '';
        DOM.profJoinDate.textContent = joinDate ? formatTurkishDate(new Date(joinDate)) : 'Belirtilmemiş';

        // Stats grid
        DOM.profStatTotal.textContent = String(userStats.count);
        DOM.profStatAccuracy.textContent = `${acc}%`;
        DOM.profStatAccuracy.style.color = acc >= 90 ? 'var(--emerald)' : acc >= 80 ? 'var(--amber)' : 'var(--red)';
        DOM.profStatInvalid.textContent = String(userStats.invalid);
        DOM.profStatPtScore.textContent = String(ptScore);

        // Warn Points & Dots
        // Moderatör is limit 2, Support is limit 3, others fallback to 2
        const isSupport = ['support', 'discord_destek_ekibi'].includes(role);
        const warnLimit = isSupport ? 3 : 2;
        DOM.profWarnLimitLabel.textContent = `${warnLimit} Uyarı Sınırı (Ulaşınca Yetki Düşer)`;

        const currentWarns = Number(cachedRoleEntry.warnPoints || 0);
        let warnDotsHtml = '';
        for (let i = 1; i <= warnLimit; i++) {
            const isActive = i <= currentWarns;
            warnDotsHtml += `<div class="point-dot ${isActive ? 'active-warn' : 'inactive'}" title="${i}. Uyarı Puanı"></div>`;
        }
        DOM.profWarnDots.innerHTML = warnDotsHtml;

        // İkaz Points & Dots (always 2)
        const currentIkaz = Number(cachedRoleEntry.ikazPoints || 0);
        let ikazDotsHtml = '';
        for (let i = 1; i <= 2; i++) {
            const isActive = i <= currentIkaz;
            ikazDotsHtml += `<div class="point-dot ${isActive ? 'active-ikaz' : 'inactive'}" title="${i}. İkaz Puanı"></div>`;
        }
        DOM.profIkazDots.innerHTML = ikazDotsHtml;

        // Admin Edit Form permissions (Yoneticiler, Admin, Genel Sorumlu, Discord Yoneticisi ve Kidemliler editleyebilir)
        const isPrivileged = canAccessAdmin(state.session?.role);
        const isEditable = isPrivileged && (getRoleLevel(state.session?.role) >= 65); // Kidemli or higher

        if (isEditable) {
            DOM.profFormJoinDate.removeAttribute('disabled');
            DOM.profFormNotes.removeAttribute('disabled');
            DOM.profFormWarns.removeAttribute('disabled');
            DOM.profFormIkaz.removeAttribute('disabled');
            DOM.btnSaveProfileDetails.style.display = 'block';
        } else {
            DOM.profFormJoinDate.setAttribute('disabled', 'true');
            DOM.profFormNotes.setAttribute('disabled', 'true');
            DOM.profFormWarns.setAttribute('disabled', 'true');
            DOM.profFormIkaz.setAttribute('disabled', 'true');
            DOM.btnSaveProfileDetails.style.display = 'none';
        }

        // Set form values
        DOM.profFormJoinDate.value = joinDate || '';
        DOM.profFormNotes.value = cachedRoleEntry.performanceNotes || '';
        DOM.profFormWarns.value = String(currentWarns);
        DOM.profFormIkaz.value = String(currentIkaz);

    } catch (error) {
        console.error("loadProfileDetails error:", error);
    }
}

async function saveProfileDetails() {
    const userId = state.selectedProfileId;
    if (!userId) return;

    // Check permission
    const isEditable = canAccessAdmin(state.session?.role) && (getRoleLevel(state.session?.role) >= 65);
    if (!isEditable) {
        Toast.error('Yetki Reddedildi', 'Profil düzenleme yetkiniz bulunmamaktadır.');
        return;
    }

    const joinDate = DOM.profFormJoinDate.value;
    const notes = DOM.profFormNotes.value.trim();
    const warns = Number(DOM.profFormWarns.value);
    const ikaz = Number(DOM.profFormIkaz.value);

    try {
        const profile = resolveStaffProfile({ id: userId });
        const displayName = profile.name || 'Yetkili';
        const role = profile.role || 'moderator';

        const payload = {
            discordId: userId,
            displayName,
            role,
            joinDate,
            performanceNotes: notes,
            warnPoints: warns,
            ikazPoints: ikaz
        };

        await FirebaseRepository.setRoleCache(`discord:${userId}`, payload, state.session?.profile);
        await Storage.upsertStaffDirectoryEntry(userId, {
            discordUserId: userId,
            displayName,
            role,
            joinDate,
            performanceNotes: notes,
            warnPoints: warns,
            ikazPoints: ikaz
        });

        // Refresh local cache lists and reload page views
        await loadAuthAdminData();
        await loadProfileDetails(userId);
        Toast.success('Profil Güncellendi', `${displayName} adlı yetkilinin profili başarıyla kaydedildi.`);

    } catch (error) {
        console.error("saveProfileDetails error:", error);
        Toast.error('Hata oluştu', error.message || 'Profil kaydedilemedi.');
    }
}

async function init() {
    state.session = await AuthService.requireSession({
        admin: true,
        returnTo: chrome.runtime.getURL('src/dashboard/admin.html')
    });
    if (!canAccessAdmin(state.session.role)) {
        AuthService.redirectToLogin(chrome.runtime.getURL('src/dashboard/admin.html'), 'forbidden');
        return;
    }
    Toast.init();
    bindEvents();
    switchTab('dashboard');
    await loadData();
}

init().catch((error) => {
    console.error(error);
    Toast.error('Baslatma hatasi', error.message || 'Admin konsolu yuklenemedi');
});
