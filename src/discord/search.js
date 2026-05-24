(function initDiscordSearch() {
    const RATE_LIMIT_BACKOFFS = [8000, 15000, 30000, 60000];
    const MIN_QUERY_DELAY_MS = 2500;

    const selectors = () => window.LutheusDiscordSelectors || {};
    const parser = () => window.LutheusDiscordParser;

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function withJitter(baseMs, jitterRatio = 0.25) {
        const jitter = baseMs * jitterRatio * (Math.random() * 2 - 1);
        return Math.max(250, Math.round(baseMs + jitter));
    }

    function assertElement(el, label) {
        if (!el || !(el instanceof Element)) {
            throw new Error(`${label} not found or invalid`);
        }
        return el;
    }

    function queryFirst(selectorsList) {
        for (const selector of selectorsList || []) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    function isVisibleElement(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function findSearchInput() {
        const configured = queryFirst(selectors().searchInput);
        if (isVisibleElement(configured)) return configured;

        const fallbackSelectors = [
            '[contenteditable="true"][role="textbox"]',
            '[data-slate-editor="true"]',
            'div[contenteditable="true"]'
        ];

        for (const selector of fallbackSelectors) {
            const visible = Array.from(document.querySelectorAll(selector)).find(isVisibleElement);
            if (visible) return visible;
        }

        return null;
    }

    async function ensureSearchInput() {
        let input = findSearchInput();
        if (input) return input;

        const button = queryFirst(selectors().searchButton);
        if (button) {
            button.click();
            await sleep(350);
        }

        input = findSearchInput();
        if (!input) throw new Error('DISCORD_SEARCH_INPUT_NOT_FOUND');
        return input;
    }

    function setContentEditableValue(element, value) {
        const el = assertElement(element, 'Discord search input');
        const safeValue = typeof value === 'string' ? value : String(value ?? '');

        try {
            el.focus();
            el.textContent = safeValue;
            el.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: safeValue ? 'insertText' : 'deleteContentBackward',
                data: safeValue
            }));
        } catch (err) {
            console.warn('[Pointtrain] Failed to set contenteditable value:', err?.message || String(err));
            throw err;
        }
    }

    function dispatchEnter(element) {
        const el = assertElement(element, 'Discord search input');
        ['keydown', 'keypress', 'keyup'].forEach((type) => {
            el.dispatchEvent(new KeyboardEvent(type, {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13
            }));
        });
    }

    function quoteIfNeeded(value) {
        const text = String(value ?? '').trim();
        return /\s/.test(text) ? `"${text}"` : text;
    }

    function buildDiscordSearchQuery({ fromUserId, channels, after, before, keywords } = {}) {
        const parts = [];
        if (isNonEmptyString(fromUserId)) parts.push(`from: ${quoteIfNeeded(fromUserId)}`);
        if (Array.isArray(channels)) {
            channels.forEach((channel) => {
                const value = typeof channel === 'string' ? channel : (channel?.label || channel?.id || '');
                if (isNonEmptyString(value)) parts.push(`in: ${quoteIfNeeded(value)}`);
            });
        }
        if (isNonEmptyString(after)) parts.push(`after: ${after.trim()}`);
        if (isNonEmptyString(before)) parts.push(`before: ${before.trim()}`);
        if (isNonEmptyString(keywords)) parts.push(keywords.trim());
        return parts.join(' ').trim();
    }

    function buildQueries(payload = {}) {
        const staff = payload.staff || {};
        const id = String(staff.id || staff.discordUserId || staff.sapphireAuthorId || '').match(/\d{17,20}/)?.[0] || '';
        const aliases = Array.from(new Set([
            id,
            id ? `<@${id}>` : '',
            staff.searchTerm,
            staff.displayName,
            ...(staff.aliases || [])
        ].filter(isNonEmptyString)));

        const safeAliases = aliases.length ? aliases : [];
        return safeAliases
            .map((alias) => buildDiscordSearchQuery({
                fromUserId: alias,
                channels: payload.channels || [],
                after: payload.dateRange?.after,
                before: payload.dateRange?.before
            }))
            .filter(isNonEmptyString);
    }

    function isRateLimitedMessage(message = '') {
        const bodyText = document.body?.innerText?.toLowerCase?.() || '';
        return /rate limit|429|too many requests|too fast|slow down|tekrar dene|yavas|yavaş|hizli|hızlı/i.test(message)
            || bodyText.includes('rate limited')
            || bodyText.includes('too many requests');
    }

    async function clearSearchInput(element = null) {
        const input = element || findSearchInput();
        if (!input || !input.isConnected) {
            console.warn('[Pointtrain] Search input not found while clearing.');
            return false;
        }

        try {
            setContentEditableValue(input, '');
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                bubbles: true
            }));
            await sleep(250);
            return true;
        } catch (err) {
            console.warn('[Pointtrain] Failed to clear search input:', err?.message || String(err));
            return false;
        }
    }

    async function scrollAndCollect(maxIterations = 8) {
        const activeParser = parser();
        const container = activeParser?.getResultsContainer?.();
        const seen = new Map();
        let stableIterations = 0;

        if (!container) return [];

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            (activeParser.extractVisibleResults?.() || []).forEach((item) => seen.set(item.key, item));

            const previousCount = seen.size;
            container.scrollTop = container.scrollHeight;
            await sleep(450);
            (activeParser.extractVisibleResults?.() || []).forEach((item) => seen.set(item.key, item));

            if (seen.size === previousCount) {
                stableIterations += 1;
                if (stableIterations >= 2) break;
            } else {
                stableIterations = 0;
            }
        }

        return Array.from(seen.values());
    }

    async function runSingleQuery(query, options = {}) {
        const safeQuery = typeof query === 'string' ? query.trim() : String(query ?? '').trim();
        if (!isNonEmptyString(safeQuery)) {
            return { ok: false, success: false, query: safeQuery, reason: 'Empty or invalid query', results: [] };
        }

        const maxAttempts = options.maxAttempts ?? 4;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const input = await ensureSearchInput();
                await clearSearchInput(input);
                await sleep(withJitter(900, 0.35));

                const activeParser = parser();
                const beforeText = activeParser?.getResultsContainer?.()?.textContent || '';

                setContentEditableValue(input, safeQuery);
                await sleep(200);
                dispatchEnter(input);
                await sleep(withJitter(1800, 0.2));

                for (let i = 0; i < 8; i++) {
                    const nextText = activeParser?.getResultsContainer?.()?.textContent || '';
                    if (isRateLimitedMessage(nextText)) throw new Error('Search rate limit detected');
                    if (nextText && nextText !== beforeText) break;
                    await sleep(350);
                }

                const visibleResults = await scrollAndCollect(10);
                const summaryCount = activeParser?.parseResultsSummary?.() ?? null;
                await clearSearchInput(input);

                return {
                    ok: true,
                    success: true,
                    query: safeQuery,
                    results: visibleResults,
                    visibleResults,
                    summaryCount,
                    count: summaryCount ?? visibleResults.length
                };
            } catch (err) {
                const message = err?.message || String(err);
                if (isRateLimitedMessage(message) && attempt < maxAttempts) {
                    const waitMs = withJitter(RATE_LIMIT_BACKOFFS[Math.min(attempt - 1, RATE_LIMIT_BACKOFFS.length - 1)]);
                    console.warn(`[Pointtrain] Rate limit on attempt ${attempt}/${maxAttempts}. Waiting ${waitMs}ms.`);
                    await clearSearchInput();
                    await sleep(waitMs);
                    continue;
                }

                await clearSearchInput();
                return {
                    ok: false,
                    success: false,
                    query: safeQuery,
                    reason: message,
                    results: []
                };
            }
        }

        return { ok: false, success: false, query: safeQuery, reason: 'Maximum attempts exceeded', results: [] };
    }

    async function runPointtrainQuery(payload = {}) {
        const output = {
            ok: true,
            success: true,
            completedQueries: 0,
            failedQueries: [],
            results: []
        };
        const queries = buildQueries(payload).filter(isNonEmptyString).map((query) => query.trim());

        if (!queries.length) {
            return {
                ok: false,
                success: false,
                completedQueries: 0,
                failedQueries: [{ query: '', reason: 'No valid queries generated' }],
                results: [],
                error: 'No valid queries generated'
            };
        }

        let best = { query: queries[0], visibleResults: [], summaryCount: null, count: 0 };

        for (const query of queries) {
            const result = await runSingleQuery(query, { maxAttempts: 4 });
            if (result.ok) {
                output.completedQueries += 1;
                output.results.push(...(result.results || []));

                const resultCount = result.summaryCount ?? result.visibleResults?.length ?? 0;
                const bestCount = best.summaryCount ?? best.visibleResults?.length ?? 0;
                if (resultCount > bestCount || (!best.visibleResults.length && result.visibleResults?.length)) {
                    best = {
                        query,
                        visibleResults: result.visibleResults || [],
                        summaryCount: result.summaryCount ?? null,
                        count: resultCount
                    };
                }
                if (result.summaryCount && result.summaryCount > 0) break;
            } else {
                output.ok = false;
                output.success = false;
                output.failedQueries.push({
                    query,
                    reason: result.reason || 'Unknown failure'
                });
            }

            await sleep(withJitter(MIN_QUERY_DELAY_MS, 0.35));
        }

        const activeDays = parser()?.extractActiveDays?.() || 0;
        const count = best.summaryCount ?? best.visibleResults.length;

        return {
            ...output,
            success: output.completedQueries > 0,
            query: best.query,
            attemptedQueries: queries,
            count,
            activeDays,
            matchedChannels: (payload.channels || []).map((channel) => channel.id || channel.label || channel).filter(Boolean),
            sampleSize: best.visibleResults.length,
            selectorHealth: {
                hasSummary: best.summaryCount !== null,
                hasSearchInput: Boolean(findSearchInput())
            },
            error: output.failedQueries[0]?.reason
        };
    }

    async function testPointtrainSearch() {
        const result = await runPointtrainQuery({
            staff: { id: '1375772029982085184' },
            channels: ['💬genel-sohbet', '📷görsel-video-odası', '💭konu-dışı'],
            dateRange: {
                after: '2025-10-25',
                before: '2026-05-25'
            }
        });

        console.log('[Pointtrain] Final result:', result);
        return result;
    }

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request.action === 'POINTTRAIN_PING') {
            sendResponse({ success: true });
            return false;
        }

        if (request.action === 'RUN_POINTTRAIN_QUERY') {
            runPointtrainQuery(request.payload)
                .then((result) => sendResponse(result))
                .catch((error) => sendResponse({
                    ok: false,
                    success: false,
                    completedQueries: 0,
                    failedQueries: [{ query: '', reason: error instanceof Error ? error.message : String(error) }],
                    results: [],
                    error: error instanceof Error ? error.message : String(error)
                }));
            return true;
        }

        return false;
    });

    window.LutheusDiscordAutomation = {
        buildDiscordSearchQuery,
        buildQueries,
        clearSearchInput,
        runSingleQuery,
        runPointtrainQuery,
        testPointtrainSearch
    };
})();
