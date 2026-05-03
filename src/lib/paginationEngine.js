// Lutheus CezaRapor - Pagination Engine v2
// 3-Layer Pagination Detection System
// Fixes: Case count ≠ Page count

export const PaginationEngine = {
    version: '2.0.0',
    
    // Configuration
    config: {
        MAX_PAGES: 15,           // Hard cap - never exceed
        DEFAULT_PER_PAGE: 25,    // Default items per page
        CONFIDENCE_THRESHOLD: 0.7 // Minimum confidence to trust detection
    },

    /**
     * Detect total pages using 3-layer system
     * Layer 1: UI Component (Most Reliable)
     * Layer 2: Mathematical Validation (Fallback)
     * Layer 3: Safe Limit (Hard Cap)
     * 
     * @returns {{pages: number, source: string, confidence: number, details: Object}}
     */
    detectTotalPages: function() {
        console.log('[PaginationEngine] Starting 3-layer detection...');

        // Layer 1: UI Component Detection (Highest Priority)
        const uiResult = this.detectFromUI();
        if (uiResult.success && uiResult.confidence >= this.config.CONFIDENCE_THRESHOLD) {
            console.log('[PaginationEngine] ✅ Layer 1 (UI) SUCCESS:', uiResult);
            return this.buildResult(uiResult.pages, 'UI_COMPONENT', uiResult.confidence, uiResult.details);
        }

        console.warn('[PaginationEngine] ⚠️ Layer 1 (UI) failed or low confidence');

        // Layer 2: Mathematical Calculation (Fallback)
        const mathResult = this.detectFromMath();
        if (mathResult.success && mathResult.confidence >= 0.5) {
            console.log('[PaginationEngine] ✅ Layer 2 (MATH) SUCCESS:', mathResult);
            return this.buildResult(mathResult.pages, 'MATH_CALCULATION', mathResult.confidence, mathResult.details);
        }

        console.warn('[PaginationEngine] ⚠️ Layer 2 (MATH) failed');

        // Layer 3: Safe Limit (Emergency Fallback)
        console.error('[PaginationEngine] ❌ Both layers failed, using SAFE_LIMIT');
        return this.buildResult(
            1, 
            'SAFE_LIMIT', 
            0.3, 
            { 
                reason: 'All detection methods failed',
                warning: 'Using minimal safe value'
            }
        );
    },

    /**
     * Layer 1: Detect from UI Components
     * Priority: Input max attribute > Pagination text > Button list
     */
    detectFromUI: function() {
        const details = {};
        
        // Strategy 1A: Input Max Attribute (Most Reliable)
        const input = document.querySelector(
            'input[type="number"][class*="svelte"], .pagination input[type="number"]'
        );
        
        if (input && input.max) {
            const maxAttr = parseInt(input.max);
            if (!isNaN(maxAttr) && maxAttr > 0 && maxAttr <= this.config.MAX_PAGES) {
                details.method = 'input_max_attribute';
                details.value = maxAttr;
                return { 
                    success: true, 
                    pages: maxAttr, 
                    confidence: 0.95, 
                    details 
                };
            } else if (maxAttr > this.config.MAX_PAGES) {
                // Max attribute exists but unrealistic - likely wrong
                details.method = 'input_max_attribute';
                details.value = maxAttr;
                details.rejected = true;
                details.reason = `Value ${maxAttr} exceeds MAX_PAGES (${this.config.MAX_PAGES})`;
                console.warn('[PaginationEngine] Input max attribute rejected:', maxAttr);
            }
        }

        // Strategy 1B: Pagination Text ("1 of 5" or "1 / 5")
        const paginationSelectors = [
            '.pagination span',
            '.pagination .info',
            '.svelte-16383p9 span',
            '[class*="pagination"] span'
        ];

        for (const selector of paginationSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.innerText;
                // Match: "Number separator Number" pattern
                const match = text.match(/(\d+)\s*(?:of|\/|\/)\s*(\d+)/i);
                if (match) {
                    const totalPages = parseInt(match[2]);
                    if (totalPages > 0 && totalPages <= this.config.MAX_PAGES) {
                        details.method = 'pagination_text';
                        details.text = text;
                        details.value = totalPages;
                        return { 
                            success: true, 
                            pages: totalPages, 
                            confidence: 0.90, 
                            details 
                        };
                    }
                }
            }
        }

        // Strategy 1C: Pagination Buttons (Last Resort UI)
        const buttons = document.querySelectorAll('.pagination button[class*="page"], button.page-number');
        if (buttons.length > 0) {
            const pageNumbers = Array.from(buttons)
                .map(btn => parseInt(btn.textContent))
                .filter(num => !isNaN(num) && num > 0);
            
            if (pageNumbers.length > 0) {
                const maxPage = Math.max(...pageNumbers);
                if (maxPage <= this.config.MAX_PAGES) {
                    details.method = 'pagination_buttons';
                    details.buttonCount = buttons.length;
                    details.value = maxPage;
                    return { 
                        success: true, 
                        pages: maxPage, 
                        confidence: 0.75, 
                        details 
                    };
                }
            }
        }

        return { success: false, confidence: 0, details };
    },

    /**
     * Layer 2: Mathematical Calculation
     * Formula: ceil(totalCases / itemsPerPage)
     * 
     * WARNING: This should ONLY be used as fallback!
     * Never confuse case count with page count!
     */
    detectFromMath: function() {
        const details = {};

        // Get total cases from "Showing X of Y" text
        const totalCases = this.extractTotalCases();
        if (!totalCases) {
            details.error = 'Cannot extract total case count';
            return { success: false, confidence: 0, details };
        }

        // Get items per page from current table
        const itemsPerPage = this.extractItemsPerPage();
        if (!itemsPerPage) {
            details.error = 'Cannot determine items per page';
            return { success: false, confidence: 0, details };
        }

        // Calculate pages
        const calculatedPages = Math.ceil(totalCases / itemsPerPage);

        details.totalCases = totalCases;
        details.itemsPerPage = itemsPerPage;
        details.calculatedPages = calculatedPages;

        // Sanity check
        if (calculatedPages > this.config.MAX_PAGES) {
            details.warning = `Calculated pages (${calculatedPages}) exceeds MAX_PAGES (${this.config.MAX_PAGES})`;
            details.cappedTo = this.config.MAX_PAGES;
            console.warn('[PaginationEngine] Math result capped:', details);
            return { 
                success: true, 
                pages: this.config.MAX_PAGES, 
                confidence: 0.5, 
                details 
            };
        }

        return { 
            success: true, 
            pages: calculatedPages, 
            confidence: 0.6, 
            details 
        };
    },

    /**
     * Extract total case count from page text
     */
    extractTotalCases: function() {
        // Try "Showing X-Y of Z" pattern
        const bodyText = document.body.innerText;
        const patterns = [
            /Showing.*?of\s+(\d+)/i,
            /Total.*?(\d+)/i,
            /(\d+)\s+total/i,
            /of\s+(\d+)\s+items/i
        ];

        for (const pattern of patterns) {
            const match = bodyText.match(pattern);
            if (match) {
                const count = parseInt(match[1]);
                if (!isNaN(count) && count > 0) {
                    console.log('[PaginationEngine] Found total cases:', count);
                    return count;
                }
            }
        }

        return null;
    },

    /**
     * Extract items per page from current visible table
     */
    extractItemsPerPage: function() {
        // Count visible data rows
        const rows = document.querySelectorAll('.row[class*="svelte-"]');
        let dataRowCount = 0;

        rows.forEach(row => {
            // Skip dummy/header rows
            if (row.classList.contains('dummy')) return;
            if (row.innerText.includes('ID') && row.innerText.includes('User')) return;
            
            const cols = row.querySelectorAll('[class*="column"]');
            if (cols.length >= 5) {
                dataRowCount++;
            }
        });

        if (dataRowCount > 0) {
            console.log('[PaginationEngine] Items per page:', dataRowCount);
            return dataRowCount;
        }

        // Fallback to default
        console.log('[PaginationEngine] Using default items per page:', this.config.DEFAULT_PER_PAGE);
        return this.config.DEFAULT_PER_PAGE;
    },

    /**
     * Build standardized result object
     */
    buildResult: function(pages, source, confidence, details) {
        return {
            pages: Math.min(pages, this.config.MAX_PAGES), // Always respect MAX_PAGES
            source,
            confidence,
            details,
            timestamp: Date.now()
        };
    },

    /**
     * Validate pagination detection
     * Returns true if detection is reliable enough to proceed
     */
    isReliable: function(result) {
        if (!result) return false;
        return result.confidence >= this.config.CONFIDENCE_THRESHOLD;
    },

    /**
     * Get human-readable explanation of detection
     */
    explainDetection: function(result) {
        if (!result) return 'No detection result available';

        const lines = [
            `📊 Pagination Detection Report`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Total Pages: ${result.pages}`,
            `Source: ${result.source}`,
            `Confidence: ${Math.round(result.confidence * 100)}%`,
            ``,
            `📋 Details:`
        ];

        if (result.details) {
            Object.entries(result.details).forEach(([key, value]) => {
                lines.push(`  • ${key}: ${value}`);
            });
        }

        if (result.source === 'UI_COMPONENT') {
            lines.push(``, `✅ High reliability - Read directly from UI`);
        } else if (result.source === 'MATH_CALCULATION') {
            lines.push(``, `⚠️ Medium reliability - Calculated from case count`);
            lines.push(`  Note: This is a fallback method`);
        } else if (result.source === 'SAFE_LIMIT') {
            lines.push(``, `❌ Low reliability - Using safe default`);
            lines.push(`  WARNING: Actual page count unknown`);
        }

        return lines.join('\n');
    },

    /**
     * Smart pagination loop detector
     * Detects if we're stuck in same page or empty page
     */
    createLoopDetector: function() {
        const seenPages = new Set();
        const emptyPages = [];

        return {
            /**
             * Check if this page was already visited
             */
            checkDuplicate: function(pageNum) {
                if (seenPages.has(pageNum)) {
                    console.error('[PaginationEngine] 🔴 LOOP DETECTED: Page', pageNum, 'already visited');
                    return true;
                }
                seenPages.add(pageNum);
                return false;
            },

            /**
             * Check if this page is empty
             */
            checkEmpty: function(pageNum, itemCount) {
                if (itemCount === 0) {
                    emptyPages.push(pageNum);
                    console.warn('[PaginationEngine] ⚠️ Empty page detected:', pageNum);
                    
                    // Two consecutive empty pages = stop
                    if (emptyPages.length >= 2) {
                        const [prev, curr] = emptyPages.slice(-2);
                        if (curr === prev + 1) {
                            console.error('[PaginationEngine] 🔴 TWO CONSECUTIVE EMPTY PAGES:', prev, curr);
                            return true;
                        }
                    }
                }
                return false;
            },

            /**
             * Get detection summary
             */
            getSummary: function() {
                return {
                    totalPagesVisited: seenPages.size,
                    emptyPagesCount: emptyPages.length,
                    emptyPages: [...emptyPages]
                };
            },

            /**
             * Reset detector for new scan
             */
            reset: function() {
                seenPages.clear();
                emptyPages.length = 0;
            }
        };
    },

    /**
     * Update configuration
     */
    configure: function(options) {
        if (options.MAX_PAGES !== undefined) {
            this.config.MAX_PAGES = Math.max(1, Math.min(options.MAX_PAGES, 50));
        }
        if (options.DEFAULT_PER_PAGE !== undefined) {
            this.config.DEFAULT_PER_PAGE = Math.max(1, options.DEFAULT_PER_PAGE);
        }
        if (options.CONFIDENCE_THRESHOLD !== undefined) {
            this.config.CONFIDENCE_THRESHOLD = Math.max(0, Math.min(options.CONFIDENCE_THRESHOLD, 1));
        }
        console.log('[PaginationEngine] Configuration updated:', this.config);
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.PaginationEngine = PaginationEngine;
}

console.log('✅ Lutheus CezaRapor: Pagination Engine v2 loaded');
