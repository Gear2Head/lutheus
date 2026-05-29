// Lutheus CezaRapor - Data Scraper v4
// Complete rewrite with better row/column detection

window.GearTech = window.GearTech || {};

window.GearTech.Scraper = {
    /**
     * Main scraping function
     */
    getCaseData: function () {
        console.log('GearTech Scraper v4: Starting scan...');

        const allRows = this.findCaseRows();
        console.log('GearTech: Found', allRows.length, 'total row elements');

        const dataRows = [];
        allRows.forEach(row => {
            // Skip dummy/header rows
            if (row.classList.contains('dummy')) return;
            if (row.innerText.includes('ID') && row.innerText.includes('User') && row.innerText.includes('Reason')) return;

            const cols = this.getRowColumns(row);
            const text = row.innerText || '';
            const hasCaseId = /\b[A-Za-z0-9]{4,15}\b/.test(text);
            const looksLikeCase = hasCaseId && /(mute|ban|warn|kick|timeout|permanent|\d{1,2}\.\d{1,2}\.\d{4})/i.test(text);
            if (cols.length >= 5 || looksLikeCase) {
                dataRows.push(row);
            }
        });

        console.log('GearTech: Found', dataRows.length, 'data rows');

        if (dataRows.length === 0) {
            console.warn('GearTech: No data rows found!');
            this.debugPage();
            return [];
        }

        const cases = [];

        dataRows.forEach((row, idx) => {
            try {
                const caseData = this.extractRowData(row, idx);
                if (caseData && caseData.id) {
                    cases.push(caseData);
                }
            } catch (e) {
                console.error('GearTech: Error in row', idx, e);
            }
        });

        console.log('GearTech: Extracted', cases.length, 'cases');
        return cases;
    },

    findCaseRows: function () {
        const selectors = [
            'a[href*="/moderation/cases/"]',
            'a[href*="/cases/"]',
            '[data-case-id]',
            '[data-row-key]',
            '[class*="case"]',
            '[class*="table-row"]',
            'tr[class*="row"]',
            'div[role="row"]',
            'tbody tr',
            '.row'
        ];
        // Use a localized Set to prevent memory leaks across page navigations
        const rows = [];
        
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                const row = element.matches('a[href]')
                    ? element.closest('tr, [role="row"], li, article, [class*="row"], [class*="item"], [class*="card"]') || element.parentElement || element
                    : element;
                const text = row.innerText || row.textContent || '';
                const hasCaseLink = row.querySelector?.('a[href*="/cases/"], a[href*="/moderation/cases/"]') || row.matches?.('a[href*="/cases/"], a[href*="/moderation/cases/"]');
                if ((hasCaseLink || this.extractCaseIdFromText(text)) && !rows.includes(row)) {
                    rows.push(row);
                }
            });
        });

        return rows;
    },

    getRowColumns: function (row) {
        if (!row) return [];
        const directCells = Array.from(row.querySelectorAll(':scope > td, :scope > th, :scope > [role="cell"], :scope > [role="gridcell"], :scope > div'));
        if (directCells.length >= 2) return directCells;
        const cells = Array.from(row.querySelectorAll('td, th, [role="cell"], [role="gridcell"], [class*="cell"], [class*="column"]'));
        if (cells.length) return cells;
        const links = Array.from(row.querySelectorAll('a[href*="/cases/"], a[href*="/moderation/cases/"]'));
        return links.length ? links : [row];
    },

    /**
     * Scrape the current logged-in user info from the header
     */
    scrapeCurrentUser: function () {
        try {
            // Find an image that looks like a user profile inside header/nav
            const allImages = Array.from(document.querySelectorAll('header img, nav img, div[role="navigation"] img, img.avatar, img[alt*="pfp"], img[alt*="Avatar"], img[src*="avatars"]'));
            
            // Find one that isn't the logo
            const avatarImg = allImages.find(img => !img.src.includes('logo') && !img.src.includes('brand') && !img.alt.includes('logo'));
            
            if (avatarImg) {
                // Try to find a nearby text element that might be the username
                let name = 'Yetkili';
                let current = avatarImg.parentElement;
                let depth = 0;
                
                while (current && depth < 3) {
                    const texts = Array.from(current.querySelectorAll('span, p, div')).filter(el => {
                        const txt = el.innerText?.trim();
                        return txt && txt.length > 2 && txt.length < 32 && !txt.includes('\n') && el.children.length === 0;
                    });
                    
                    if (texts.length > 0) {
                        name = texts[texts.length - 1].innerText.trim();
                        break;
                    }
                    current = current.parentElement;
                    depth++;
                }

                const info = { name, avatar: avatarImg.src };
                console.log('Lutheus: Found active user dynamically', info);
                return info;
            }

            return { name: 'Yetkili', avatar: null };
        } catch (e) {
            console.error('Lutheus: Error scraping current user', e);
            return { name: 'Yetkili', avatar: null };
        }
    },

    /**
     * Extract data from a single row
     * Based on observed structure: ID | User | Reason | Author | Duration | Created
     */
    extractRowData: function (row, rowIdx) {
        // Get all column elements
        const columns = this.getRowColumns(row);

        if (columns.length < 6) return this.extractCompactRowData(row, rowIdx);

        let colOffset = 0;
        const firstColText = columns[0].innerText.trim();
        if (firstColText.length < 3 || firstColText.length > 20) {
            colOffset = 1;
        }

        // Extract ID
        const idCol = columns[0 + colOffset] || columns[0];
        let caseId = this.extractCaseIdFromElement(row) || this.extractTextFromColumn(idCol, 'id') || '';

        if (!caseId || caseId.length < 4) {
            for (let i = 0; i < Math.min(3, columns.length); i++) {
                const testId = this.extractTextFromColumn(columns[i], 'id');
                if (testId && testId.length >= 4 && testId.length <= 15) {
                    caseId = testId;
                    colOffset = i;
                    break;
                }
            }
        }

        // Extract User
        const userCol = columns[1 + colOffset] || columns[1];
        const userName = this.extractTextFromColumn(userCol, 'name');
        const userId = this.extractDiscordId(userCol) || this.extractTextFromColumn(userCol, 'id');
        const userAvatar = this.extractImageFromColumn(userCol);

        // Extract Reason
        const reasonCol = columns[2 + colOffset] || columns[2];
        let reason = reasonCol ? reasonCol.innerText.trim() : '';
        if (this.isInvalidReasonCandidate(reason)) {
            const fallbackReasonCol = columns.slice(2, Math.min(columns.length, 5))
                .find((col) => col && !this.isInvalidReasonCandidate(col.innerText?.trim()));
            reason = fallbackReasonCol ? fallbackReasonCol.innerText.trim() : '';
        }

        // Extract Author
        const authorCol = columns[3 + colOffset] || columns[3];
        let authorName = '';
        let authorId = '';
        let authorAvatar = '';

        if (authorCol) {
            authorName = this.extractTextFromColumn(authorCol, 'name') || '';
            authorId = this.extractDiscordId(authorCol) || this.extractTextFromColumn(authorCol, 'id') || '';
            authorAvatar = this.extractImageFromColumn(authorCol);

            if (authorName.includes('(@')) authorName = authorName.split('(@')[0].trim();
            if (authorName.includes('(')) authorName = authorName.split('(')[0].trim();

            if (!authorName) {
                const lines = authorCol.innerText.trim().split('\n').filter(l => l.trim());
                if (lines.length >= 1) authorName = lines[0].trim();
                // If ID missing, try regex
                if (lines.length >= 2 && !authorId) {
                    const match = lines[1].match(/\d{17,20}/);
                    authorId = match ? match[0] : '';
                }
            }
        }

        // Extract Duration
        const durationCol = columns[4 + colOffset] || columns[4];
        let duration = '';
        if (durationCol) {
            // Check for title attribute (full duration usually hidden there if truncated)
            const spanWithTitle = durationCol.querySelector('[title]');
            duration = spanWithTitle ? spanWithTitle.getAttribute('title') : durationCol.innerText.trim();
        }
        if (!duration || duration === '---') duration = 'Süresiz';

        // Extract Created date
        const createdCol = columns[5 + colOffset] || columns[5];
        let createdRaw = '';
        if (createdCol) {
            const text = createdCol.innerText.trim();
            const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
            createdRaw = dateMatch ? dateMatch[1] : text.split('\n')[0];
        }

        // Extract Penalty Type (New V4 Feature)
        // Check column before ID (if offset > 0) or first column
        let penaltyType = 'unknown';
        const typeCol = colOffset > 0 ? columns[colOffset - 1] : columns[0];
        if (typeCol) {
            const img = typeCol.querySelector('img');
            if (img && img.alt) {
                penaltyType = img.alt.toLowerCase(); // 'ban', 'mute', 'warn'
            }
        }

        return {
            id: caseId,
            caseId: caseId,
            user: userName || 'Unknown',
            userId: userId || '',
            userAvatar: userAvatar,
            reason: this.cleanReasonCandidate(reason),
            authorName: authorName || 'Unknown',
            authorId: authorId || '',
            authorAvatar: authorAvatar,
            duration: duration || '',
            createdRaw: createdRaw || '',
            type: penaltyType, // extracted type
            sourceUrl: this.buildCaseUrl(caseId),
            scrapedAt: Date.now()
        };
    },

    extractCompactRowData: function (row) {
        const rawText = (row.innerText || '').trim();
        if (!rawText) return null;

        const caseId = this.extractCaseIdFromElement(row) || this.extractCaseIdFromText(rawText);
        if (!caseId) return null;

        const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
        const compactLine = lines.find((line) => line.includes('•')) || rawText.replace(/\n/g, ' • ');
        const parts = compactLine.split('•').map((part) => part.trim()).filter(Boolean);

        const dateMatch = rawText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        const typeMatch = rawText.match(/\b(MUTE|BAN|WARN|KICK|TIMEOUT)\b/i);
        const idMatches = rawText.match(/\b\d{17,20}\b/g) || [];
        const images = Array.from(row.querySelectorAll('img'));
        const firstDiscordIcon = images.find((img) => /discord/i.test(img.alt || img.src || ''));
        const userAvatar = images.find((img) => img !== firstDiscordIcon)?.currentSrc
            || images.find((img) => img !== firstDiscordIcon)?.src
            || null;

        let user = '';
        let reason = '';
        let duration = '';

        if (parts.length >= 5) {
            user = parts[1] || '';
            reason = parts[2] || '';
            duration = parts[3] || '';
            if (this.isInvalidReasonCandidate(reason)) {
                const fallback = parts.slice(2).find((part) => !this.isInvalidReasonCandidate(part)
                    && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(part)
                    && !/^(mute|ban|warn|kick|timeout|permanent)$/i.test(part));
                reason = fallback || '';
            }
        } else {
            const withoutCase = rawText.replace(caseId, '').replace(/\b\d{17,20}\b/g, '').trim();
            reason = parts.find((part) => !this.isInvalidReasonCandidate(part) && !/^(mute|ban|warn|kick|timeout|permanent)$/i.test(part) && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(part)) || withoutCase;
        }

        return {
            id: caseId,
            caseId,
            user: user || 'Bilinmiyor',
            userId: idMatches[0] || '',
            userAvatar,
            reason: this.cleanReasonCandidate(reason),
            authorName: 'Bilinmeyen Yetkili',
            authorId: '',
            authorAvatar: null,
            authorMissing: true,
            duration: duration || '',
            createdRaw: dateMatch ? dateMatch[1] : '',
            type: typeMatch ? typeMatch[1].toLowerCase() : 'unknown',
            sourceUrl: this.buildCaseUrl(caseId),
            scrapedAt: Date.now(),
            parseMode: 'compact'
        };
    },

    // SECTION: DATA_EXTRACTION
    // PURPOSE: Extract case identifiers without allowing IDs to leak into reason text.
    isLikelyCaseId: function (value, options = {}) {
        const text = String(value || '').trim();
        if (!/^[A-Za-z0-9_-]{4,24}$/.test(text)) return false;
        if (/^\d{17,20}$/.test(text)) return false;
        if (/^\d{5,24}$/.test(text)) return true;
        if (/^(mute|ban|warn|kick|timeout|user|reason|author|duration|created|bilinmiyor|sunucu|discord|yetkili)$/i.test(text)) return false;
        if (/[ğĞüÜşŞıİöÖçÇ]/.test(text)) return false;
        if (options.tagged) return true;
        if (/^[A-Za-z]{4,24}$/.test(text)) {
            const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
            return text.length >= 6 && uppercaseCount >= 2 && /[a-z]/.test(text);
        }
        return /[A-Za-z]/.test(text) && /\d/.test(text);
    },

    isInvalidReasonCandidate: function (value) {
        const text = String(value || '').trim();
        if (!text) return true;
        if (/^\d{4,24}$/.test(text)) return true;
        if (/^\d{17,20}$/.test(text)) return true;
        if (this.isLikelyCaseId(text)) return true;
        if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(text)) return true;
        if (/^(mute|ban|warn|kick|timeout|permanent|süresiz|suresiz)$/i.test(text)) return true;
        return false;
    },

    cleanReasonCandidate: function (value) {
        const text = String(value || '').trim();
        return this.isInvalidReasonCandidate(text) ? '' : text;
    },

    extractCaseIdFromText: function (text) {
        const raw = String(text || '');
        const tagged = raw.match(/#([A-Za-z0-9_-]{4,24})\b/);
        if (tagged && this.isLikelyCaseId(tagged[1], { tagged: true })) return tagged[1];
        const candidates = raw.match(/\b[A-Za-z0-9_-]{4,24}\b/g) || [];
        return candidates.find((candidate) => this.isLikelyCaseId(candidate)) || '';
    },

    extractCaseIdFromElement: function (element) {
        if (!element) return '';
        const attrId = element.getAttribute?.('data-case-id') || element.getAttribute?.('data-row-key') || '';
        if (this.isLikelyCaseId(attrId, { tagged: true })) return attrId;
        const link = element.matches?.('a[href*="/cases/"], a[href*="/moderation/cases/"]')
            ? element
            : element.querySelector?.('a[href*="/cases/"], a[href*="/moderation/cases/"]');
        const href = link?.getAttribute?.('href') || '';
        const match = href.match(/\/cases\/([^/?#]+)/) || href.match(/\/moderation\/cases\/([^/?#]+)/);
        const fromHref = match ? decodeURIComponent(match[1]) : '';
        return this.isLikelyCaseId(fromHref, { tagged: true }) ? fromHref : '';
    },

    extractTextFromColumn: function (col, type = 'text') {
        if (!col) return '';
        if (type === 'id') {
            const elementId = this.extractCaseIdFromElement(col);
            if (elementId) return elementId;
        }
        const text = (col.innerText || col.textContent || '').trim();
        if (type === 'id') return this.extractCaseIdFromText(text);
        if (type === 'name') {
            return text.split('\n').map((line) => line.trim()).filter(Boolean)
                .find((line) => !/^\d{17,20}$/.test(line) && !this.isLikelyCaseId(line)) || '';
        }
        return text;
    },

    buildCaseUrl: function (caseId) {
        if (!caseId) return window.location.href;
        const match = window.location.href.match(/https:\/\/dashboard\.sapph\.xyz\/(\d+)/);
        const guildId = match ? match[1] : '';
        return guildId
            ? `https://dashboard.sapph.xyz/${guildId}/moderation/cases/${caseId}`
            : window.location.href;
    },

    scrapeCaseDetail: function () {
        const text = document.body.innerText || '';
        const urlMatch = window.location.href.match(/\/cases\/([^/?#]+)/);
        const labels = {};

        Array.from(document.querySelectorAll('div, section, article, li')).forEach((element) => {
            const itemText = element.innerText?.trim();
            if (!itemText || itemText.length > 500) return;
            const parts = itemText.split('\n').map((part) => part.trim()).filter(Boolean);
            if (parts.length >= 2) {
                labels[parts[0].toLowerCase()] = parts.slice(1).join(' ');
            }
        });

        const evidenceLinks = Array.from(document.querySelectorAll('a[href]'))
            .map((link) => link.href)
            .filter((href) => /discord|cdn|media|attachment|message|channel/i.test(href))
            .slice(0, 10);

        return {
            caseId: urlMatch ? decodeURIComponent(urlMatch[1]) : '',
            detailUrl: window.location.href,
            detailScrapedAt: Date.now(),
            detailTextHash: String(text.length),
            labels,
            evidenceLinks,
            rawDetailText: text.slice(0, 4000)
        };
    },

    /**
     * Extract image src from a column
     */
    extractImageFromColumn: function (col) {
        if (!col) return null;
        const img = col.querySelector('img');
        if (!img) return null;
        return img.currentSrc || img.src || img.getAttribute('src') || null;
    },

    extractDiscordId: function (col) {
        if (!col) return '';
        const text = col.innerText || col.textContent || '';
        const match = text.match(/\b\d{17,20}\b/);
        return match ? match[0] : '';
    },


    /**
     * Debug page structure
     */
    debugPage: function () {
        console.log('=== GearTech Page Debug ===');

        // Find any table-like structures
        const tables = document.querySelectorAll('table, [class*="table"]');
        console.log('Tables found:', tables.length);

        // Find rows
        const rowElements = document.querySelectorAll('[class*="row"]');
        console.log('Elements with "row" class:', rowElements.length);

        rowElements.forEach((el, i) => {
            if (i < 3) {
                console.log(`Row ${i}:`, el.className, '-> Children:', el.children.length);
            }
        });

        // Check for Svelte classes
        const svelteElements = document.querySelectorAll('[class*="svelte-"]');
        console.log('Svelte elements:', svelteElements.length);
    },

    // SECTION: PAGINATION_EXTRACTION
    // PURPOSE: Extract live pagination totals, current page, size and language (EN/TR) from Sapphire pagination controls.
    getPaginationInfo: function () {
        try {
            const container = document.querySelector('.pagination-controls') || document.querySelector('div[class*="pagination"]');
            if (!container) {
                console.warn('GearTech Scraper: Pagination container not found!');
                return null;
            }

            const leftLabel = container.querySelector('.pagination-left label') || container.querySelector('label');
            const labelText = leftLabel ? leftLabel.innerText : '';

            const selectEl = container.querySelector('select');
            const pageSize = selectEl ? parseInt(selectEl.value) : null;

            const parsed = this.parsePaginationLabel(labelText);
            const totalCases = parsed.totalCases;
            const actualPageSize = pageSize || parsed.pageSize;

            const centerDiv = container.querySelector('.pagination-center') || container;
            const pageText = centerDiv ? centerDiv.innerText || '' : '';
            const totalPagesMatch = pageText.match(/of\s+(\d+)/i) || pageText.match(/\/\s*(\d+)/) || pageText.match(/(\d+)\s*sayfa/i);
            const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : null;

            const inputEl = container.querySelector('input[type="number"]');
            const currentPage = inputEl ? parseInt(inputEl.value) : 1;

            return {
                totalCases: totalCases,
                pageSize: actualPageSize,
                totalPages: totalPages,
                currentPage: currentPage,
                language: parsed.language
            };
        } catch (e) {
            console.error('GearTech Scraper: Error parsing pagination', e);
            return null;
        }
    },

    parsePaginationLabel: function(labelText) {
        const normalized = labelText.replace(/\s+/g, ' ').trim();

        const english = normalized.match(/showing\s+(\d+)\s+cases\s+of\s+(\d+)/i);
        if (english) {
            return {
                pageSize: Number(english[1]),
                totalCases: Number(english[2]),
                language: "en",
            };
        }

        const turkish = normalized.match(/(\d+)\s*(ceza|kayıt).*?(\d+)/i);
        if (turkish) {
            return {
                pageSize: Number(turkish[1]),
                totalCases: Number(turkish[3]),
                language: "tr",
            };
        }

        return { pageSize: null, totalCases: null, language: "unknown" };
    }
};

console.log('Lutheus CezaRapor: Scraper v4 loaded');
