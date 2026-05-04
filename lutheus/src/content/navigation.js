// Lutheus CezaRapor - Navigation v2
// Page navigation for dashboard.sapph.xyz

window.GearTech = window.GearTech || {};

window.GearTech.Navigation = {
    /**
     * Navigate to a specific page number
     */
    goToPage: function (pageNumber) {
        console.log('GearTech Nav: Going to page', pageNumber);

        // Try multiple selectors for page input
        const selectors = [
            'input.svelte-mp4bej',
            'input[type="number"][class*="svelte"]',
            '.pagination input[type="number"]',
            'input[type="number"]'
        ];

        let input = null;
        for (const sel of selectors) {
            input = document.querySelector(sel);
            if (input) break;
        }

        if (!input) {
            console.error('GearTech Nav: Page input not found');
            return false;
        }

        // Set value
        input.value = pageNumber;

        // Trigger events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Focus and press Enter
        input.focus();

        const enterEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
        });
        input.dispatchEvent(enterEvent);

        const keyupEvent = new KeyboardEvent('keyup', {
            bubbles: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
        });
        input.dispatchEvent(keyupEvent);

        input.blur();

        console.log('GearTech Nav: Navigated to page', pageNumber);
        return true;
    },

    getFirstCaseId: function () {
        const firstRow = Array.from(document.querySelectorAll('.row[class*="svelte-"], [class*="row"][class*="svelte-"], [role="row"], tbody tr'))
            .find((row) => {
                const text = row.innerText || '';
                return !row.classList.contains('dummy') && /\b[A-Za-z0-9]{4,15}\b/.test(text);
            });
        const text = firstRow?.innerText || '';
        const match = text.match(/\b[A-Za-z0-9]{4,15}\b/);
        return match ? match[0] : '';
    },

    waitForPage: function (pageNumber, timeout = 8000, previousFirstCase = '') {
        const target = Number(pageNumber);
        const start = Date.now();
        const initialFirstCase = previousFirstCase || this.getFirstCaseId();

        return new Promise((resolve, reject) => {
            let observer;
            
            const evaluate = () => {
                const current = this.getCurrentPage();
                const firstCase = this.getFirstCaseId();
                const pageMatched = current === target;
                const rowChanged = !initialFirstCase || !firstCase || firstCase !== initialFirstCase;

                if (pageMatched && rowChanged) {
                    if (observer) observer.disconnect();
                    resolve({ current, firstCase });
                    return true;
                }
                return false;
            };

            // Initial check
            if (evaluate()) return;

            // Start MutationObserver for robust detection of DOM changes
            observer = new MutationObserver((mutations) => {
                if (evaluate()) return;
            });

            // Observe table container, tbody, or body for added rows
            const container = document.querySelector('table, tbody, [role="table"]') || document.body;
            observer.observe(container, { childList: true, subtree: true, characterData: true });

            // Fallback interval just in case mutations don't fire
            const fallbackInterval = setInterval(() => {
                if (evaluate()) {
                    clearInterval(fallbackInterval);
                } else if (Date.now() - start > timeout) {
                    if (observer) observer.disconnect();
                    clearInterval(fallbackInterval);
                    reject(new Error(`PAGE_NAV_TIMEOUT_${target}_CURRENT_${this.getCurrentPage()}`));
                }
            }, 300);
        });
    },

    /**
     * Click next page button
     */
    nextPage: function () {
        const selectors = [
            'button.pagination.next',
            'button[class*="pagination"][class*="next"]',
            'button[class*="next"]',
            '.pagination button:last-child'
        ];

        for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
        }
        return false;
    },

    /**
     * Get current page number
     */
    getCurrentPage: function () {
        const selectors = [
            'input.svelte-mp4bej',
            'input[type="number"][class*="svelte"]',
            'input[type="number"]'
        ];

        for (const sel of selectors) {
            const input = document.querySelector(sel);
            if (input && input.value) {
                return parseInt(input.value) || 1;
            }
        }
        return 1;
    },

    getTotalCases: function () {
        const text = document.body.innerText || '';
        const foundMatch = text.match(/Found\s+(\d+)\s+cases/i);
        if (foundMatch) return Number(foundMatch[1]) || 0;

        const showingMatch = text.match(/Showing\s+\d+\s+cases\s+of\s+(\d+)/i);
        if (showingMatch) return Number(showingMatch[1]) || 0;

        const caseRows = window.GearTech?.Scraper?.findCaseRows?.() || [];
        return caseRows.length;
    },

    getVisibleRowCount: function () {
        const rows = window.GearTech?.Scraper?.findCaseRows?.() || [];
        return rows.filter((row) => {
            const text = row.innerText || '';
            return !row.classList.contains('dummy') && /\b[A-Za-z0-9]{4,15}\b/.test(text);
        }).length;
    },

    getPageSize: function () {
        const text = document.body.innerText || '';
        const showingMatch = text.match(/Showing\s+(\d+)\s+cases\s+of\s+\d+/i);
        if (showingMatch) return Number(showingMatch[1]) || 25;
        const select = Array.from(document.querySelectorAll('select')).find((item) => /\d+/.test(item.value || item.innerText || ''));
        return Number(select?.value) || this.getVisibleRowCount() || 25;
    },

    /**
     * Get total number of pages. This must not read "cases of 79" as pages.
     */
    getTotalPages: function () {
        return this.getPaginationInfo().totalPages;
    },

    getPaginationInfo: function () {
        const currentPage = this.getCurrentPage();
        const totalCases = this.getTotalCases();
        const pageSize = this.getPageSize();
        const visibleRows = this.getVisibleRowCount();

        const numberInput = Array.from(document.querySelectorAll('input[type="number"]')).find((input) => {
            const value = Number(input.value || 0);
            return value === currentPage || value > 0;
        });
        const paginationRoot = numberInput?.closest('div')?.parentElement || numberInput?.parentElement || document.querySelector('[class*="pagination"]');
        const paginationText = paginationRoot?.innerText || '';

        let totalPages = 0;
        const currentPagePattern = new RegExp(`\\b${currentPage}\\s+of\\s+(\\d+)\\b`, 'i');
        const pageMatch = paginationText.match(currentPagePattern)
            || paginationText.match(/\bpage\s+\d+\s+of\s+(\d+)\b/i)
            || paginationText.match(/\/\s*(\d+)\b/);
        if (pageMatch) totalPages = Number(pageMatch[1]) || 0;

        if (!totalPages && totalCases && pageSize) {
            totalPages = Math.max(1, Math.ceil(totalCases / pageSize));
        }
        if (!totalPages) totalPages = 1;

        return {
            currentPage,
            totalPages,
            totalCases,
            visibleRows,
            pageSize,
            firstCase: this.getFirstCaseId(),
            guildId: this.getGuildId(),
            isOnCasesPage: this.isOnCasesPage()
        };
    },

    /**
     * Get guild ID from URL
     */
    getGuildId: function () {
        const match = window.location.href.match(/dashboard\.sapph\.xyz\/(\d+)/);
        return match ? match[1] : null;
    },

    /**
     * Check if on cases page
     */
    isOnCasesPage: function () {
        return window.location.href.includes('/moderation');
    }
};

console.log('Lutheus CezaRapor: Navigation v2 loaded');
