// Lutheus CezaRapor - Main Content Script
// Message listener for communication with side panel

console.log('GearTech: Content script initializing...');

// Wait for modules to load
function waitForModules(callback, maxAttempts = 20) {
    let attempts = 0;

    const check = () => {
        if (window.GearTech?.Scraper && window.GearTech?.Navigation) {
            console.log('GearTech: All modules loaded');
            callback();
            return;
        }

        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(check, 100);
        } else {
            console.error('GearTech: Modules failed to load');
        }
    };

    check();
}

// Initialize when ready
waitForModules(() => {
    // Initialize Lutheus Guard
    if (window.LutheusGuard) {
        window.LutheusGuard.init();
    }

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('GearTech: Received message:', request.action);

        switch (request.action) {
            case 'SCRAPE_PAGE':
                try {
                    const data = window.GearTech.Scraper.getCaseData();
                    const userInfo = window.GearTech.Scraper.scrapeCurrentUser();
                    sendResponse({ success: true, data: data, userInfo: userInfo });
                } catch (e) {
                    console.error('GearTech: Scrape error:', e);
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'GET_USER_INFO':
                try {
                    const userInfo = window.GearTech.Scraper.scrapeCurrentUser();
                    sendResponse({ success: true, userInfo: userInfo });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'SCRAPE_CASE_DETAIL':
                try {
                    const detail = window.GearTech.Scraper.scrapeCaseDetail();
                    sendResponse({ success: true, detail });
                } catch (e) {
                    console.error('GearTech: Detail scrape error:', e);
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'NEXT_PAGE':
                try {
                    const success = window.GearTech.Navigation.nextPage();
                    sendResponse({ success: success });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'PREV_PAGE':
                try {
                    const success = window.GearTech.Navigation.prevPage();
                    sendResponse({ success: success });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'GO_TO_PAGE':
                try {
                    const success = window.GearTech.Navigation.goToPage(request.page);
                    sendResponse({ success: success });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;

            case 'GET_PAGE_INFO':
                try {
                    const pageInfo = window.GearTech.Navigation.getPaginationInfo();
                    const info = {
                        ...pageInfo,
                        current: pageInfo.currentPage,
                        total: pageInfo.totalPages
                    };
                    sendResponse(info);
                } catch (e) {
                    sendResponse({
                        current: 1,
                        currentPage: 1,
                        total: 1,
                        totalPages: 1,
                        totalCases: 0,
                        visibleRows: 0,
                        error: e.message
                    });
                }
                break;

            case 'WAIT_FOR_PAGE':
                window.GearTech.Navigation.waitForPage(request.page, request.timeout || 8000, request.previousFirstCase || '')
                    .then((info) => sendResponse({ success: true, ...info }))
                    .catch((e) => sendResponse({ success: false, error: e.message }));
                return true;

            case 'WAIT_FOR_LOAD':
                window.GearTech.Navigation.waitForTableLoad(request.timeout || 5000)
                    .then(() => sendResponse({ success: true }))
                    .catch(() => sendResponse({ success: false }));
                return true; // Keep channel open for async

            case 'PING':
                sendResponse({ success: true, message: 'GearTech content script active' });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }

        return true; // Keep message channel open
    });

    console.log('GearTech: Content script ready');
});

// Notify that content script is loaded
console.log('Lutheus CezaRapor: Content script loaded on', window.location.href);
