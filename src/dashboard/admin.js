import { Storage } from '../lib/storage.js';
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
    tableBody: document.getElementById('modTableBody'),
    tableSearch: document.getElementById('tableSearch'),
    dateFilter: document.getElementById('dateFilter'),
    staffTableBody: document.getElementById('modTableBody'),
    reasonTableBody: document.getElementById('reasonList'),
    reasonList: document.getElementById('reasonList'),
    mgmtModList: document.getElementById('mgmtModList'),
    mgmtCaseList: document.getElementById('mgmtCaseList'),
    cukSearch: document.getElementById('cukSearch'),
    caseSearch: document.getElementById('caseSearch'),
    refreshBtn: document.getElementById('btnRefresh'),
    exportBtn: document.getElementById('btnExport'),
    copyDiscordBtn: document.getElementById('btnCopyDiscord'),
    revalidateBtn: document.getElementById('btnRevalidate'),
    lastScanTime: document.getElementById('lastScanTime'),
    detailModal: document.getElementById('detailModal'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal'),
    roleModal: document.getElementById('roleModal'),
    closeRoleModal: document.getElementById('closeRoleModal'),
    saveRoleBtn: document.getElementById('saveRoleBtn'),
    roleUserId: document.getElementById('roleUserId'),
    roleUserDisplayName: document.getElementById('roleDisplayName'),
    roleSelector: document.getElementById('roleSelect'),
    roleManualAccuracy: document.getElementById('manualAccuracy'),
    roleBtn: document.getElementById('roleBtn'),
    lookupUserBtn: document.getElementById('lookupUserBtn'),
    noRuleSelected: document.getElementById('cukEmptyState'),
    ruleCategoriesList: document.getElementById('cukCategoryList'),
    ruleEditorContent: document.getElementById('cukEditorContent'),
    btnAddCategory: document.getElementById('btnAddCategory'),
    btnCukSave: document.getElementById('btnCukSave'),
    editCategoryName: document.getElementById('cukCatName'),
    repeatsList: document.getElementById('repeatStepsList'),
    btnAddRepeat: document.getElementById('btnAddStep'),
    categoryKeywords: document.getElementById('keywordInput'),
    btnDeleteCategory: document.getElementById('btnDeleteCategory'),
    btnCukImport: document.getElementById('btnCukImport'),
    btnSaveRules: document.getElementById('btnCukSave'),
    btnDuplicateCategory: document.getElementById('btnDuplicateCategory'),
    btnSaveCategoryInline: document.getElementById('btnSaveCategoryInline'),
    btnBackToDashboard: document.getElementById('btnBackToDashboard'),
    stepsTimeline: document.getElementById('stepsTimeline'),
    keywordTagsArea: document.getElementById('keywordTagsArea'),
    autoInvalidTagsArea: document.getElementById('autoInvalidTagsArea'),
    autoInvalidInput: document.getElementById('autoInvalidInput'),
    globalInvalidArea: document.getElementById('globalInvalidArea'),
    globalInvalidInput: document.getElementById('globalInvalidInput'),
    chkEmptyReason: document.getElementById('chkEmptyReason'),
    casePeriodFilter: document.getElementById('casePeriodFilter'),
    caseSortFilter: document.getElementById('caseSortFilter'),
    modalTitle: document.getElementById('modalTitle'),
    roleDisplayName: document.getElementById('roleDisplayName'),
    roleSelect: document.getElementById('roleSelect'),
    manualAccuracy: document.getElementById('manualAccuracy'),
    roleUserNameHint: document.getElementById('roleUserNameHint'),
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
    auditList: document.getElementById('auditList')
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
        this.container = document.getElementById('toastStack');
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

function isGenericStaffName(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;
    return [
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
    const cleaned = values.map((value) => cleanStaffName(value)).filter(Boolean);
    return cleaned.find((value) => !isGenericStaffName(value)) || cleaned[0] || '';
}

function resolveStaffProfile(source = {}) {
    const rawId = source.authorId || source.id || source.discordUserId || source.sapphireAuthorId || source.discordId || '';
    const rawName = source.authorName || source.name || source.displayName || source.username || '';
    const embeddedId = extractSnowflake(rawId) || extractSnowflake(rawName);
    const id = embeddedId || String(rawId || '').trim();
    const directoryEntry = state.staffDirectory[id] || state.staffDirectory[`name:${rawName}`] || {};
    const registryEntry = state.userRegistry[id] || {};
    const roleEntry = (state.roleCache || []).find((entry) => {
        const cacheId = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        return cacheId === id;
    }) || {};
    const nameEntry = findProfileByName(cleanStaffName(rawName, id)) || {};
    const profile = {
        ...nameEntry,
        ...directoryEntry,
        ...registryEntry,
        ...roleEntry
    };
    const displayName = pickStaffName(
        rawName,
        source.displayName,
        source.name,
        registryEntry.displayName,
        registryEntry.name,
        directoryEntry.displayName,
        directoryEntry.name,
        nameEntry.displayName,
        nameEntry.name,
        roleEntry.displayName,
        roleEntry.name
    ) || (id ? `Yetkili ${id.slice(-4)}` : 'Bilinmeyen Yetkili');

    return {
        id: id || profile.discordId || profile.discordUserId || profile.sapphireAuthorId || '',
        name: displayName,
        avatar: resolveAvatar(profile.avatar || source.authorAvatar || source.avatar),
        role: normalizeRole(profile.role || source.role || 'moderator'),
        missing: !id && !displayName
    };
}

function staffIdentityHtml(profile, { compact = false } = {}) {
    const id = profile.id || '';
    const role = normalizeRole(profile.role || 'moderator');
    return `
        <button class="staff-identity role-framed ${compact ? 'compact' : ''}" type="button" data-copy-id="${escapeHtml(id)}" title="${id ? 'Discord ID kopyala' : 'Discord ID yok'}" style="--role-color:${escapeHtml(getRoleColor(role))}">
            ${avatarImg(profile.avatar, 'staff-avatar', profile.name)}
            <span class="staff-copy">
                <strong>${escapeHtml(profile.name || 'Bilinmeyen Yetkili')}</strong>
                <small>Discord ID: ${escapeHtml(id || 'yok')}</small>
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
        ['auth', DOM.authView]
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
        auth: 'admin :: erişim yönetimi'
    };
    if (DOM.pageSubtitle) DOM.pageSubtitle.textContent = subtitles[tabId] || subtitles.dashboard;
    if (tabId === 'auth') loadAuthAdminData();
}

function renderAuthTables({ allowlist = [], roleCache = [], policy = {}, audit = [] } = {}) {
    DOM.allowlistTableBody.innerHTML = allowlist.length
        ? allowlist.map((entry) => `
            <tr class="data-row">
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
        : '<tr><td colspan="4" style="text-align:center; padding:16px;">Allowlist kaydi yok</td></tr>';

    DOM.roleCacheTableBody.innerHTML = roleCache.length
        ? roleCache.map((entry) => `
            <tr class="data-row">
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
        : '<tr><td colspan="4" style="text-align:center; padding:16px;">Role cache kaydi yok</td></tr>';

    DOM.allowlistTableBody.querySelectorAll('.btn-del-allow').forEach(btn => {
        btn.addEventListener('click', () => deleteAllowlist(btn.dataset.email));
    });
    DOM.roleCacheTableBody.querySelectorAll('.btn-del-cache').forEach(btn => {
        btn.addEventListener('click', () => deleteRoleCache(btn.dataset.key));
    });

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
    const filterType = DOM.dateFilter?.value || 'week';
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

    filteredCases.forEach((entry) => {
        const profile = resolveStaffProfile(entry);
        const key = profile.id || (profile.name && !entry.authorMissing ? `name:${profile.name}` : `unknown-author:${entry.id || entry.caseId || entry.userId || 'record'}`);
        const validation = getValidation(entry);

        if (!moderatorMap.has(key)) {
            moderatorMap.set(key, {
                id: profile.id || key,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar,
                count: 0,
                valid: 0,
                invalid: 0,
                pending: 0
            });
        }

        const bucket = moderatorMap.get(key);
        bucket.count += 1;
        if (validation.status === PenaltyStatus.VALID) bucket.valid += 1;
        if (validation.status === PenaltyStatus.INVALID) bucket.invalid += 1;
        if (validation.status === PenaltyStatus.PENDING || validation.status === PenaltyStatus.UNKNOWN) bucket.pending += 1;
        reasonMap.set(entry.reason || 'Bilinmiyor', (reasonMap.get(entry.reason || 'Bilinmiyor') || 0) + 1);
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
        .sort((left, right) => right.count - left.count);

    const management = ranked.filter((entry) => getRoleLevel(entry.role) >= 68);
    const staff = ranked.filter((entry) => getRoleLevel(entry.role) < 68);
    const reasons = Array.from(reasonMap.entries()).sort((left, right) => right[1] - left[1]);

    return {
        staff,
        management,
        reasons,
        topMod: ranked[0] || null,
        topReason: reasons[0] || null,
        filteredCases
    };
}

function renderStats() {
    const { staff, management, topMod, topReason, reasons, filteredCases } = calculateStats();
    
    // Core numbers
    if (DOM.totalCases) DOM.totalCases.textContent = String(filteredCases.length);
    
    const validCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.VALID).length;
    const invalidCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.INVALID).length;
    const pendingCount = filteredCases.filter(c => getValidation(c).status === PenaltyStatus.PENDING).length;
    
    if (DOM.validCases) DOM.validCases.textContent = String(validCount);
    if (DOM.invalidCases) DOM.invalidCases.textContent = String(invalidCount);
    if (DOM.pendingCases) DOM.pendingCases.textContent = String(pendingCount);
    if (DOM.modsCount) DOM.modsCount.textContent = String(staff.length + management.length);

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
    if (DOM.deltaMods) DOM.deltaMods.textContent = String(staff.length + management.length);
    const efficiency = filteredCases.length ? Math.round((validCount / filteredCases.length) * 100) : 0;
    if (DOM.deltaAcc) DOM.deltaAcc.textContent = `${efficiency}%`;
    if (DOM.deltaInv) DOM.deltaInv.textContent = String(invalidCount);
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

function renderTable(search = '') {
    const query = (search || '').trim().toLowerCase();
    const { staff, management } = calculateStats();
    const everyone = [...management, ...staff];
    const filter = (entry) => !query || entry.name.toLowerCase().includes(query) || entry.role.toLowerCase().includes(query);
    const filteredStaff = everyone.filter(filter);
    const tableBody = DOM.staffTableBody || DOM.tableBody;

    if (tableBody) {
        tableBody.innerHTML = filteredStaff.length
            ? filteredStaff.map((entry, index) => renderModRow(entry, index)).join('')
            : '<tr><td colspan="6" style="text-align:center; padding:20px;">Kayıt bulunamadı</td></tr>';
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

    const moderators = Array.from(merged.values())
        .filter((entry) => entry.role && entry.role !== 'viewer' && entry.role !== 'pending' && entry.role !== 'blocked')
        .sort((left, right) => getRankLevel(right.role) - getRankLevel(left.role) || String(left.name).localeCompare(String(right.name), 'tr'));

    DOM.mgmtModList.innerHTML = moderators.length ? moderators.map((entry) => {
        const profile = resolveStaffProfile(entry);
        return `
        <tr class="data-row">
            <td>
                ${staffIdentityHtml(profile)}
            </td>
            <td>${roleBadge(profile.role || entry.role || 'moderator')}</td>
            <td><button class="btn btn-ghost btn-open-role" type="button" data-id="${escapeHtml(profile.id || entry.id || '')}">Düzenle</button></td>
        </tr>
    `;
    }).join('') : '<tr><td colspan="3" class="empty-cell">Yetkili kaydı yok</td></tr>';

    const search = (DOM.caseSearch?.value || '').trim().toLowerCase();
    const period = DOM.casePeriodFilter?.value || 'week';
    const sort = DOM.caseSortFilter?.value || 'newest';
    const filteredCases = state.allCases.filter((entry) => {
        if (!search) return true;
        const profile = resolveStaffProfile(entry);
        return String(entry.id || '').includes(search)
            || String(entry.caseId || '').includes(search)
            || (entry.reason || '').toLowerCase().includes(search)
            || profile.name.toLowerCase().includes(search)
            || profile.id.includes(search);
    }).filter((entry) => isCaseInPeriod(entry, period)).sort((left, right) => compareCasesForAdmin(left, right, sort));

    DOM.mgmtCaseList.innerHTML = filteredCases.length ? filteredCases.map((entry) => {
        const validation = getValidation(entry);
        const profile = resolveStaffProfile(entry);
        return `
            <tr class="data-row">
                <td><button class="case-link" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">#${escapeHtml(String(entry.id || entry.caseId || '-'))}</button></td>
                <td>${staffIdentityHtml(profile, { compact: true })}</td>
                <td>${escapeHtml(entry.reason || '-')}</td>
                <td><span class="status-badge ${escapeHtml(validation.status || 'unknown')}">${escapeHtml(validation.status || 'unknown')}</span></td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="4" class="empty-cell">Ceza kaydı yok</td></tr>';

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
    if (DOM.roleUserNameHint) DOM.roleUserNameHint.textContent = entry.name ? `${entry.name} bulundu` : 'Kullanici secin';
    DOM.roleModal.classList.remove('hidden');
}

function closeRoleModal() {
    DOM.roleModal.classList.add('hidden');
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
    if (!categories.length) {
        DOM.ruleCategoriesList.innerHTML = `
            <button class="cuk-cat-item active" type="button" data-create-defaults="1">
                <div class="cuk-cat-color c-purple"></div>
                <span class="cuk-cat-name">Varsayılan CUK kurallarını oluştur</span>
                <span class="cuk-cat-badge">0</span>
            </button>
        `;
        DOM.ruleCategoriesList.querySelector('[data-create-defaults]')?.addEventListener('click', async () => {
            state.dynamicRules = await Storage.getDynamicRules();
            state.selectedRuleCategory = Object.keys(state.dynamicRules.categories || {})[0] || '';
            renderRuleCategories();
            renderRuleEditor();
        });
        return;
    }

    DOM.ruleCategoriesList.innerHTML = categories.map((category, i) => {
        const catData = state.dynamicRules.categories[category];
        const degreeSteps = (catData.degrees || []).reduce((total, degree) => total + Object.keys(degree.repeats || {}).length, 0);
        const stepCount = Object.keys(catData.repeats || {}).length || degreeSteps;
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
    if (!rule.keywords) rule.keywords = [];
    if (!rule.autoInvalid) rule.autoInvalid = [];
    DOM.noRuleSelected.classList.add('hidden');
    DOM.ruleEditorContent.classList.remove('hidden');
    DOM.editCategoryName.value = category;
    if (DOM.chkEmptyReason) DOM.chkEmptyReason.checked = state.dynamicRules.autoInvalid?.emptyReason !== false;

    renderTags(DOM.keywordTagsArea, DOM.categoryKeywords, rule.keywords || [], 'keywords');
    renderTags(DOM.autoInvalidTagsArea, DOM.autoInvalidInput, rule.autoInvalid || [], 'autoInvalid');
    renderTags(DOM.globalInvalidArea, DOM.globalInvalidInput, state.dynamicRules.autoInvalid?.keywords || [], 'global');

    const repeats = rule.repeats || rule.degrees?.[0]?.repeats || {};
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

    renderTimeline(repeats);
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

    state.dynamicRules.autoInvalid = {
        ...(state.dynamicRules.autoInvalid || { keywords: [] }),
        emptyReason: DOM.chkEmptyReason?.checked !== false
    };

    delete state.dynamicRules.categories[category];
    state.dynamicRules.categories[nextName] = nextRule;
    state.selectedRuleCategory = nextName;
}

async function saveRules() {
    commitRuleEditor();
    await Storage.saveDynamicRules(state.dynamicRules);
    CUKEngine.setRules(state.dynamicRules);
    renderRuleCategories();
    renderRuleEditor();
    renderStats();
    renderTable(DOM.tableSearch.value);
    renderManagement();
    Toast.success('Kurallar kaydedildi', 'CUK editor guncellendi');
}

async function importCukDefaults() {
    if (!confirm('Varsayılan CUK kuralları yüklenecek. Mevcut yerel kuralların üzerine yazılsın mı?')) return;
    await Storage.setSync('dynamicRules', null);
    state.dynamicRules = await Storage.getDynamicRules();
    state.selectedRuleCategory = Object.keys(state.dynamicRules.categories || {})[0] || '';
    CUKEngine.setRules(state.dynamicRules);
    renderRuleCategories();
    renderRuleEditor();
    renderStats();
    renderTable(DOM.tableSearch.value);
    renderManagement();
    Toast.success('CUK', 'Varsayılan kurallar yüklendi ve veriler yeniden hesaplandı');
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

    DOM.pointtrainAdminSummary.innerHTML = `
        <div class="comp-card">
            <div class="comp-label">Calistirma</div>
            <div class="comp-value">${escapeHtml(formatTurkishDateTime(run.createdAt))}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Yetkili</div>
            <div class="comp-value">${run.metrics?.length || 0}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Partial Failure</div>
            <div class="comp-value">${run.partialFailures || 0}</div>
        </div>
    `;

    const metrics = [...(run.metrics || [])].sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

    DOM.pointtrainTableBody.innerHTML = metrics.map((metric, index) => `
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
    `).join('');
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

    renderStats();
    renderTable(DOM.tableSearch?.value || '');
    renderManagement();
    renderRuleCategories();
    renderRuleEditor();
    renderPointtrainTab();
    await loadAuthAdminData();
    bindAvatarFallbacks();
}

async function exportAll() {
    const payload = {
        exportedAt: new Date().toISOString(),
        cases: state.allCases,
        userRegistry: state.userRegistry,
        pointtrain: state.latestPointtrainRun
    };
    downloadFile(`lutheus-admin-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

async function copyDiscordReport() {
    if (state.latestPointtrainRun) {
        await copyText(buildPointtrainMarkdown(state.latestPointtrainRun));
        Toast.success('Kopyalandi', 'Pointtrain markdown panoya alindi');
        return;
    }

    const { staff } = calculateStats();
    const lines = staff.slice(0, 20).map((entry, index) => `${index + 1}. ${entry.name} - ${entry.count} ceza`);
    await copyText(lines.join('\n'));
    Toast.success('Kopyalandi', 'Ozet rapor panoya alindi');
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
    DOM.copyDiscordBtn?.addEventListener('click', copyDiscordReport);
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
    DOM.lookupUserBtn?.addEventListener('click', () => openRoleModal(DOM.roleUserId.value.trim()));
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
        commitRuleEditor();
        renderRuleCategories();
        renderRuleEditor();
        renderStats();
        renderTable(DOM.tableSearch.value);
        Toast.success('Kategori güncellendi');
    });
    DOM.btnCukImport?.addEventListener('click', importCukDefaults);
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
}

async function init() {
    const adminReturnTo = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
        ? chrome.runtime.getURL('src/dashboard/admin.html')
        : new URL('/dashboard', window.location.origin).toString();
    state.session = await AuthService.requireSession({
        admin: true,
        returnTo: adminReturnTo
    });
    if (!canAccessAdmin(state.session.role)) {
        AuthService.redirectToLogin(adminReturnTo, 'forbidden');
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
