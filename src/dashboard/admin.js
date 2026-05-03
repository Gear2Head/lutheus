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

const DOM = {
    totalCases: document.getElementById('totalCases'),
    topModName: document.getElementById('topModName'),
    topModCount: document.getElementById('topModCount'),
    topReasonName: document.getElementById('topReasonName'),
    topReasonCount: document.getElementById('topReasonCount'),
    comparisonGrid: document.getElementById('comparisonGrid'),
    navBtns: document.querySelectorAll('.nav-btn'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    dashboardView: document.getElementById('dashboardView'),
    managementView: document.getElementById('managementView'),
    rulesView: document.getElementById('rulesView'),
    pointtrainView: document.getElementById('pointtrainView'),
    authView: document.getElementById('authView'),
    adminProfileAvatar: document.getElementById('adminProfileAvatar'),
    adminProfileName: document.getElementById('adminProfileName'),
    adminProfileRole: document.getElementById('adminProfileRole'),
    modTableBody: document.getElementById('modTableBody'),
    mgmtSummaryTableBody: document.getElementById('mgmtSummaryTableBody'),
    reasonList: document.getElementById('reasonList'),
    mgmtModList: document.getElementById('mgmtModList'),
    mgmtCaseList: document.getElementById('mgmtCaseList'),
    tableSearch: document.getElementById('tableSearch'),
    caseSearch: document.getElementById('caseSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    revalidateBtn: document.getElementById('revalidateBtn'),
    exportBtn: document.getElementById('exportBtn'),
    copyDiscordBtn: document.getElementById('copyDiscordBtn'),
    roleBtn: document.getElementById('roleBtn'),
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
    lookupUserBtn: document.getElementById('lookupUserBtn'),
    roleUserNameHint: document.getElementById('roleUserNameHint'),
    aiRulesBtn: document.getElementById('aiRulesBtn'),
    btnBackToDashboard: document.getElementById('btnBackToDashboard'),
    btnSaveRules: document.getElementById('btnSaveRules'),
    ruleCategoriesList: document.getElementById('ruleCategoriesList'),
    btnAddCategory: document.getElementById('btnAddCategory'),
    ruleEditorContent: document.getElementById('ruleEditorContent'),
    noRuleSelected: document.getElementById('noRuleSelected'),
    editCategoryName: document.getElementById('editCategoryName'),
    repeatsList: document.getElementById('repeatsList'),
    btnAddRepeat: document.getElementById('btnAddRepeat'),
    categoryKeywords: document.getElementById('categoryKeywords'),
    btnDeleteCategory: document.getElementById('btnDeleteCategory'),
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

function switchTab(tabId) {
    state.activeTab = tabId;
    DOM.navBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });

    [
        ['dashboard', DOM.dashboardView],
        ['management', DOM.managementView],
        ['rules', DOM.rulesView],
        ['pointtrain', DOM.pointtrainView],
        ['auth', DOM.authView]
    ].forEach(([id, view]) => {
        view?.classList.toggle('hidden', tabId !== id);
        view?.classList.toggle('active', tabId === id);
    });

    const subtitles = {
        dashboard: 'Moderasyon Analiz Sistemi v2.0',
        management: 'Yetkili ve case yonetimi',
        rules: 'CUK rule editor',
        pointtrain: 'Sapphire + Discord pointtrain raporu',
        auth: 'Kullanici, rol ve API limit yonetimi'
    };
    DOM.pageSubtitle.textContent = subtitles[tabId] || subtitles.dashboard;
}

function renderAuthTables({ allowlist = [], roleCache = [], policy = {}, audit = [] } = {}) {
    DOM.allowlistTableBody.innerHTML = allowlist.length
        ? allowlist.map((entry) => `
            <tr class="data-row">
                <td>${escapeHtml(entry.email || entry.id || '-')}</td>
                <td>${roleBadge(entry.role || '-')}</td>
                <td>${entry.allowed === false ? 'Kapali' : 'Aktif'}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="text-align:center; padding:16px;">Allowlist kaydi yok</td></tr>';

    DOM.roleCacheTableBody.innerHTML = roleCache.length
        ? roleCache.map((entry) => `
            <tr class="data-row">
                <td>${escapeHtml(entry.identityKey || entry.id || '-')}</td>
                <td>${escapeHtml(entry.displayName || '-')}</td>
                <td>${roleBadge(entry.role || '-')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="text-align:center; padding:16px;">Role cache kaydi yok</td></tr>';

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

function calculateStats() {
    const moderatorMap = new Map();
    const reasonMap = new Map();

    state.allCases.forEach((entry) => {
        const key = entry.authorId || (entry.authorMissing ? 'unknown-author' : entry.authorName) || 'unknown-author';
        const registryEntry = state.userRegistry[entry.authorId] || state.staffDirectory[entry.authorId] || {};
        const validation = getValidation(entry);

        if (!moderatorMap.has(key)) {
            moderatorMap.set(key, {
                id: entry.authorId || '',
                name: registryEntry.name || registryEntry.displayName || entry.authorName || 'Bilinmeyen Yetkili',
                role: normalizeRole(registryEntry.role || 'moderator'),
                avatar: resolveAvatar(registryEntry.avatar || entry.authorAvatar),
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
        topReason: reasons[0] || null
    };
}

function renderStats() {
    const { staff, management, topMod, topReason, reasons } = calculateStats();
    DOM.totalCases.textContent = String(state.allCases.length);
    DOM.topModName.textContent = topMod?.name || '—';
    DOM.topModCount.textContent = `${topMod?.count || 0} islem`;
    DOM.topReasonName.textContent = topReason?.[0] || '—';
    DOM.topReasonCount.textContent = `${topReason?.[1] || 0} kez`;

    DOM.reasonList.innerHTML = reasons.slice(0, 12).map(([name, count]) => `
        <div class="reason-item">
            <span class="reason-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <span class="reason-count">${count}</span>
        </div>
    `).join('');

    DOM.comparisonGrid.innerHTML = `
        <div class="comp-card">
            <div class="comp-label">Staff</div>
            <div class="comp-value">${staff.length}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Yonetim</div>
            <div class="comp-value">${management.length}</div>
        </div>
        <div class="comp-card">
            <div class="comp-label">Son tarama</div>
            <div class="comp-value">${formatTurkishDate(new Date())}</div>
        </div>
    `;
}

function renderModRow(entry, index) {
    return `
        <tr class="data-row">
            <td>${index + 1}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${avatarImg(entry.avatar, 'table-avatar small', entry.name)}
                    <div>
                        <div>${escapeHtml(entry.name)}</div>
                        <small>${escapeHtml(getRoleLabel(entry.role))}</small>
                    </div>
                </div>
            </td>
            <td>${entry.count}</td>
            <td>${entry.valid}</td>
            <td>${entry.invalid}</td>
            <td>
                <button class="btn-view" type="button" data-id="${escapeHtml(entry.id)}" data-name="${escapeHtml(entry.name)}">Detay</button>
            </td>
        </tr>
    `;
}

function renderTable(search = '') {
    const query = search.trim().toLowerCase();
    const { staff, management } = calculateStats();
    const filter = (entry) => !query || entry.name.toLowerCase().includes(query) || entry.role.toLowerCase().includes(query);
    const filteredStaff = staff.filter(filter);
    const filteredManagement = management.filter(filter);

    DOM.modTableBody.innerHTML = filteredStaff.length
        ? filteredStaff.map((entry, index) => renderModRow(entry, index)).join('')
        : '<tr><td colspan="6" style="text-align:center; padding:20px;">Kayit bulunamadi</td></tr>';

    DOM.mgmtSummaryTableBody.innerHTML = filteredManagement.length
        ? filteredManagement.map((entry, index) => renderModRow(entry, index)).join('')
        : '<tr><td colspan="6" style="text-align:center; padding:20px;">Kayit bulunamadi</td></tr>';

    document.querySelectorAll('.btn-view').forEach((button) => {
        button.addEventListener('click', () => openModal({ id: button.dataset.id, name: button.dataset.name }));
    });
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
            role: normalizeRole(entry.role || 'moderator'),
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
            role: normalizeRole(entry.role || merged.get(entry.id)?.role || 'moderator')
        });
    });
    (state.roleCache || []).forEach((entry) => {
        const id = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        if (!id) return;
        merged.set(id, {
            ...(merged.get(id) || {}),
            id,
            name: entry.displayName || merged.get(id)?.name || id,
            role: normalizeRole(entry.role || merged.get(id)?.role || 'moderator')
        });
    });

    const moderators = Array.from(merged.values())
        .filter((entry) => entry.role)
        .sort((left, right) => getRankLevel(right.role) - getRankLevel(left.role) || String(left.name).localeCompare(String(right.name), 'tr'));

    DOM.mgmtModList.innerHTML = moderators.length ? moderators.map((entry) => `
        <tr class="data-row">
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${avatarImg(entry.avatar, 'table-avatar small', entry.name || 'Bilinmiyor')}
                    <div>
                        <div>${escapeHtml(entry.name || 'Bilinmiyor')}</div>
                        <small>${escapeHtml(entry.id || '-')}</small>
                    </div>
                </div>
            </td>
            <td>${roleBadge(entry.role || 'moderator')}</td>
            <td><button class="btn-open-role" type="button" data-id="${escapeHtml(entry.id || '')}">Duzenle</button></td>
        </tr>
    `).join('') : '<tr><td colspan="3" class="empty-cell">Yetkili kaydi yok</td></tr>';

    const search = DOM.caseSearch.value.trim().toLowerCase();
    const filteredCases = state.allCases.filter((entry) => {
        if (!search) return true;
        return String(entry.id || '').includes(search) || (entry.reason || '').toLowerCase().includes(search);
    });

    DOM.mgmtCaseList.innerHTML = filteredCases.length ? filteredCases.map((entry) => {
        const validation = getValidation(entry);
        return `
            <tr class="data-row">
                <td><button class="case-link" type="button" data-case-id="${escapeHtml(String(entry.id || entry.caseId || ''))}">#${escapeHtml(String(entry.id || entry.caseId || '-'))}</button></td>
                <td>${escapeHtml(entry.authorMissing ? 'Bilinmeyen Yetkili' : (entry.authorName || 'Bilinmiyor'))}<small>${escapeHtml(entry.authorId || '-')}</small></td>
                <td>${escapeHtml(entry.reason || '-')}</td>
                <td><span class="status-badge ${escapeHtml(validation.status || 'unknown')}">${escapeHtml(validation.status || 'unknown')}</span></td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="4" class="empty-cell">Ceza kaydi yok</td></tr>';

    document.querySelectorAll('.btn-open-role').forEach((button) => {
        button.addEventListener('click', () => openRoleModal(button.dataset.id));
    });
    DOM.mgmtCaseList.querySelectorAll('.case-link').forEach((button) => {
        button.addEventListener('click', () => {
            const entry = state.allCases.find((item) => String(item.id || item.caseId) === button.dataset.caseId);
            if (entry) openCaseUrl(entry);
        });
    });
    bindAvatarFallbacks();
}

function bindModalSaveHandlers() {
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
    const list = state.allCases
        .filter((entry) => String(entry.authorId || '') === String(moderator.id || '') || entry.authorName === moderator.name)
        .sort((left, right) => (parseDate(right.createdRaw)?.getTime() || 0) - (parseDate(left.createdRaw)?.getTime() || 0));

    DOM.modalTitle.textContent = `${moderator.name} - Ceza geçmişi`;
    DOM.modalContent.innerHTML = list.length ? list.map((entry) => {
        const validation = getValidation(entry);
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
                        <strong>${escapeHtml(entry.authorMissing ? 'Bilinmeyen Yetkili' : (entry.authorName || 'Bilinmiyor'))}</strong>
                        <small>${escapeHtml(entry.authorId || '-')}</small>
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
    DOM.detailModal.classList.remove('hidden');
    bindModalSaveHandlers();
}

function closeModal() {
    DOM.detailModal.classList.add('hidden');
}

function openRoleModal(userId = '') {
    const entry = state.userRegistry[userId] || {};
    DOM.roleUserId.value = userId || '';
    DOM.roleDisplayName.value = entry.name || '';
    DOM.roleSelect.value = normalizeRole(entry.role || 'discord_moderatoru');
    DOM.manualAccuracy.value = entry.manualAccuracy ?? '';
    DOM.roleUserNameHint.textContent = entry.name ? `${entry.name} bulundu` : 'Kullanici secin';
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
    DOM.ruleCategoriesList.innerHTML = categories.map((category) => `
        <button type="button" class="rule-cat-item ${state.selectedRuleCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}">
            ${escapeHtml(category)}
        </button>
    `).join('');

    DOM.ruleCategoriesList.querySelectorAll('.rule-cat-item').forEach((button) => {
        button.addEventListener('click', () => {
            commitRuleEditor();
            state.selectedRuleCategory = button.dataset.category;
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
    DOM.categoryKeywords.value = (rule.keywords || []).join(', ');

    const repeats = rule.repeats || {};
    DOM.repeatsList.innerHTML = Object.keys(repeats).sort((left, right) => Number(left) - Number(right)).map((key) => `
        <div class="repeat-row" data-repeat="${key}" style="display:flex; gap:10px; align-items:center;">
            <span style="min-width:70px;">${key}. tekrar</span>
            <input type="text" data-field="type" value="${escapeHtml(repeats[key].type || '')}" placeholder="type">
            <input type="number" data-field="duration" value="${escapeHtml(String(repeats[key].duration || ''))}" placeholder="dakika">
        </div>
    `).join('');
}

function commitRuleEditor() {
    const category = state.selectedRuleCategory;
    if (!category || !state.dynamicRules.categories[category]) return;

    const nextName = DOM.editCategoryName.value.trim() || category;
    const repeats = {};
    DOM.repeatsList.querySelectorAll('.repeat-row').forEach((row) => {
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
        keywords: DOM.categoryKeywords.value.split(',').map((value) => value.trim()).filter(Boolean),
        repeats
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
    Toast.success('Kurallar kaydedildi', 'CUK editor guncellendi');
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
    const count = DOM.repeatsList.querySelectorAll('.repeat-row').length + 1;
    DOM.repeatsList.insertAdjacentHTML('beforeend', `
        <div class="repeat-row" data-repeat="${count}" style="display:flex; gap:10px; align-items:center;">
            <span style="min-width:70px;">${count}. tekrar</span>
            <input type="text" data-field="type" placeholder="type">
            <input type="number" data-field="duration" placeholder="dakika">
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

    DOM.pointtrainTableBody.innerHTML = (run.metrics || []).map((metric, index) => `
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
    await FirebaseRepository.ensureRolePolicy(state.session?.profile).catch(() => null);
    await FirebaseRepository.seedRoleCacheMembers(state.session?.profile).catch(() => null);

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
    renderTable(DOM.tableSearch.value);
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
    DOM.navBtns.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    DOM.tableSearch?.addEventListener('input', (event) => renderTable(event.target.value));
    DOM.caseSearch?.addEventListener('input', renderManagement);
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
    DOM.btnAddRepeat?.addEventListener('click', addRepeatRow);
    DOM.btnDeleteCategory?.addEventListener('click', deleteRuleCategory);
    DOM.btnSaveRules?.addEventListener('click', saveRules);
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
