// Lutheus Guard - Server Lock System
// Ensures extension only works on Lutheus Discord server

const LutheusGuard = {
    // Lutheus Discord Server Guild ID - LOCKED
    LUTHEUS_GUILD_ID: '1223431616081166336',
    LUTHEUS_NAME: 'Lutheus',

    /**
     * Check if current guild is Lutheus
     * @param {string} guildId - Guild ID from URL or dashboard
     * @returns {boolean}
     */
    isLutheus(guildId) {
        return guildId === this.LUTHEUS_GUILD_ID;
    },

    /**
     * Extract Guild ID from current URL
     * @returns {string|null}
     */
    getGuildIdFromUrl() {
        const match = window.location.href.match(/dashboard\.sapph\.xyz\/(\d+)/);
        return match ? match[1] : null;
    },

    /**
     * Check server name from page
     * @returns {string|null}
     */
    getServerNameFromPage() {
        // Try multiple selectors for server name
        const selectors = [
            '.server-name',
            '[class*="server"] [class*="name"]',
            'nav [class*="branding"] span',
            '.burger-menu span'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
                return el.textContent.trim();
            }
        }
        return null;
    },

    /**
     * Validate Lutheus server access
     * @returns {{valid: boolean, guildId: string|null, serverName: string|null, message: string}}
     */
    validate() {
        const guildId = this.getGuildIdFromUrl();
        const serverName = this.getServerNameFromPage();

        if (!guildId) {
            return {
                valid: false,
                guildId: null,
                serverName: null,
                message: 'Dashboard sayfasında değilsiniz.'
            };
        }

        if (!this.isLutheus(guildId)) {
            return {
                valid: false,
                guildId: guildId,
                serverName: serverName,
                message: `❌ Lütfen Lutheus sunucusuna geçin.\n\nBu eklenti yalnızca Lutheus sunucusunda çalışır.\n\nMevcut: ${serverName || guildId}\nGerekli: Lutheus (${this.LUTHEUS_GUILD_ID})`
            };
        }

        return {
            valid: true,
            guildId: guildId,
            serverName: serverName || this.LUTHEUS_NAME,
            message: '✅ Lutheus sunucusu doğrulandı.'
        };
    },

    /**
     * Show warning overlay when not on Lutheus
     * @param {string} message - Warning message to display
     */
    showWarningOverlay(message) {
        // Remove existing overlay if any
        const existing = document.getElementById('lutheus-guard-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'lutheus-guard-overlay';
        overlay.innerHTML = `
            <style>
                #lutheus-guard-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.95);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                }
                .lutheus-guard-content {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid rgba(138, 43, 226, 0.3);
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 450px;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(138, 43, 226, 0.2);
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .lutheus-guard-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .lutheus-guard-title {
                    color: #ff4757;
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 16px;
                }
                .lutheus-guard-message {
                    color: #a0a0a0;
                    font-size: 14px;
                    line-height: 1.6;
                    white-space: pre-line;
                    margin-bottom: 24px;
                }
                .lutheus-guard-btn {
                    background: linear-gradient(135deg, #8a2be2, #6a1b9a);
                    color: white;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .lutheus-guard-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(138, 43, 226, 0.4);
                }
            </style>
            <div class="lutheus-guard-content">
                <div class="lutheus-guard-icon">🛡️</div>
                <div class="lutheus-guard-title">Lutheus Guard</div>
                <div class="lutheus-guard-message">${message}</div>
                <button class="lutheus-guard-btn" onclick="window.location.href='https://dashboard.sapph.xyz/1223431616081166336/moderation/cases'">
                    Lutheus'a Git
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
    },

    /**
     * Remove warning overlay
     */
    hideWarningOverlay() {
        const overlay = document.getElementById('lutheus-guard-overlay');
        if (overlay) overlay.remove();
    },

    /**
     * Initialize guard - call on page load
     * @returns {boolean} - True if validation passed
     */
    init() {
        const result = this.validate();

        if (!result.valid) {
            this.showWarningOverlay(result.message);
            console.warn('Lutheus Guard:', result.message);
            return false;
        }

        console.log('Lutheus Guard:', result.message);
        return true;
    }
};

// Export for use in content scripts
if (typeof window !== 'undefined') {
    window.LutheusGuard = LutheusGuard;
}
