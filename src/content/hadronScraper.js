// Lutheus CezaRapor - Hadron Transcript Scraper v3.0
// Kazıma hedefi: https://dash.hadron.bot/manage/*/transcripts
//
// Strateji:
//   1. Listedeki tablo satırlarını parse et (Ticket ID, Username, Rating, Close Reason)
//   2. Her bilet için Hadron REST API'sini çağır:
//      GET https://api.hadron.bot/api/{guildId}/transcripts/{ticketId}/render
//   3. API response'undan entities.users içindeki bot olmayan ilk kullanıcının Discord ID'sini al
//   4. Supabase user_tickets tablosuna UPSERT et

'use strict';

(function initHadronScraper() {
    const SUPABASE_URL = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';
    const HADRON_BOT_ID = '435890325098201108'; // Hadron Bot'un Discord ID'si
    
    // ─── Hadron JWT token'ı localStorage'dan al ──────────────────────────────
    function getHadronToken() {
        try {
            return localStorage.getItem('token') || null;
        } catch (_) {
            return null;
        }
    }

    // ─── Guild ID URL'den al ────────────────────────────────────────────────
    function getGuildId() {
        const match = window.location.pathname.match(/\/manage\/(\d+)/);
        return match ? match[1] : '1223431616081166336';
    }

    // ─── Hadron API: Transcript render endpoint ──────────────────────────────
    // Dönen JSON: {entities: {users: {id: {username, avatar, badge?}}, ...}, messages: [...], channel_name: "ticket-87"}
    async function fetchTranscriptData(guildId, ticketId, token) {
        try {
            const url = `https://api.hadron.bot/api/${guildId}/transcripts/${ticketId}/render`;
            const res = await fetch(url, {
                headers: {
                    'authorization': token,
                    'x-tickets': 'true',
                    'accept': 'application/json',
                    'origin': 'https://dash.hadron.bot',
                    'referer': `https://dash.hadron.bot/manage/${guildId}/transcripts/view/${ticketId}`,
                },
                credentials: 'include',
            });
            if (!res.ok) {
                console.warn(`[Lutheus Hadron Scraper] API hata ${res.status} - ticket #${ticketId}`);
                return null;
            }
            return await res.json();
        } catch (err) {
            console.error('[Lutheus Hadron Scraper] fetchTranscriptData error:', err);
            return null;
        }
    }

    // ─── Transcript datasından ticket sahibinin Discord ID'sini bul ─────────
    // entities.users içinde bot olmayan, ilk mesajı gönderen kullanıcıyı bul
    function extractOwnerIdFromTranscript(data, usernameHint) {
        if (!data || !data.entities || !data.entities.users) return null;

        const users = data.entities.users;
        
        // 1. Bot olmayan kullanıcıları listele
        const humanUsers = Object.entries(users).filter(([id, u]) => {
            return id !== HADRON_BOT_ID && !u.badge;
        });
        
        // 2. Username hint ile eşleşen kullanıcı ara (en güvenilir)
        if (usernameHint) {
            const lowerHint = usernameHint.toLowerCase().trim();
            const matchedEntry = humanUsers.find(([id, u]) => 
                u.username && u.username.toLowerCase() === lowerHint
            );
            if (matchedEntry) return matchedEntry[0];
        }

        // 3. İlk mesajın sahibini bul (genellikle talebi açan)
        if (data.messages && data.messages.length > 0) {
            for (const msg of data.messages) {
                const authorId = msg.author;
                if (authorId && authorId !== HADRON_BOT_ID && users[authorId] && !users[authorId].badge) {
                    return authorId;
                }
            }
        }

        // 4. Eğer hâlâ bulunamadıysa, tek insan kullanıcıyı döndür
        if (humanUsers.length === 1) return humanUsers[0][0];

        // 5. İlk insan kullanıcıyı döndür
        if (humanUsers.length > 0) return humanUsers[0][0];

        return null;
    }

    // ─── Supabase'den username ile user ID ara (fallback) ───────────────────
    async function findUserIdByUsername(username) {
        if (!username) return null;
        const cleanUsername = username.replace(/[@#]/g, '').trim();
        try {
            const res = await fetch(
                `${SUPABASE_URL}/sapphire_cases?select=punished_user_discord_id&punished_user_display_name=ilike.${encodeURIComponent(cleanUsername)}&limit=1`,
                { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].punished_user_discord_id) return data[0].punished_user_discord_id;
            }
        } catch (_) {}
        try {
            const res = await fetch(
                `${SUPABASE_URL}/staff_profiles?select=discord_id&display_name=ilike.${encodeURIComponent(cleanUsername)}&limit=1`,
                { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].discord_id) return data[0].discord_id;
            }
        } catch (_) {}
        return null;
    }

    // ─── Supabase UPSERT ─────────────────────────────────────────────────────
    async function supabaseUpsert(table, record) {
        try {
            const url = `${SUPABASE_URL}/${table}?on_conflict=ticket_id`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey':        SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type':  'application/json',
                    'Prefer':        'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify(record),
            });
            if (!res.ok && res.status !== 204) {
                const errText = await res.text();
                console.error('[Lutheus Hadron Scraper] UPSERT hatası:', table, '-', res.status, errText);
                return false;
            }
            return true;
        } catch (error) {
            console.error('[Lutheus Hadron Scraper] UPSERT exception:', error);
            return false;
        }
    }

    // ─── Bir tablo satırını işle ─────────────────────────────────────────────
    // Tablo sütunları: [0] Ticket ID | [1] Username | [2] Rating | [3] Close Reason | [4] View
    async function processRow(rowEl) {
        try {
            const cells = rowEl.querySelectorAll('td');
            if (cells.length < 4) return;

            const ticketIdText = cells[0].textContent.trim();
            const username     = cells[1].textContent.trim();
            const ratingText   = cells[2] ? cells[2].textContent.trim() : '';
            const closeReason  = cells[3] ? cells[3].textContent.trim() : '';

            if (!ticketIdText) return;

            // Sayısal ticket ID
            const numMatch = ticketIdText.match(/(\d+)/);
            if (!numMatch) return;
            const ticketId   = numMatch[1];
            const ticketName = `ticket-${ticketId.padStart(4, '0')}`;

            // Transcript URL (View butonu linki)
            const viewLinkEl  = cells[cells.length - 1].querySelector('a');
            let transcriptUrl = viewLinkEl ? viewLinkEl.href : null;
            if (!transcriptUrl || !transcriptUrl.includes('/view/')) {
                const gId = getGuildId();
                transcriptUrl = `https://dash.hadron.bot/manage/${gId}/transcripts/view/${ticketId}`;
            }

            // Session deduplication
            const processedKey = `hadron_v3_${ticketId}`;
            if (sessionStorage.getItem(processedKey)) return;

            console.log(`[Lutheus Hadron Scraper] 🔍 #${ticketId} işleniyor (${username})...`);

            // ── Discord ID çözümleme (3 aşamalı) ────────────────────────────
            let userId = null;
            const guildId = getGuildId();
            const token   = getHadronToken();

            // Aşama 1: Hadron API'den transcript verisini çek
            if (token) {
                const transcriptData = await fetchTranscriptData(guildId, ticketId, token);
                if (transcriptData) {
                    userId = extractOwnerIdFromTranscript(transcriptData, username);
                    if (userId) {
                        console.log(`[Lutheus Hadron Scraper] ✅ ID Hadron API'den bulundu: ${userId} (${username})`);
                    }
                }
            } else {
                console.warn('[Lutheus Hadron Scraper] ⚠️ Hadron JWT token bulunamadı. localStorage.token eksik.');
            }

            // Aşama 2: Supabase'de username ile ara
            if (!userId && username) {
                userId = await findUserIdByUsername(username);
                if (userId) {
                    console.log(`[Lutheus Hadron Scraper] ✅ ID Supabase'den bulundu: ${userId} (${username})`);
                }
            }

            // Aşama 3: ID bulunamadı, yine de kaydet
            if (!userId) {
                console.warn(`[Lutheus Hadron Scraper] ⚠️ Discord ID bulunamadı: ${username} (#${ticketId}). user_id=null olarak kaydediliyor.`);
            }

            // Rating parse
            let rating = null;
            if (ratingText && ratingText.toLowerCase() !== 'no rating') {
                const ratingNum = ratingText.match(/(\d+)/);
                if (ratingNum) rating = parseInt(ratingNum[1], 10);
            }

            const record = {
                ticket_id:      ticketId,
                ticket_name:    ticketName,
                user_id:        userId || null,
                user_tag:       username || null,
                category:       closeReason ? closeReason.slice(0, 100) : null,
                transcript_url: transcriptUrl,
                ...(rating !== null ? { rating } : {}),
            };

            const success = await supabaseUpsert('user_tickets', record);
            if (success) {
                console.log(`[Lutheus Hadron Scraper] 💾 #${ticketId} kaydedildi${userId ? ' | ID: ' + userId : ' | ID yok'}`);
                sessionStorage.setItem(processedKey, 'true');
            }
        } catch (err) {
            console.error('[Lutheus Hadron Scraper] Row parse hatası:', err);
        }
    }

    async function processDetailedTicketView(ticketId) {
        try {
            const guildId = getGuildId();
            const token = getHadronToken();
            if (!token) {
                console.error("[Lutheus Hadron Scraper] Token missing on view page.");
                if (isExtensionContextValid()) {
                    chrome.runtime.sendMessage({ action: 'DETAILED_TICKET_SCANNED', ticketId, success: false });
                }
                return;
            }

            console.log(`[Lutheus Hadron Scraper] Starting detailed scan for ticket #${ticketId}`);
            const data = await fetchTranscriptData(guildId, ticketId, token);
            if (!data) {
                console.error("[Lutheus Hadron Scraper] Failed to fetch transcript data from API.");
                if (isExtensionContextValid()) {
                    chrome.runtime.sendMessage({ action: 'DETAILED_TICKET_SCANNED', ticketId, success: false });
                }
                return;
            }

            const ownerId = extractOwnerIdFromTranscript(data);
            const ownerUser = data.entities?.users?.[ownerId];
            const ownerTag = ownerUser ? ownerUser.username : null;

            const users = data.entities?.users || {};
            const messages = data.messages || [];

            const modIds = Object.keys(users).filter(id => {
                if (id === HADRON_BOT_ID) return false;
                const u = users[id];
                return u.badge || u.isStaff || (u.roles && u.roles.length > 0);
            });

            const humanMods = Object.keys(users).filter(id => {
                return id !== HADRON_BOT_ID && id !== ownerId;
            });

            const activeModList = modIds.length > 0 ? modIds : humanMods;

            let firstResponderId = null;
            for (const msg of messages) {
                const authorId = msg.author;
                if (activeModList.includes(authorId)) {
                    firstResponderId = authorId;
                    break;
                }
            }

            let lastMessengerId = null;
            let lastMessageContent = "";
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg.author && msg.author !== HADRON_BOT_ID) {
                    lastMessengerId = msg.author;
                    lastMessageContent = msg.content || "";
                    break;
                }
            }

            let assignedModId = lastMessengerId;
            const closerUser = users[lastMessengerId];
            const closerRoles = closerUser?.roles || [];
            
            const isSeniorRole = (roleName) => {
                if (!roleName) return false;
                const r = roleName.toLowerCase();
                return r.includes('senior') || r.includes('kidemli') || r.includes('yonetici') || r.includes('admin') || r.includes('kurucu') || r.includes('genel_sorumlu');
            };

            const isSeniorCloser = closerRoles.some(r => isSeniorRole(r.name)) || 
                                   isSeniorRole(closerUser?.badge) || 
                                   (closerUser?.username && isSeniorRole(closerUser.username));

            if (isSeniorCloser) {
                const tags = lastMessageContent.match(/<@!?(\d+)>/g);
                let taggedModId = null;
                if (tags) {
                    for (const tag of tags) {
                        const match = tag.match(/<@!?(\d+)>/);
                        const id = match ? match[1] : null;
                        if (id && activeModList.includes(id)) {
                            taggedModId = id;
                            break;
                        }
                    }
                }

                if (taggedModId) {
                    assignedModId = taggedModId;
                    console.log(`[Lutheus Hadron Scraper] Senior mod closer delegated credit to tagged mod: ${assignedModId}`);
                } else if (firstResponderId) {
                    assignedModId = firstResponderId;
                    console.log(`[Lutheus Hadron Scraper] Senior mod closer delegated credit to first responder mod: ${assignedModId}`);
                }
            }

            // Scrape Close Reason (Category) from DOM if possible (usually close message embeds have close reason)
            let closeReason = null;
            const embedFields = document.querySelectorAll('[class*="embedField"]');
            embedFields.forEach(f => {
                const name = f.querySelector('[class*="embedFieldName"]')?.textContent || '';
                const val = f.querySelector('[class*="embedFieldValue"]')?.textContent || '';
                if (name.toLowerCase().includes('kapatılma sebebi') || name.toLowerCase().includes('kategori')) {
                    closeReason = val.trim();
                }
            });

            const transcriptJson = {
                messages: messages.map(msg => ({
                    id: msg.id,
                    author: {
                        id: msg.author,
                        username: users[msg.author]?.username || 'Bilinmeyen',
                        avatar: users[msg.author]?.avatar || null,
                        badge: users[msg.author]?.badge || null,
                        is_bot: msg.author === HADRON_BOT_ID || !!users[msg.author]?.badge?.includes('bot')
                    },
                    content: msg.content,
                    timestamp: msg.timestamp,
                    embeds: msg.embeds,
                    attachments: msg.attachments
                })),
                entities: data.entities,
                channel_name: data.channel_name || `ticket-${ticketId}`
            };

            const record = {
                ticket_id: ticketId,
                ticket_name: data.channel_name || `ticket-${ticketId.padStart(4, '0')}`,
                user_id: ownerId || null,
                user_tag: ownerTag || null,
                category: closeReason || null,
                assigned_mod_id: assignedModId || null,
                transcript_json: transcriptJson
            };

            console.log(`[Lutheus Hadron Scraper] Scraped detailed ticket #${ticketId}. Assigned Mod: ${assignedModId}`);

            const success = await supabaseUpsert('user_tickets', record);
            if (isExtensionContextValid()) {
                chrome.runtime.sendMessage({ action: 'DETAILED_TICKET_SCANNED', ticketId, success });
            }
        } catch (err) {
            console.error('[Lutheus Hadron Scraper] processDetailedTicketView error:', err);
            if (isExtensionContextValid()) {
                chrome.runtime.sendMessage({ action: 'DETAILED_TICKET_SCANNED', ticketId, success: false });
            }
        }
    }

    // ─── Tüm tablo satırlarını tara ──────────────────────────────────────────
    function scanTable() {
        const rows = document.querySelectorAll('table tbody tr');
        if (!rows || rows.length === 0) {
            return;
        }
        console.log(`[Lutheus Hadron Scraper] 📋 ${rows.length} satır bulundu.`);

        if (isExtensionContextValid()) {
            chrome.storage.local.get(['detailedTicketScan'], (res) => {
                const isDetailed = res && res.detailedTicketScan;
                if (isDetailed) {
                    const ticketIds = [];
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 4) {
                            const ticketIdText = cells[0].textContent.trim();
                            const numMatch = ticketIdText.match(/(\d+)/);
                            if (numMatch) {
                                ticketIds.push(numMatch[1]);
                            }
                        }
                    });

                    if (ticketIds.length > 0) {
                        console.log(`[Lutheus Hadron Scraper] Detailed ticket scan enabled. Queueing ${ticketIds.length} tickets.`);
                        chrome.runtime.sendMessage({
                            action: 'START_DETAILED_TICKET_SCAN',
                            ticketIds: ticketIds
                        });
                    }
                }
            });
        }

        // Run processRow sequentially with a delay to prevent API hammering (Rate limit 429)
        (async () => {
            for (const row of rows) {
                await processRow(row);
                await new Promise(r => setTimeout(r, 1500)); // 1.5 second delay between API calls
            }
        })();
    }

    // ─── Debounced tarama ────────────────────────────────────────────────────
    let scanTimeout = null;
    function triggerScan() {
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanTable, 800);
    }

    // ─── MutationObserver ────────────────────────────────────────────────────
    let activeObserver = null;

    function initObserver() {
        triggerScan();
        activeObserver = new MutationObserver(() => triggerScan());
        activeObserver.observe(document.body, { childList: true, subtree: true });
        console.log('[Lutheus Hadron Scraper] ✅ Observer aktif. dash.hadron.bot/transcripts hazır.');
    }

    // ─── Extension context guard ─────────────────────────────────────────────
    function isExtensionContextValid() {
        try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
    }

    // ─── Global API ──────────────────────────────────────────────────────────
    window.GearTech = window.GearTech || {};
    window.GearTech.HadronScraper = {
        startScan() {
            if (!activeObserver) initObserver();
            else triggerScan();
            return { started: true };
        },
        stopScan() {
            if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
            return { stopped: true };
        },
        rescan() {
            const keys = Object.keys(sessionStorage).filter(k => k.startsWith('hadron_v3_'));
            keys.forEach(k => sessionStorage.removeItem(k));
            console.log(`[Lutheus Hadron Scraper] 🔄 ${keys.length} kayıt temizlendi, yeniden taranıyor...`);
            triggerScan();
            return { rescanning: true, cleared: keys.length };
        },
        debug() {
            const token = getHadronToken();
            const guildId = getGuildId();
            const rows = document.querySelectorAll('table tbody tr');
            return { hasToken: !!token, guildId, rowCount: rows.length };
        }
    };

    // ─── Chrome runtime mesaj handler ────────────────────────────────────────
    if (isExtensionContextValid()) {
        chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
            try {
                if (request.action === 'HADRON_SCRAPER_START' || request.action === 'DISCORD_SCRAPER_START') {
                    sendResponse({ success: true, ...window.GearTech.HadronScraper.startScan() });
                } else if (request.action === 'HADRON_SCRAPER_STOP' || request.action === 'DISCORD_SCRAPER_STOP') {
                    sendResponse({ success: true, ...window.GearTech.HadronScraper.stopScan() });
                } else if (request.action === 'HADRON_SCRAPER_RESCAN') {
                    sendResponse({ success: true, ...window.GearTech.HadronScraper.rescan() });
                }
            } catch (error) {
                console.warn('[Lutheus Hadron Scraper] Mesaj hatası:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        });
    }

    // ─── Başlat ──────────────────────────────────────────────────────────────
    const viewMatch = window.location.pathname.match(/\/transcripts\/view\/(\d+)/);
    if (viewMatch) {
        const ticketId = viewMatch[1];
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => processDetailedTicketView(ticketId));
        } else {
            processDetailedTicketView(ticketId);
        }
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initObserver);
        } else {
            initObserver();
        }
    }
})();
