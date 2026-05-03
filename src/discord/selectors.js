(function initDiscordSelectors() {
    window.LutheusDiscordSelectors = {
        searchButton: [
            'button[aria-label*="Ara"]',
            'button[aria-label*="Search"]',
            '[aria-label*="Ara"][role="button"]',
            '[aria-label*="Search"][role="button"]'
        ],
        searchInput: [
            '[aria-label="Ara"] .public-DraftEditor-content[contenteditable="true"]',
            '[aria-label="Search"] .public-DraftEditor-content[contenteditable="true"]',
            'div[contenteditable="true"][role="combobox"] .public-DraftEditor-content',
            '.public-DraftEditor-content[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]'
        ],
        searchResultsWrap: [
            '[class*="searchResultsWrap"]',
            '[class*="searchResults"]',
            '[aria-label*="Arama Sonuclari"]',
            '[aria-label*="Search Results"]'
        ],
        searchResultItems: [
            '[class*="searchResult"]',
            '[class*="result"] [id*="message-content"]',
            '[data-list-item-id*="search-results"]',
            '[id^="search-results-"]'
        ],
        timestampNodes: [
            'time[datetime]',
            '[class*="timestamp"] time',
            '[class*="timestamp"]'
        ]
    };
})();
