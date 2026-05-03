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
        document.execCommand('delete', false);

        element.textContent = value;
        element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: value
        }));
    }

    function dispatchEnter(element) {
        ['keydown', 'keypress', 'keyup'].forEach((type) => {
            element.dispatchEvent(new KeyboardEvent(type, {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter'
            }));
        });
    }

    function quoteIfNeeded(value) {
        return /\s/.test(value) ? `"${value}"` : value;
    }

    function buildQuery(payload) {
        const fromTerm = quoteIfNeeded(payload.staff.searchTerm || payload.staff.displayName || payload.staff.sapphireAuthorId || 'unknown');
        const channels = (payload.channels || []).map((channel) => channel.label || channel.id).filter(Boolean);
        const queryParts = [`from: ${fromTerm}`];

        channels.forEach((channel) => queryParts.push(`in: ${quoteIfNeeded(channel)}`));

        if (payload.dateRange?.after) queryParts.push(`after: ${payload.dateRange.after}`);
        if (payload.dateRange?.before) queryParts.push(`before: ${payload.dateRange.before}`);

        return queryParts.join(' ');
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

    async function runPointtrainQuery(payload) {
        const input = await ensureSearchInput();
        const query = buildQuery(payload);

        setContentEditableValue(input, query);
        await wait(100);
        dispatchEnter(input);
        await wait(1200);

        const visibleResults = await scrollAndCollect();
        const summaryCount = parser().parseResultsSummary();
        const count = summaryCount ?? visibleResults.length;
        const activeDays = parser().extractActiveDays();

        return {
            success: true,
            query,
            count,
            activeDays,
            matchedChannels: (payload.channels || []).map((channel) => channel.id || channel.label),
            sampleSize: visibleResults.length,
            selectorHealth: {
                hasSummary: summaryCount !== null,
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
        buildQuery,
        runPointtrainQuery
    };
})();
