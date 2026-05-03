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

    /**
     * Get total number of pages
     */
    getTotalPages: function () {
        // Look for "of XXX" or "/ XXX" text
        const pageText = document.body.innerText;

        // Try "of 400" pattern
        let match = pageText.match(/of\s+(\d+)/i);
        if (match) return parseInt(match[1]);

        // Try "/ 400" pattern
        match = pageText.match(/\/\s*(\d+)(?:\s|$)/);
        if (match) return parseInt(match[1]);

        // Try finding in pagination area
        const paginationEl = document.querySelector('[class*="pagination"]');
        if (paginationEl) {
            const spans = paginationEl.querySelectorAll('span');
            for (const span of spans) {
                const num = parseInt(span.innerText);
                if (num > 100) return num;
            }
        }

        // Look for "Found XXXX cases" 
        match = pageText.match(/Found\s+(\d+)\s+cases/i);
        if (match) {
            // Assuming 25 cases per page
            return Math.ceil(parseInt(match[1]) / 25);
        }

        console.warn('GearTech Nav: Could not determine total pages');
        return 1;
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
