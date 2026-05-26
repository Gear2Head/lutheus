// Lutheus CezaRapor - Service Worker v2.2
// Boho integration + Discord Pointtrain orchestration

const LUTHEUS_GUILD_ID = '1223431616081166336';
const DEFAULT_POINTTRAIN_CHANNELS = [
    { id: 'genel-sohbet', label: '💬genel-sohbet', weight: 1.0 },
    { id: 'gorsel-video-odasi', label: '📷görsel-video-odası', weight: 0.8 },
    { id: 'konu-disi', label: '💭konu-dışı', weight: 0.6 }
];
const DEFAULT_POINT_WEIGHTS = {
    punishmentWeight: 1,
    messageWeight: 0.15,
    channelDiversityBonus: 3,
    activeDayBonus: 1.5,
    penaltyFlags: 0
};
const ROLE_ALIASES = {
    kidemli: 'kidemli_discord_moderatoru',
    senior_moderator: 'kidemli_discord_moderatoru',
    moderator: 'discord_moderatoru',
    discord_moderator: 'discord_moderatoru'
};

const ACTIONS = {
    OPEN_DASHBOARD_AND_SCAN: 'OPEN_DASHBOARD_AND_SCAN',
    RUN_AUTONOMOUS_SCAN: 'RUN_AUTONOMOUS_SCAN',
    INJECT_SCRIPTS: 'INJECT_SCRIPTS',
    SEND_TO_TAB: 'SEND_TO_TAB',
    GET_DASHBOARD_TAB: 'GET_DASHBOARD_TAB',
    OPEN_CASE_PAGE: 'OPEN_CASE_PAGE',
    OPEN_ADMIN: 'OPEN_ADMIN',
    CLOSE_TAB: 'CLOSE_TAB',
    CANCEL_AUTONOMOUS_SCAN: 'CANCEL_AUTONOMOUS_SCAN',
    PING: 'PING',
    INTEGRITY_COMPROMISED: 'INTEGRITY_COMPROMISED',
    RUN_POINTTRAIN_SCAN: 'RUN_POINTTRAIN_SCAN',
    OPEN_DISCORD_TAB: 'OPEN_DISCORD_TAB',
    RUN_DISCORD_QUERY: 'RUN_DISCORD_QUERY',
    COLLECT_DISCORD_COUNTS: 'COLLECT_DISCORD_COUNTS',
    CANCEL_POINTTRAIN_SCAN: 'CANCEL_POINTTRAIN_SCAN',
    POINTTRAIN_PING: 'POINTTRAIN_PING',
    RUN_POINTTRAIN_QUERY: 'RUN_POINTTRAIN_QUERY',
    SCAN_PROGRESS_EVENT: 'SCAN_PROGRESS_EVENT',
    POINTTRAIN_PROGRESS_EVENT: 'POINTTRAIN_PROGRESS_EVENT',
    POINTTRAIN_DONE_EVENT: 'POINTTRAIN_DONE_EVENT'
};

let pointtrainCancelled = false;
let autonomousScanCancelled = false;

console.log('Lutheus CezaRapor: Service Worker v2.2 starting...');

function normalizeRole(role) {
    const key = String(role || 'discord_moderatoru').trim().toLowerCase();
    return ROLE_ALIASES[key] || key || 'discord_moderatoru';
}

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('GearTech: Side panel error:', error));

chrome.runtime.onInstalled.addListener((details) => {
    console.log('GearTech: Extension installed/updated', details.reason);
    if (details.reason === 'install') {
        chrome.storage.local.set({
            settings: {
                guildId: LUTHEUS_GUILD_ID,
                autoSaveWeekly: true,
                scanDelay: 2000,
                theme: 'lutheus'
            },
            pointtrainSettings: {
                guildId: LUTHEUS_GUILD_ID,
                discordGuildId: LUTHEUS_GUILD_ID,
                datePreset: 'last7',
                startDate: '',
                endDate: '',
                channels: DEFAULT_POINTTRAIN_CHANNELS
            },
            pointWeights: DEFAULT_POINT_WEIGHTS,
            cases: [],
            weeklySnapshots: {},
            scanLogs: [],
            pointtrainRuns: []
        });
    }
});

function getLocal(key) {
    return new Promise((resolve) => chrome.storage.local.get([key], (result) => resolve(result[key])));
}

function setLocal(key, value) {
    return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
}

function getSync(key) {
    return new Promise((resolve) => {
        if (!chrome.storage.sync) return resolve(getLocal(key));
        chrome.storage.sync.get([key], (result) => resolve(result[key]));
    });
}

function normalizeText(value) {
    return (value || '')
        .toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function formatDateForDiscord(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function emitRuntimeEvent(action, payload) {
    chrome.runtime.sendMessage({ action, payload }).catch?.(() => undefined);
}

async function injectContentScripts(tabId) {
    try {
        const pingResult = await chrome.tabs.sendMessage(tabId, { action: ACTIONS.PING });
        if (pingResult?.success) return true;
    } catch {
        // continue with injection
    }

    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/scraper.js'] });
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/navigation.js'] });
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/main.js'] });
        await new Promise((resolve) => setTimeout(resolve, 800));
        return true;
    } catch (error) {
        console.error('Lutheus: Failed to inject Sapphire scripts:', error);
        return false;
    }
}

async function injectDiscordScripts(tabId) {
    try {
        const pingResult = await chrome.tabs.sendMessage(tabId, { action: ACTIONS.POINTTRAIN_PING });
        if (pingResult?.success) return true;
    } catch {
        // continue with injection
    }

    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/discord/selectors.js'] });
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/discord/parser.js'] });
        await chrome.scripting.executeScript({ target: { tabId }, files: ['src/discord/search.js'] });
        await new Promise((resolve) => setTimeout(resolve, 800));
        return true;
    } catch (error) {
        console.error('Lutheus: Failed to inject Discord scripts:', error);
        return false;
    }
}

function waitForTabLoad(tabId, timeout = 15000) {
    return new Promise((resolve) => {
        const start = Date.now();

        const check = async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === 'complete') return resolve(true);
            } catch {
                return resolve(false);
            }

            if (Date.now() - start > timeout) return resolve(false);
            setTimeout(check, 300);
        };

        check();
    });
}

async function openDashboardTab(guildId = LUTHEUS_GUILD_ID) {
    const url = `https://dashboard.sapph.xyz/${guildId}/moderation/cases`;
    const tabs = await chrome.tabs.query({ url: 'https://dashboard.sapph.xyz/*' });

    let tab;
    if (tabs.length > 0) {
        tab = tabs[0];
        if (!tab.url?.includes('/moderation/cases')) {
            await chrome.tabs.update(tab.id, { url, active: true });
        } else {
            await chrome.tabs.update(tab.id, { active: true });
        }
    } else {
        tab = await chrome.tabs.create({ url, active: true });
    }

    await waitForTabLoad(tab.id, 20000);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await injectContentScripts(tab.id);
    return tab;
}

async function openDiscordTab(guildId = LUTHEUS_GUILD_ID) {
    const guildUrl = `https://discord.com/channels/${guildId}`;
    const tabs = await chrome.tabs.query({ url: 'https://discord.com/channels/*' });
    let tab = tabs.find((item) => item.url?.includes(`/channels/${guildId}`));

    if (!tab) {
        tab = tabs[0];
    }

    if (tab) {
        if (!tab.url?.includes(`/channels/${guildId}`)) {
            await chrome.tabs.update(tab.id, { url: guildUrl, active: true });
        } else {
            await chrome.tabs.update(tab.id, { active: true });
        }
    } else {
        tab = await chrome.tabs.create({ url: guildUrl, active: true });
    }

    await waitForTabLoad(tab.id, 20000);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await injectDiscordScripts(tab.id);
    return tab;
}

async function findDiscordTab(guildId) {
    const tabs = await chrome.tabs.query({ url: '*://discord.com/*' });
    return tabs.find(t => t.url?.includes(guildId)) || tabs[0];
}

async function sendToContentScript(tabId, message, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            if (attempt < retries) {
                await injectContentScripts(tabId);
                await new Promise((resolve) => setTimeout(resolve, 500));
            } else {
                console.error('GearTech: Send to Sapphire content failed:', error);
                return null;
            }
        }
    }
    return null;
}

async function sendToDiscordScript(tabId, message, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            if (attempt < retries) {
                await injectDiscordScripts(tabId);
                await new Promise((resolve) => setTimeout(resolve, 500));
            } else {
                console.error('GearTech: Send to Discord content failed:', error);
                return null;
            }
        }
    }
    return null;
}

function parseDateStr(str) {
    if (!str) return null;
    // DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}T00:00:00`);
    // YYYY-MM-DD or ISO
    const date = new Date(str);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isInDateRange(caseData, startDate, endDate) {
    if (!startDate && !endDate) return true;

    let caseDate = parseDateStr(caseData.createdRaw);
    if (!caseDate && caseData.createdAt) caseDate = new Date(caseData.createdAt);
    if (!caseDate && caseData.scrapedAt) caseDate = new Date(caseData.scrapedAt);
    if (!caseDate) return true; // ASSUME: unknown dates pass through

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (caseDate < start) return false;
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (caseDate > end) return false;
    }
    return true;
}

async function updateRegistryFromCases(cases) {
    const registry = (await getLocal('userRegistry')) || (await getSync('userRegistry')) || {};
    const directory = (await getLocal('staffDirectory')) || (await getSync('staffDirectory')) || {};
    const roleCache = (await getLocal('roleCache')) || [];
    let changedRegistry = false;
    let changedDirectory = false;
    const findRoleCacheEntry = (discordId) => (roleCache || []).find((entry) => {
        const cacheId = entry.discordId || String(entry.identityKey || entry.id || '').replace(/^discord:/, '');
        return cacheId === discordId;
    });

    for (const entry of cases) {
        if (entry.authorId && entry.authorName) {
            const authorId = entry.authorId;
            const authorName = entry.authorName;
            const previous = registry[authorId] || {};
            const roleEntry = findRoleCacheEntry(authorId);
            const aliases = Array.from(new Set([
                ...(previous.aliases || []),
                previous.name,
                authorName
            ].filter(Boolean)));
            
            registry[authorId] = {
                ...previous,
                id: authorId,
                name: authorName,
                avatar: entry.authorAvatar || previous.avatar || null,
                role: roleEntry ? normalizeRole(roleEntry.role) : (previous.role || null),
                aliases,
                source: previous.source || 'sapphire-intercept-listener',
                scanCount: Number(previous.scanCount || 0) + 1,
                lastSeen: Date.now()
            };
            changedRegistry = true;
        }

        if (entry.userId && entry.user) {
            const userId = entry.userId;
            const user = entry.user;
            const previous = registry[userId] || {};
            registry[userId] = {
                ...previous,
                id: userId,
                name: user,
                avatar: entry.userAvatar || previous.avatar || null,
                role: previous.role,
                aliases: Array.from(new Set([...(previous.aliases || []), previous.name, user].filter(Boolean))),
                source: previous.source || 'sapphire-intercept-target',
                scanCount: Number(previous.scanCount || 0) + 1,
                lastSeen: Date.now()
            };
            changedRegistry = true;
        }

        if (entry.authorId || (entry.authorName && !isUnknownAuthorName(entry.authorName))) {
            const roleEntry = entry.authorId ? findRoleCacheEntry(entry.authorId) : null;
            if (!roleEntry) continue;
            const key = entry.authorId || `name:${entry.authorName}`;
            const aliases = [entry.authorName].filter(Boolean);
            directory[key] = {
                ...(directory[key] || {}),
                sapphireAuthorId: entry.authorId || directory[key]?.sapphireAuthorId || '',
                discordUserId: directory[key]?.discordUserId || entry.authorId || '',
                displayName: entry.authorName || directory[key]?.displayName || 'Bilinmiyor',
                avatar: entry.authorAvatar || directory[key]?.avatar || null,
                role: normalizeRole(roleEntry.role || directory[key]?.role || 'moderator'),
                aliases: Array.from(new Set([...(directory[key]?.aliases || []), ...aliases])),
                source: directory[key]?.source || 'sapphire-intercept-listener',
                scanCount: Number(directory[key]?.scanCount || 0) + 1,
                lastSeen: Date.now(),
                updatedAt: new Date().toISOString()
            };
            changedDirectory = true;
        }
    }

    if (changedRegistry) {
        await setLocal('userRegistry', registry);
    }
    if (changedDirectory) {
        await setLocal('staffDirectory', directory);
    }
}

function isCaseIdLike(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^\d{4,24}$/.test(text)) return true;
    if (!/^[A-Za-z0-9_-]{4,24}$/.test(text)) return false;
    if (/^\d{17,20}$/.test(text)) return false;
    if (/^(mute|ban|warn|kick|timeout|user|reason|author|duration|created|bilinmiyor|sunucu|discord|yetkili)$/i.test(text)) return false;
    return /[A-Za-z]/.test(text) && /\d/.test(text);
}

function isUnknownAuthorName(value) {
    return /^(unknown|bilinmiyor|bilinmeyen yetkili)$/i.test(String(value || '').trim());
}

function normalizeDurationMs(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return null;
    const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|gün|gun|saat|dakika)$/i);
    if (!match) return null;
    const amount = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(amount)) return null;
    const multipliers = {
        ms: 1,
        s: 1000,
        sec: 1000,
        secs: 1000,
        second: 1000,
        seconds: 1000,
        m: 60 * 1000,
        min: 60 * 1000,
        mins: 60 * 1000,
        minute: 60 * 1000,
        minutes: 60 * 1000,
        dakika: 60 * 1000,
        h: 60 * 60 * 1000,
        hr: 60 * 60 * 1000,
        hrs: 60 * 60 * 1000,
        hour: 60 * 60 * 1000,
        hours: 60 * 60 * 1000,
        saat: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        gün: 24 * 60 * 60 * 1000,
        gun: 24 * 60 * 60 * 1000
    };
    return Math.round(amount * multipliers[match[2].toLowerCase()]);
}

function validateCaseForStorage(entry = {}) {
    if (!String(entry.id || entry.caseId || '').trim()) return { valid: false, reason: 'missing_case_id' };
    if (!entry.userId && !entry.user && !entry.authorId && !entry.authorName) return { valid: false, reason: 'missing_identity' };
    return { valid: true };
}

function buildSourceMismatch(previous, next) {
    if (!previous || previous.capturedVia === next.capturedVia) return null;
    const fields = ['userId', 'authorId', 'reason', 'type', 'duration'];
    const mismatches = fields.filter((field) => previous[field] && next[field] && String(previous[field]) !== String(next[field]));
    return mismatches.length
        ? { previousSource: previous.capturedVia, nextSource: next.capturedVia, fields: mismatches, detectedAt: new Date().toISOString() }
        : null;
}

async function storageSaveCases(newCases, append = true) {
    const existing = append
        ? await new Promise((resolve) => chrome.storage.local.get(['cases'], (result) => resolve(result.cases || [])))
        : [];

    const caseMap = new Map(existing.map((entry) => [String(entry.id || entry.caseId || ''), entry]));

    const quarantined = [];
    for (const entry of newCases) {
        const validation = validateCaseForStorage(entry);
        if (!validation.valid) {
            quarantined.push({ entry, reason: validation.reason, quarantinedAt: new Date().toISOString() });
            continue;
        }
        const normalized = normalizeCaseForStorage(entry);
        if (!normalized.id) continue;
        const previous = caseMap.get(normalized.id);
        caseMap.set(normalized.id, mergeCaseForStorage(previous, normalized));
    }

    const allCases = Array.from(caseMap.values()).sort(compareStoredCases);
    await new Promise((resolve) => chrome.storage.local.set({ cases: allCases }, resolve));
    if (quarantined.length) {
        const current = await getLocal('caseQuarantine') || [];
        await setLocal('caseQuarantine', [...quarantined, ...current].slice(0, 100));
    }
    return allCases.length;
}

function normalizeCaseForStorage(entry = {}) {
    const sourceUrl = entry.sourceUrl || '';
    const urlCaseId = String(sourceUrl.match(/\/cases\/([^/?#]+)/)?.[1] || '');
    const id = String(entry.id || entry.caseId || urlCaseId || '').trim();
    const embeddedAuthorId = String(entry.authorId || entry.moderatorId || entry.authorName || entry.moderator || '').match(/\d{17,20}/)?.[0] || '';
    const authorId = String(entry.authorId || entry.moderatorId || embeddedAuthorId || '');
    const authorName = String(entry.authorName || entry.moderator || '').replace(authorId, '').trim();
    const incomingReason = String(entry.reason || '').trim();
    const safeReason = isCaseIdLike(incomingReason) ? '' : incomingReason;
    const duration = entry.duration || '';

    return {
        ...entry,
        id,
        caseId: id,
        guildId: String(entry.guildId || entry.rawData?.guildId || entry.rawData?.guild_id || LUTHEUS_GUILD_ID),
        user: entry.user || entry.username || 'Bilinmiyor',
        userId: String(entry.userId || ''),
        authorId,
        authorName: authorName || (entry.authorMissing ? 'Bilinmeyen Yetkili' : 'Bilinmiyor'),
        authorMissing: Boolean(entry.authorMissing || (!authorId && (!authorName || isUnknownAuthorName(authorName)))),
        reason: safeReason,
        duration,
        durationMs: Number.isFinite(Number(entry.durationMs)) ? Number(entry.durationMs) : normalizeDurationMs(duration),
        type: entry.type || 'unknown',
        createdRaw: entry.createdRaw || entry.createdAt || '',
        sourceUrl,
        scrapedAt: Number(entry.scrapedAt || Date.now()),
        lastSeen: Date.now(),
        source: entry.source || (entry.capturedVia === 'network_interceptor' ? 'sapphire-network' : 'sapphire-dashboard'),
        capturedVia: entry.capturedVia || 'dom_scraper',
        rawData: entry.rawData || null
    };
}

function mergeCaseForStorage(previous, next) {
    if (!previous) return next;

    const merged = {
        ...previous,
        ...next,
        user: next.user && next.user !== 'Bilinmiyor' ? next.user : previous.user,
        authorName: next.authorName && !isUnknownAuthorName(next.authorName) ? next.authorName : previous.authorName,
        authorId: next.authorId || previous.authorId || '',
        userId: next.userId || previous.userId || '',
        reason: next.reason || previous.reason || '',
        duration: next.duration || previous.duration || '',
        durationMs: next.durationMs ?? previous.durationMs ?? null,
        type: next.type && next.type !== 'unknown' ? next.type : previous.type,
        createdRaw: next.createdRaw || previous.createdRaw || '',
        authorAvatar: next.authorAvatar || previous.authorAvatar || null,
        userAvatar: next.userAvatar || previous.userAvatar || null,
        note: previous.note,
        reviewStatus: previous.reviewStatus,
        manualOverride: previous.manualOverride,
        assignee: previous.assignee,
        validationStatus: previous.validationStatus || next.validationStatus,
        validationReason: previous.validationReason || next.validationReason,
        lastSeen: Date.now()
    };
    const mismatch = buildSourceMismatch(previous, merged);
    if (mismatch) merged.sourceMismatch = mismatch;
    else if (previous.sourceMismatch) merged.sourceMismatch = previous.sourceMismatch;
    return merged;
}

function parseStoredCaseTime(entry = {}) {
    const candidates = [entry.createdRaw, entry.createdAt, entry.scrapedAt, entry.lastSeen];
    for (const value of candidates) {
        if (!value) continue;
        if (typeof value === 'number') return value;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date.getTime();
    }
    return 0;
}

function compareStoredCases(left, right) {
    const diff = parseStoredCaseTime(right) - parseStoredCaseTime(left);
    if (diff) return diff;
    return String(right.id || '').localeCompare(String(left.id || ''));
}

async function saveScanRun(run) {
    const runs = (await getLocal('scanRuns')) || [];
    runs.unshift(run);
    await setLocal('scanRuns', runs.slice(0, 30));
    await setLocal('latestScanRun', run);
}

async function runAutonomousScan(options = {}) {
    autonomousScanCancelled = false;
    const {
        guildId = LUTHEUS_GUILD_ID,
        pages = null,
        startDate = null,
        endDate = null,
        scanDelay = 2000,
        scanMode = 'fast',
        enrichDetails = false,
        detailLimit = 0,
        retryCount = 1,
        onProgress = null,
        onComplete = null
    } = options;
    const startedAt = new Date().toISOString();
    const runId = `scan-${Date.now()}`;
    const effectiveMode = enrichDetails || scanMode === 'detail' ? 'detail' : 'fast';
    const failures = [];

    const parsedStart = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
    const parsedEnd = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;

    const tab = await openDashboardTab(guildId);
    const tabId = tab.id;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    let pageInfo = null;
    for (let attempt = 0; attempt < 3 && !pageInfo?.totalPages && !pageInfo?.total; attempt++) {
        if (attempt > 0) {
            await injectContentScripts(tabId);
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        pageInfo = await sendToContentScript(tabId, { action: 'GET_PAGE_INFO' });
    }

    const detectedTotalPages = Number(pageInfo?.totalPages || pageInfo?.total || 0);
    const detectedTotalCases = Number(pageInfo?.totalCases || 0);

    if (!detectedTotalPages) {
        const failedRun = {
            id: runId,
            mode: effectiveMode,
            guildId,
            totalPages: 0,
            totalCases: 0,
            pagesScanned: 0,
            casesFound: 0,
            failures: [{ page: null, error: 'Page info unavailable' }],
            startedAt,
            finishedAt: new Date().toISOString(),
            success: false
        };
        await saveScanRun(failedRun);
        return { success: false, error: 'Page info unavailable', scanRun: failedRun };
    }

    const pagesToScan = pages?.length ? pages : Array.from({ length: detectedTotalPages }, (_, index) => index + 1);
    let allCases = [];
    let scannedCount = 0;
    let duplicatePageHits = 0;
    let previousPageSignature = '';

    for (const pageNum of pagesToScan) {
        if (autonomousScanCancelled) {
            failures.push({ page: pageNum, error: 'SCAN_CANCELLED' });
            break;
        }

        if (pageInfo.current !== pageNum) {
            const previousFirstCase = pageInfo.firstCase || '';
            const navigated = await sendToContentScript(tabId, { action: 'GO_TO_PAGE', page: pageNum });
            if (!navigated?.success) {
                failures.push({ page: pageNum, error: navigated?.error || 'PAGE_NAV_FAILED' });
                scannedCount++;
                continue;
            }
            const waited = await sendToContentScript(tabId, {
                action: 'WAIT_FOR_PAGE',
                page: pageNum,
                previousFirstCase,
                timeout: Math.max(6000, scanDelay * 4)
            });
            if (!waited?.success) {
                failures.push({ page: pageNum, error: waited?.error || 'PAGE_NAV_TIMEOUT' });
                scannedCount++;
                continue;
            }
            pageInfo = await sendToContentScript(tabId, { action: 'GET_PAGE_INFO' }) || pageInfo;
        }

        let result = await sendToContentScript(tabId, { action: 'SCRAPE_PAGE' });
        if (!result?.success || !Array.isArray(result.data)) {
            for (let attempt = 0; attempt < retryCount; attempt++) {
                await injectContentScripts(tabId);
                await new Promise((resolve) => setTimeout(resolve, 800));
                const retry = await sendToContentScript(tabId, { action: 'SCRAPE_PAGE' });
                if (retry?.success && Array.isArray(retry.data)) {
                    result = retry;
                    break;
                }
            }

            if (!result?.success || !Array.isArray(result.data)) {
                failures.push({
                    page: pageNum,
                    error: result?.error || 'SCRAPE_PAGE_FAILED'
                });
                scannedCount++;
                emitRuntimeEvent(ACTIONS.SCAN_PROGRESS_EVENT, {
                    runId,
                    currentPage: pageNum,
                    totalPages: pagesToScan.length,
                    scannedCount,
                    casesFound: allCases.length,
                    failures: failures.length
                });
                continue;
            }
        }
        if (result?.success && Array.isArray(result.data)) {
            let filtered = result.data.filter((entry) => isInDateRange(entry, parsedStart, parsedEnd));
            const pageSignature = `${pageNum}:${filtered.map((entry) => entry.id || entry.caseId).filter(Boolean).join(',')}`;
            if (pageSignature === previousPageSignature) {
                duplicatePageHits += 1;
                failures.push({ page: pageNum, error: 'DUPLICATE_PAGE_SIGNATURE' });
                if (duplicatePageHits > Math.max(1, retryCount)) {
                    break;
                }
            } else {
                duplicatePageHits = 0;
                previousPageSignature = pageSignature;
            }
            if (effectiveMode === 'detail' && filtered.length) {
                const limit = detailLimit > 0 ? detailLimit : filtered.length;
                const enriched = await enrichCaseDetails(guildId, filtered.slice(0, limit), scanDelay, (payload) => {
                    if (onProgress) {
                        onProgress({
                            currentPage: pageNum,
                            totalPages: pagesToScan.length,
                            scannedCount,
                            casesFound: allCases.length,
                            detail: payload
                        });
                    }
                });
                const enrichedMap = new Map(enriched.map((entry) => [entry.id || entry.caseId, entry]));
                filtered = filtered.map((entry) => enrichedMap.get(entry.id || entry.caseId) || entry);
            }
            allCases = allCases.concat(filtered);
            if (result.userInfo) {
                await setLocal('activeUser', result.userInfo);
            }
        }

        scannedCount++;
        pageInfo = await sendToContentScript(tabId, { action: 'GET_PAGE_INFO' }) || pageInfo;

        if (onProgress) {
            onProgress({
                currentPage: pageNum,
                totalPages: pagesToScan.length,
                scannedCount,
                casesFound: allCases.length,
                totalCases: detectedTotalCases,
                visibleRows: result.data.length
            });
        }
        emitRuntimeEvent(ACTIONS.SCAN_PROGRESS_EVENT, {
            runId,
            currentPage: pageNum,
            totalPages: pagesToScan.length,
            scannedCount,
            casesFound: allCases.length,
            totalCases: detectedTotalCases,
            visibleRows: result?.data?.length || 0,
            failures: failures.length
        });
    }

    if (allCases.length > 0) {
        await storageSaveCases(allCases, true);
        if (typeof activeJobId !== 'undefined' && activeJobId) {
            await forwardToVercelIngest(allCases, activeJobId, `https://dashboard.sapph.xyz/${guildId}/moderation/cases`);
        }
    }

    if (onComplete) {
        onComplete({ success: true, tabId, totalCases: allCases.length });
    }

    const scanRun = {
        id: runId,
        mode: effectiveMode,
        guildId,
        totalPages: detectedTotalPages,
        totalCases: detectedTotalCases || allCases.length,
        pagesRequested: pagesToScan.length,
        pagesScanned: scannedCount,
        casesFound: allCases.length,
        authorMissingCount: allCases.filter((entry) => entry.authorMissing || !entry.authorId).length,
        duplicatePageHits,
        failures,
        startedAt,
        finishedAt: new Date().toISOString(),
        success: !autonomousScanCancelled
    };
    await saveScanRun(scanRun);

    return { success: true, cancelled: autonomousScanCancelled, tabId, cases: allCases, scanRun };
}

async function enrichCaseDetails(guildId, cases, scanDelay = 1200, onDetailProgress = null) {
    const enriched = [];
    let detailTab = null;

    try {
        for (let index = 0; index < cases.length; index++) {
            const entry = cases[index];
            const caseId = entry.id || entry.caseId;
            if (!caseId) {
                enriched.push(entry);
                continue;
            }

            const url = entry.sourceUrl || `https://dashboard.sapph.xyz/${guildId}/moderation/cases/${caseId}`;
            if (!detailTab) {
                detailTab = await chrome.tabs.create({ url, active: false });
            } else {
                await chrome.tabs.update(detailTab.id, { url, active: false });
            }

            await waitForTabLoad(detailTab.id, 15000);
            await new Promise((resolve) => setTimeout(resolve, Math.max(600, scanDelay)));
            await injectContentScripts(detailTab.id);
            const result = await sendToContentScript(detailTab.id, { action: 'SCRAPE_CASE_DETAIL' }, 3);
            enriched.push(result?.success ? { ...entry, ...(result.detail || {}) } : {
                ...entry,
                detailError: result?.error || 'DETAIL_SCRAPE_FAILED'
            });

            if (onDetailProgress) {
                onDetailProgress({
                    current: index + 1,
                    total: cases.length,
                    caseId
                });
            }
        }
    } finally {
        if (detailTab?.id) {
            await chrome.tabs.remove(detailTab.id).catch?.(() => undefined);
        }
    }

    return enriched;
}

async function getPointtrainSettings(override = {}) {
    const stored = (await getSync('pointtrainSettings')) || (await getLocal('pointtrainSettings')) || {};
    return {
        guildId: override.guildId || stored.guildId || LUTHEUS_GUILD_ID,
        discordGuildId: override.discordGuildId || stored.discordGuildId || LUTHEUS_GUILD_ID,
        datePreset: override.datePreset || stored.datePreset || 'last7',
        startDate: override.startDate || stored.startDate || '',
        endDate: override.endDate || stored.endDate || '',
        channels: override.channels?.length ? override.channels : (stored.channels?.length ? stored.channels : DEFAULT_POINTTRAIN_CHANNELS)
    };
}

async function getPointWeights(override = {}) {
    const stored = (await getSync('pointWeights')) || (await getLocal('pointWeights')) || {};
    return {
        ...DEFAULT_POINT_WEIGHTS,
        ...stored,
        ...override
    };
}

function buildStaffEntries(cases, registry, directory) {
    const staffMap = new Map();

    cases.forEach((entry) => {
        const embeddedId = String(entry.authorId || entry.authorName || '').match(/\d{17,20}/)?.[0] || '';
        const authorId = entry.authorId || embeddedId;
        if (!authorId && !entry.authorName) return;

        const key = authorId || normalizeText(entry.authorName);
        const registryEntry = registry[authorId] || {};
        const directoryEntry = directory[authorId] || directory[`name:${entry.authorName}`] || {};
        const cleanName = String(entry.authorName || '').replace(authorId, '').trim();
        const aliases = Array.from(new Set([
            cleanName,
            registryEntry.name,
            directoryEntry.displayName,
            ...(directoryEntry.aliases || [])
        ].filter(Boolean)));

        if (!staffMap.has(key)) {
            staffMap.set(key, {
                id: authorId || directoryEntry.discordUserId || key,
                sapphireAuthorId: authorId || '',
                displayName: registryEntry.name || directoryEntry.displayName || cleanName || entry.authorName || 'Bilinmiyor',
                avatar: registryEntry.avatar || directoryEntry.avatar || entry.authorAvatar || null,
                role: registryEntry.role || directoryEntry.role || 'moderator',
                aliases,
                searchTerm: directoryEntry.searchTerm || aliases[0] || cleanName || authorId || key,
                sapphirePunishments: 0
            });
        }

        staffMap.get(key).sapphirePunishments += 1;
    });

    return Array.from(staffMap.values()).sort((left, right) => right.sapphirePunishments - left.sapphirePunishments);
}

function computePointtrainMetric(staff, queryResult, weights) {
    const punishmentPoints = staff.sapphirePunishments * weights.punishmentWeight;
    const messagePoints = queryResult.count * weights.messageWeight;
    const channelCount = queryResult.matchedChannels?.length || 0;
    const channelBonus = channelCount * weights.channelDiversityBonus;
    const activeDays = queryResult.activeDays || 0;
    const activeDayBonus = activeDays * weights.activeDayBonus;
    const penalties = queryResult.penaltyFlags || weights.penaltyFlags || 0;
    const weightedScore = Number((punishmentPoints + messagePoints + channelBonus + activeDayBonus - penalties).toFixed(2));

    return {
        ...staff,
        discordMessageCount: queryResult.count,
        channelCount,
        activeDays,
        matchedChannels: queryResult.matchedChannels || [],
        weightedScore,
        breakdown: {
            punishmentPoints,
            messagePoints,
            channelBonus,
            activeDayBonus,
            penalties
        },
        selectorHealth: queryResult.selectorHealth || { hasSummary: false }
    };
}

async function savePointtrainRun(run) {
    const runs = (await getLocal('pointtrainRuns')) || [];
    runs.unshift(run);
    await setLocal('pointtrainRuns', runs.slice(0, 30));
}

async function cacheMessageCount(key, payload) {
    const cache = (await getLocal('messageCountCache')) || {};
    cache[key] = {
        ...payload,
        cachedAt: new Date().toISOString()
    };
    await setLocal('messageCountCache', cache);
}

async function runPointtrainScan(options = {}) {
    pointtrainCancelled = false;

    const settings = await getPointtrainSettings(options.settings || {});
    const weights = await getPointWeights(options.weights || {});
    const cases = (await getLocal('cases')) || [];
    const registry = (await getSync('userRegistry')) || {};
    const directory = (await getSync('staffDirectory')) || {};
    const staffEntries = buildStaffEntries(cases, registry, directory);
    let discordTab = await findDiscordTab(settings.discordGuildId);
    if (!discordTab) {
        discordTab = await openDiscordTab(settings.discordGuildId);
    }
    const metrics = [];
    const failures = [];

    for (let index = 0; index < staffEntries.length; index++) {
        if (pointtrainCancelled) {
            break;
        }

        const staff = staffEntries[index];
        const payload = {
            staff,
            channels: settings.channels,
            dateRange: {
                after: formatDateForDiscord(settings.startDate || ''),
                before: formatDateForDiscord(settings.endDate || '')
            },
            guildId: settings.discordGuildId
        };

        const cacheKey = JSON.stringify({
            staff: staff.sapphireAuthorId || staff.displayName,
            channels: settings.channels.map((channel) => channel.id),
            after: payload.dateRange.after,
            before: payload.dateRange.before
        });

        const cached = ((await getLocal('messageCountCache')) || {})[cacheKey];
        let result;

        if (cached) {
            result = cached;
        } else {
            result = await sendToDiscordScript(discordTab.id, {
                action: ACTIONS.RUN_POINTTRAIN_QUERY,
                payload
            });

            if (result?.success) {
                await cacheMessageCount(cacheKey, result);
            }
        }

        if (!result?.success) {
            failures.push({
                staffId: staff.sapphireAuthorId || staff.id,
                displayName: staff.displayName,
                error: result?.error || 'QUERY_FAILED'
            });
            metrics.push({
                ...staff,
                discordMessageCount: 0,
                channelCount: settings.channels.length,
                activeDays: 0,
                matchedChannels: settings.channels.map((channel) => channel.id),
                weightedScore: Number((staff.sapphirePunishments * weights.punishmentWeight).toFixed(2)),
                breakdown: {
                    punishmentPoints: staff.sapphirePunishments * weights.punishmentWeight,
                    messagePoints: 0,
                    channelBonus: 0,
                    activeDayBonus: 0,
                    penalties: 0
                },
                selectorHealth: { hasSummary: false }
            });
        } else {
            metrics.push(computePointtrainMetric(staff, result, weights));
        }

        emitRuntimeEvent(ACTIONS.POINTTRAIN_PROGRESS_EVENT, {
            current: index + 1,
            total: staffEntries.length,
            staff: staff.displayName,
            failures: failures.length
        });
    }

    metrics.sort((left, right) => right.weightedScore - left.weightedScore);

    const run = {
        id: `ptr-${Date.now()}`,
        createdAt: new Date().toISOString(),
        settings,
        weights,
        metrics,
        partialFailures: failures.length,
        failures
    };

    await savePointtrainRun(run);
    await setLocal('latestPointtrainRun', run);
    emitRuntimeEvent(ACTIONS.POINTTRAIN_DONE_EVENT, run);

    return run;
}

let activeJobId = null;

async function forwardToVercelIngest(records, jobId, sourceUrl, finished = false) {
    try {
        const session = await new Promise(resolve => chrome.storage.local.get(['lutheus:session', 'session'], (res) => resolve(res['lutheus:session'] || res['session'] || null)));
        const idToken = session?.idToken;
        if (!idToken) {
            console.warn('[Lutheus SW] No idToken found in storage for Vercel ingest.');
            return;
        }

        const settings = await new Promise(resolve => chrome.storage.sync.get(['settings'], (res) => resolve(res.settings || {})));
        const guildId = settings.guildId || '1223431616081166336';
        
        const config = await new Promise(resolve => chrome.storage.local.get(['appConfig'], (res) => resolve(res.appConfig || {})));
        const apiBase = config.vercelAuthBaseUrl || 'https://lutheus.vercel.app';
        const url = `${apiBase.replace(/\/+$/, '')}/api/scan/sapphire/ingest`;

        console.log(`[Lutheus SW] Forwarding ${records.length} records to Vercel API (finished=${finished}): ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                jobId,
                guildId,
                sourceUrl,
                items: records,
                finished
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error('[Lutheus SW] Ingest failed:', data.error || response.statusText);
        } else {
            console.log('[Lutheus SW] Ingest successful:', data);
        }
    } catch (err) {
        console.error('[Lutheus SW] Failed to forward to Vercel ingest:', err.message);
    }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === ACTIONS.POINTTRAIN_PROGRESS_EVENT || request.action === ACTIONS.POINTTRAIN_DONE_EVENT) {
        return false;
    }

    (async () => {
        try {
            switch (request.action) {
                case ACTIONS.OPEN_DASHBOARD_AND_SCAN: {
                    const tab = await openDashboardTab(request.guildId || LUTHEUS_GUILD_ID);
                    sendResponse({ success: true, tabId: tab.id });
                    break;
                }

                case ACTIONS.RUN_AUTONOMOUS_SCAN: {
                    const result = await runAutonomousScan(request.options || {});
                    sendResponse(result);
                    break;
                }

                case ACTIONS.CANCEL_AUTONOMOUS_SCAN: {
                    autonomousScanCancelled = true;
                    sendResponse({ success: true });
                    break;
                }

                case 'RUN_SAPPHIRE_SYNC': {
                    const jobId = request.jobId;
                    activeJobId = jobId;
                    console.log(`[Lutheus SW] Running Sapphire V2 sync for jobId: ${jobId}`);

                    // Start autonomous scan
                    runAutonomousScan({
                        guildId: request.guildId || LUTHEUS_GUILD_ID,
                        pages: request.pages || [1],
                        scanMode: request.scanMode || 'fast',
                        onComplete: async (result) => {
                            console.log(`[Lutheus SW] Sapphire sync job ${jobId} finished:`, result);
                            // Send final completion ingest batch (finished: true) to close the job
                            await forwardToVercelIngest([], jobId, `https://dashboard.sapph.xyz/${request.guildId || LUTHEUS_GUILD_ID}/moderation/cases`, true);
                            activeJobId = null;
                        }
                    }).catch(async (error) => {
                        console.error(`[Lutheus SW] Sapphire scan job failed:`, error.message);
                        await forwardToVercelIngest([], jobId, `https://dashboard.sapph.xyz/${request.guildId || LUTHEUS_GUILD_ID}/moderation/cases`, true);
                        activeJobId = null;
                    });

                    sendResponse({ success: true, jobId });
                    break;
                }

                case 'INTERCEPTED_PUNISHMENTS': {
                    const records = request.records || [];
                    if (records.length) {
                        const normalized = records.map((r) => ({
                            id: r.id || `network-${r.guildId || LUTHEUS_GUILD_ID}-${r.userId || 'unknown'}-${r.type || 'unknown'}-${r.createdAt || request.capturedAt || Date.now()}`,
                            caseId: r.caseId || r.id,
                            guildId: r.guildId || LUTHEUS_GUILD_ID,
                            user: r.username || 'Bilinmiyor',
                            userId: r.userId || '',
                            authorId: r.moderatorId || '',
                            authorName: r.moderator || 'Bilinmiyor',
                            reason: r.reason || '',
                            duration: r.duration || '',
                            type: r.type || 'unknown',
                            createdRaw: r.createdAt || '',
                            scrapedAt: Date.now(),
                            sourceUrl: r.sourceUrl || '',
                            capturedVia: 'network_interceptor',
                            rawData: r.rawData || null
                        }));
                        await storageSaveCases(normalized, true);
                        await updateRegistryFromCases(normalized);
                        console.log(`[Lutheus SW] Intercepted ${normalized.length} punishments saved`);
                        if (typeof activeJobId !== 'undefined' && activeJobId) {
                            await forwardToVercelIngest(normalized, activeJobId, request.sourceUrl || '');
                        }
                    }
                    sendResponse({ status: 'received', count: records.length });
                    break;
                }

                case ACTIONS.INJECT_SCRIPTS: {
                    const injected = await injectContentScripts(request.tabId);
                    sendResponse({ success: injected });
                    break;
                }

                case ACTIONS.SEND_TO_TAB: {
                    const result = await sendToContentScript(request.tabId, request.message);
                    sendResponse({ success: !!result, result });
                    break;
                }

                case ACTIONS.GET_DASHBOARD_TAB: {
                    const tabs = await chrome.tabs.query({ url: 'https://dashboard.sapph.xyz/*' });
                    sendResponse(tabs.length > 0 ? { success: true, tab: tabs[0] } : { success: false });
                    break;
                }

                case ACTIONS.OPEN_CASE_PAGE: {
                    const url = `https://dashboard.sapph.xyz/${request.guildId || LUTHEUS_GUILD_ID}/moderation/cases/${request.caseId}`;
                    await chrome.tabs.create({ url });
                    sendResponse({ success: true });
                    break;
                }

                case ACTIONS.OPEN_ADMIN: {
                    const adminUrl = chrome.runtime.getURL('src/dashboard/admin.html');
                    const adminTabs = await chrome.tabs.query({ url: adminUrl });
                    if (adminTabs.length > 0) {
                        await chrome.tabs.update(adminTabs[0].id, { active: true });
                        await chrome.tabs.reload(adminTabs[0].id);
                    } else {
                        await chrome.tabs.create({ url: adminUrl });
                    }
                    sendResponse({ success: true });
                    break;
                }

                case ACTIONS.CLOSE_TAB: {
                    if (request.tabId) await chrome.tabs.remove(request.tabId);
                    sendResponse({ success: true });
                    break;
                }

                case ACTIONS.OPEN_DISCORD_TAB: {
                    const tab = await openDiscordTab(request.guildId || LUTHEUS_GUILD_ID);
                    sendResponse({ success: true, tabId: tab.id });
                    break;
                }

                case ACTIONS.RUN_DISCORD_QUERY: {
                    const result = await sendToDiscordScript(request.tabId, {
                        action: ACTIONS.RUN_POINTTRAIN_QUERY,
                        payload: request.payload
                    });
                    sendResponse(result || { success: false, error: 'DISCORD_QUERY_FAILED' });
                    break;
                }

                case ACTIONS.COLLECT_DISCORD_COUNTS:
                case ACTIONS.RUN_POINTTRAIN_SCAN: {
                    const run = await runPointtrainScan(request.options || {});
                    sendResponse({ success: true, run });
                    break;
                }

                case ACTIONS.CANCEL_POINTTRAIN_SCAN: {
                    pointtrainCancelled = true;
                    sendResponse({ success: true });
                    break;
                }

                case ACTIONS.INTEGRITY_COMPROMISED: {
                    console.error('[Security] Integrity compromised signal received from extension.');
                    sendResponse({ received: true });
                    break;
                }

                default:
                    sendResponse({ success: false, error: `Unknown action: ${request.action}` });
            }
        } catch (error) {
            console.error('GearTech: Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;

    if (tab.url?.includes('dashboard.sapph.xyz')) {
        await injectContentScripts(tabId);
    }

    if (tab.url?.includes('discord.com/channels')) {
        await injectDiscordScripts(tabId);
    }
});

console.log('Lutheus CezaRapor: Service Worker v2.2 ready');
