(function initDiscordSearch() {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const selectors = () => window.LutheusDiscordSelectors || {};
    const parser = () => window.LutheusDiscordParser;

    function queryFirst(selectorsList) {
        for (const selector of selectorsList || []) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    async function ensureSearchInput() {
        let input = queryFirst(selectors().searchInput);
        if (input) return input;

        const button = queryFirst(selectors().searchButton);
        if (button) {
            button.click();
            await wait(250);
        }

        input = queryFirst(selectors().searchInput);
        if (!input) {
            throw new Error('DISCORD_SEARCH_INPUT_NOT_FOUND');
        }

        return input;
    }

    function setContentEditableValue(element, value) {
        element.focus();
        document.getSelection()?.removeAllRanges();

        const range = document.createRange();
        range.selectNodeContents(element);
        document.getSelection()?.addRange(range);

        document.execCommand('selectAll', false);
        document.execCommand('selectAll', false);
        document.execCommand('delete', false);
        document.execCommand('insertText', false, value);
    }

    function dispatchEnter(element) {
        const events = ['keydown', 'keypress', 'keyup'];
        events.forEach((type) => {
            const event = new KeyboardEvent(type, {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13
            });
            element.dispatchEvent(event);
        });
    }

    function quoteIfNeeded(value) {
        return /\s/.test(value) ? `"${value}"` : value;
    }

    function buildQueries(payload) {
        const staff = payload.staff || {};
        const id = String(staff.id || staff.discordUserId || staff.sapphireAuthorId || '').match(/\d{17,20}/)?.[0] || '';
        const aliases = Array.from(new Set([
            id,
            id ? `<@${id}>` : '',
            staff.searchTerm,
            staff.displayName,
            ...(staff.aliases || [])
        ].filter(Boolean)));
        if (!aliases.length) aliases.push('unknown');
        const channels = (payload.channels || []).map((channel) => channel.label || channel.id).filter(Boolean);

        return aliases.map((alias) => {
            const queryParts = [`from: ${quoteIfNeeded(alias)}`];
            channels.forEach((channel) => queryParts.push(`in: ${quoteIfNeeded(channel)}`));
            if (payload.dateRange?.after) queryParts.push(`after: ${payload.dateRange.after}`);
            if (payload.dateRange?.before) queryParts.push(`before: ${payload.dateRange.before}`);
            return queryParts.join(' ');
        });
    }

    async function scrollAndCollect(maxIterations = 8) {
        const container = parser().getResultsContainer();
        const seen = new Map();
        let stableIterations = 0;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            parser().extractVisibleResults().forEach((item) => seen.set(item.key, item));

            const previousCount = seen.size;
            container.scrollTop = container.scrollHeight;
            await wait(450);
            parser().extractVisibleResults().forEach((item) => seen.set(item.key, item));

            if (seen.size === previousCount) {
                stableIterations += 1;
                if (stableIterations >= 2) break;
            } else {
                stableIterations = 0;
            }
        }

        return Array.from(seen.values());
    }

    function dispatchInput(element) {
        element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: element.textContent || ''
        }));
    }

    async function runSingleQuery(input, query) {
        const beforeText = parser().getResultsContainer()?.textContent || '';
        setContentEditableValue(input, query);
        dispatchInput(input);
        await wait(160);
        dispatchEnter(input);
        await wait(1500);

        for (let i = 0; i < 6; i++) {
            const nextText = parser().getResultsContainer()?.textContent || '';
            if (nextText && nextText !== beforeText) break;
            await wait(350);
        }

        const visibleResults = await scrollAndCollect(10);
        const summaryCount = parser().parseResultsSummary();
        return { visibleResults, summaryCount };
    }

    async function runPointtrainQuery(payload) {
        const input = await ensureSearchInput();
        const queries = buildQueries(payload);
        let best = { query: queries[0] || '', visibleResults: [], summaryCount: null };

        for (const query of queries) {
            const result = await runSingleQuery(input, query);
            const resultCount = result.summaryCount ?? result.visibleResults.length;
            const bestCount = best.summaryCount ?? best.visibleResults.length;
            if (resultCount > bestCount || (!best.visibleResults.length && result.visibleResults.length)) {
                best = { query, ...result };
            }
            if (result.summaryCount && result.summaryCount > 0) break;
        }

        const count = best.summaryCount ?? best.visibleResults.length;
        const activeDays = parser().extractActiveDays();

        return {
            success: true,
            query: best.query,
            attemptedQueries: queries,
            count,
            activeDays,
            matchedChannels: (payload.channels || []).map((channel) => channel.id || channel.label),
            sampleSize: best.visibleResults.length,
            selectorHealth: {
                hasSummary: best.summaryCount !== null,
                hasSearchInput: true
            }
        };
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
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }));
            return true;
        }

        return false;
    });

    window.LutheusDiscordAutomation = {
        buildQueries,
        runPointtrainQuery
    };
})();
