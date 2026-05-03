(function initDiscordParser() {
    const selectors = () => window.LutheusDiscordSelectors || {};

    function queryFirst(selectorsList) {
        for (const selector of selectorsList || []) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    function queryAll(selectorsList) {
        const results = [];
        for (const selector of selectorsList || []) {
            document.querySelectorAll(selector).forEach((element) => results.push(element));
        }
        return results;
    }

    function getResultsContainer() {
        return queryFirst(selectors().searchResultsWrap) || document.scrollingElement || document.body;
    }

    function extractVisibleResults() {
        const seen = new Map();
        queryAll(selectors().searchResultItems).forEach((element, index) => {
            const key =
                element.getAttribute('data-list-item-id') ||
                element.id ||
                element.textContent?.trim().slice(0, 120) ||
                `fallback-${index}`;

            if (!seen.has(key)) {
                seen.set(key, {
                    key,
                    text: element.textContent?.trim() || ''
                });
            }
        });
        return Array.from(seen.values());
    }

    function extractActiveDays() {
        const unique = new Set();
        queryAll(selectors().timestampNodes).forEach((node) => {
            const value = node.getAttribute?.('datetime') || node.textContent || '';
            const match = String(value).match(/(\d{4}-\d{2}-\d{2})|(\d{2}\.\d{2}\.\d{4})/);
            if (match) unique.add(match[0]);
        });
        return unique.size;
    }

    function parseResultsSummary() {
        const text = getResultsContainer()?.textContent || '';
        const summaryMatch = text.match(/(\d+)\s+(?:sonuc|result)/i);
        return summaryMatch ? parseInt(summaryMatch[1], 10) : null;
    }

    window.LutheusDiscordParser = {
        getResultsContainer,
        extractVisibleResults,
        extractActiveDays,
        parseResultsSummary
    };
})();
