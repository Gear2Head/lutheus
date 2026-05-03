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

            const cols = row.querySelectorAll('[class*="column"]');
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
            '.row[class*="svelte-"]',
            '[class*="row"][class*="svelte-"]',
            '[role="row"]',
            'tbody tr',
            '.table .row'
        ];
        const seen = new Set();
        const rows = [];

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((row) => {
                if (seen.has(row)) return;
                seen.add(row);
                rows.push(row);
            });
        });

        return rows;
    },

    /**
     * Scrape the current logged-in user info from the header
     */
    scrapeCurrentUser: function () {
        try {
            // Strategy 1: Specific selectors from screenshot (Sapphire Dashboard)
            // Look for .user container with svelte class
            const userContainer = document.querySelector('.user[class*="svelte-"]');

            if (userContainer) {
                const avatarImg = userContainer.querySelector('img[alt="user-pfp"]') ||
                    userContainer.querySelector('img.avatar');
                const nameDiv = userContainer.querySelector('.username');

                if (avatarImg || nameDiv) {
                    const info = {
                        name: nameDiv ? nameDiv.innerText.trim() : 'Yetkili',
                        avatar: avatarImg ? avatarImg.src : null
                    };
                    console.log('Lutheus: Found active user', info);
                    return info;
                }
            }

            // Strategy 2: Fallback Generic
            const profileImg = document.querySelector('img[alt="Avatar"]');

            if (profileImg) {
                return {
                    name: 'Yetkili',
                    avatar: profileImg.src
                };
            }
        } catch (e) {
            console.error('Lutheus: Error scraping current user', e);
        }
        return null;
    },

    /**
     * Extract data from a single row
     * Based on observed structure: ID | User | Reason | Author | Duration | Created
     */
    extractRowData: function (row, rowIdx) {
        // Get all column elements
        const columns = Array.from(row.querySelectorAll('[class*="column"]'));

        if (columns.length < 6) return this.extractCompactRowData(row, rowIdx);

        let colOffset = 0;
        const firstColText = columns[0].innerText.trim();
        if (firstColText.length < 3 || firstColText.length > 20) {
            colOffset = 1;
        }

        // Extract ID
        const idCol = columns[0 + colOffset] || columns[0];
        let caseId = this.extractTextFromColumn(idCol, 'id') || '';

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
        const reason = reasonCol ? reasonCol.innerText.trim() : '';

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
            reason: reason || '',
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

        const caseId = this.extractCaseIdFromText(rawText);
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
        } else {
            const withoutCase = rawText.replace(caseId, '').replace(/\b\d{17,20}\b/g, '').trim();
            reason = parts.find((part) => !/^(mute|ban|warn|kick|timeout|permanent)$/i.test(part) && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(part)) || withoutCase;
        }

        return {
            id: caseId,
            caseId,
            user: user || 'Bilinmiyor',
            userId: idMatches[0] || '',
            userAvatar,
            reason: reason || '',
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

    extractCaseIdFromText: function (text) {
        const candidates = String(text || '').match(/\b[A-Za-z0-9]{4,15}\b/g) || [];
        return candidates.find((candidate) => !/^(mute|ban|warn|kick|timeout|user|reason|author|duration|created)$/i.test(candidate)) || '';
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
     * Extract specific text from a column
     */
    extractTextFromColumn: function (col, type) {
        if (!col) return '';
        const span = col.querySelector(`span[class*="${type}"]`);
        if (span) return span.innerText.trim();

        if (type === 'name') {
            const lines = col.innerText.trim().split('\n');
            return lines[0] || '';
        }

        if (type === 'id') {
            const span = col.querySelector('span[class*="id"]');
            if (span) return span.innerText.trim();
            const firstLine = col.innerText.trim().split('\n')[0];
            if (/^[a-zA-Z0-9]{4,15}$/.test(firstLine)) return firstLine;
        }
        return '';
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
    }
};

console.log('Lutheus CezaRapor: Scraper v4 loaded');
