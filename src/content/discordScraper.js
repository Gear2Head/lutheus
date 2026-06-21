// Lutheus CezaRapor - Discord Log Scraper v1.0
// Kazıma hedefleri:
//   #dispute-logs  (Appeal.gg itiraz logları)  — Kanal ID: 1445465527223980042
//   #ticket-logs   (Hadron destek talebi logları)
//
// Mimari: MutationObserver ile DOM'u izle → embed parse et → Supabase UPSERT

'use strict';

(function initDiscordScraper() {
    const SUPABASE_URL       = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1';
    const SUPABASE_STORAGE_URL = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/storage/v1';
    const SUPABASE_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';

    const DISPUTE_CHANNEL_ID  = '1445465527223980042';
    const EVIDENCE_CHANNEL_ID  = '1445462327141863657';
    const TICKET_CHANNEL_ID    = '1445465595435814933'; // #ticket-logs (Hadron)
    const SEEN_KEY             = 'lutheus_scraped_msg_ids';
    const SESSION_KEY          = 'lutheusAuthSession';

    // ─── Kullanıcının JWT'sini chrome.storage'dan al (RLS bypass) ───────────
    // Anon key ile sapphire_cases okuyamıyoruz (authenticated-only RLS).
    // Bu yüzden giriş yapmış kullanıcının idToken'ını kullanıyoruz.
    let _cachedAuthToken = null;

    async function getSupabaseAuthToken() {
        if (_cachedAuthToken) return _cachedAuthToken;
        if (!isExtensionContextValid()) return SUPABASE_KEY;
        try {
            return await new Promise((resolve) => {
                chrome.storage.local.get([SESSION_KEY], (result) => {
                    if (chrome.runtime.lastError || !result[SESSION_KEY]) {
                        console.warn('[Lutheus Scraper] Auth token not found, using anon key');
                        resolve(SUPABASE_KEY);
                        return;
                    }
                    const session = result[SESSION_KEY];
                    const token = session.idToken || SUPABASE_KEY;
                    _cachedAuthToken = token;
                    console.log('[Lutheus Scraper] Using authenticated token for Supabase requests');
                    resolve(token);
                });
            });
        } catch (e) {
            return SUPABASE_KEY;
        }
    }

    // Token cache'ini temizle (yeni login sonrası)
    function invalidateAuthCache() {
        _cachedAuthToken = null;
    }

    // ─── Supabase Storage Upload ──────────────────────────────────────
    // Discord CDN linkleri expire olabiliyor. Bu fonksiyon ile
    // kanıt görsellerini Supabase Storage'a kaydediyoruz.
    async function uploadToStorage(discordUrl, caseId, index = 0) {
        if (!discordUrl) return null;
        // Zaten storage'da ise olduğu gibi döndür
        if (discordUrl.includes('supabase.co/storage')) return discordUrl;
        // 'This content is no longer available' gibi dead link kontrolu
        // Upload öncesinde GET ile erişilebilirliği test et
        try {
            const checkRes = await fetch(discordUrl, { method: 'HEAD' });
            if (!checkRes.ok) {
                console.warn(`[Lutheus Scraper] CDN link dead (${checkRes.status}), skipping upload: ${discordUrl.slice(0, 60)}`);
                return null; // Erişilemeyen link - null döndür, DB'ye boş yaz
            }
        } catch (_) {
            console.warn('[Lutheus Scraper] CDN link not reachable, skipping upload');
            return null;
        }

        try {
            const authToken = await getSupabaseAuthToken();
            // Dosya uzantısını URL'den al
            const urlPath = new URL(discordUrl).pathname;
            const ext = urlPath.split('.').pop()?.split('?')[0]?.toLowerCase() || 'png';
            const safeExt = ['png','jpg','jpeg','gif','webp','mp4','mov','webm'].includes(ext) ? ext : 'png';
            const fileName = `proofs/${caseId}_${Date.now()}_${index}.${safeExt}`;

            // Discord CDN'den indir
            const dlRes = await fetch(discordUrl);
            if (!dlRes.ok) return null;
            const blob = await dlRes.blob();

            // Supabase Storage'a yükle
            const uploadRes = await fetch(
                `${SUPABASE_STORAGE_URL}/object/case-proofs/${fileName}`,
                {
                    method: 'POST',
                    headers: {
                        'apikey':        SUPABASE_KEY,
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type':  blob.type || 'image/png',
                        'x-upsert':      'true',
                    },
                    body: blob,
                }
            );

            if (!uploadRes.ok) {
                const err = await uploadRes.text();
                console.error('[Lutheus Scraper] Storage upload failed:', uploadRes.status, err.slice(0, 200));
                return discordUrl; // Upload başarısız ise orijinal URL'yi kullan
            }

            const publicUrl = `${SUPABASE_STORAGE_URL}/object/public/case-proofs/${fileName}`;
            console.log(`[Lutheus Scraper] ✓ Uploaded to storage: ${fileName}`);
            return publicUrl;
        } catch (err) {
            console.error('[Lutheus Scraper] Storage upload error:', err);
            return discordUrl; // Hata durumunda orijinal URL
        }
    }

    // ─── Supabase UPSERT helper ──────────────────────────────────────────────
    async function supabaseUpsert(table, record, onConflictKey = 'discord_message_id') {
        try {
            const authToken = await getSupabaseAuthToken();
            const url = `${SUPABASE_URL}/${table}?on_conflict=${onConflictKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey':       SUPABASE_KEY,
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Prefer':       'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify(record),
            });
            if (!res.ok && res.status !== 204) {
                const errText = await res.text();
                console.error('Lutheus Scraper Fail: UPSERT error on', table, '-', res.status, errText);
            }
        } catch (error) {
            console.error('Lutheus Scraper Fail:', error);
        }
    }

    // ─── Extension context guard ─────────────────────────────────────────────
    // Content script'in context'i geçersiz olduğunda (extension reload sonrası)
    // tüm chrome API çağrıları "Extension context invalidated" fırlatır.
    // Bu guard bunu sessizce yakalar.
    function isExtensionContextValid() {
        try {
            return !!(chrome && chrome.runtime && chrome.runtime.id);
        } catch (_) {
            return false;
        }
    }

    // ─── chrome.storage.local deduplication ────────────────────────────────
    async function isAlreadySeen(msgId) {
        if (!isExtensionContextValid()) return false;
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get([SEEN_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Lutheus Scraper Fail: storage read error', chrome.runtime.lastError);
                        resolve(false);
                        return;
                    }
                    const set = result[SEEN_KEY] || [];
                    resolve(set.includes(msgId));
                });
            });
        } catch (error) {
            console.warn('Lutheus Scraper Fail: storage read error', error);
            return false;
        }
    }

    async function markAsSeen(msgId) {
        if (!isExtensionContextValid()) return;
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get([SEEN_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Lutheus Scraper Fail: storage write error', chrome.runtime.lastError);
                        resolve();
                        return;
                    }
                    const set = result[SEEN_KEY] || [];
                    if (!set.includes(msgId)) {
                        set.push(msgId);
                        // Sonsuz büyümeyi önle — son 5000 ID sakla
                        const capped = set.length > 5000 ? set.slice(-5000) : set;
                        chrome.storage.local.set({ [SEEN_KEY]: capped }, () => {
                            if (chrome.runtime.lastError) {
                                console.warn('Lutheus Scraper Fail: storage set error', chrome.runtime.lastError);
                            }
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.warn('Lutheus Scraper Fail: storage write error', error);
        }
    }

    // ─── Yardımcı: metinden Discord ID ayıkla ──────────────────────────────
    function extractDiscordId(text) {
        if (!text) return null;
        // <@123456789012345678> veya saf ID: 123456789012345678
        const mentionMatch = String(text).match(/<@!?(\d{17,20})>/);
        if (mentionMatch) return mentionMatch[1];
        const rawMatch = String(text).match(/(\d{17,20})/);
        return rawMatch ? rawMatch[1] : null;
    }

    // Snowflake ID'den mesaj tarihini hassas bir şekilde çekme (Discord Epoch = 2015)
    function getTimestampFromSnowflake(idStr) {
        try {
            const snowflake = BigInt(idStr);
            const timestampMs = Number((snowflake >> 22n) + 1420070400000n);
            return new Date(timestampMs);
        } catch (e) {
            return new Date();
        }
    }

    // ─── Embed alan değerini bul ─────────────────────────────────────────────
    // Discord embed alanları: <div class="embedField_*">
    //   <div class="embedFieldName_*">Field Name</div>
    //   <div class="embedFieldValue_*">Field Value</div>
    function getEmbedFieldValue(embedEl, fieldNameSubstring) {
        if (!embedEl) return null;
        const fieldNameEls = embedEl.querySelectorAll('[class*="embedFieldName"]');
        for (const nameEl of fieldNameEls) {
            if (nameEl.textContent.toLowerCase().includes(fieldNameSubstring.toLowerCase())) {
                const parent = nameEl.closest('[class*="embedField"]');
                if (!parent) continue;
                const valueEl = parent.querySelector('[class*="embedFieldValue"]');
                return valueEl ? valueEl.textContent.trim() : null;
            }
        }
        return null;
    }

    function getEmbedFieldValueElement(embedEl, fieldNameSubstring) {
        if (!embedEl) return null;
        const fieldNameEls = embedEl.querySelectorAll('[class*="embedFieldName"]');
        for (const nameEl of fieldNameEls) {
            if (nameEl.textContent.toLowerCase().includes(fieldNameSubstring.toLowerCase())) {
                const parent = nameEl.closest('[class*="embedField"]');
                if (!parent) continue;
                return parent.querySelector('[class*="embedFieldValue"]');
            }
        }
        return null;
    }

    function getUserIdFromMention(mentionEl) {
        if (!mentionEl) return null;
        const dataId = mentionEl.getAttribute('data-user-id') || mentionEl.getAttribute('data-id');
        if (dataId && /^\d{17,20}$/.test(dataId)) return dataId;

        const key = Object.keys(mentionEl).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (key) {
            const props = mentionEl[key];
            if (props) {
                if (props.userId) return String(props.userId);
                if (props.id) return String(props.id);
                if (props.user && props.user.id) return String(props.user.id);
            }
        }
        return null;
    }

    function getUserIdFromProps(el) {
        if (!el) return null;
        const key = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$') || k.startsWith('__reactInternalInstance$'));
        if (!key) return null;
        const props = el[key];
        if (!props) return null;
        
        if (props.userId) return String(props.userId);
        if (props.id) {
            const strId = String(props.id);
            if (/^\d{17,20}$/.test(strId)) return strId;
        }
        if (props.user && props.user.id) return String(props.user.id);
        
        try {
            if (props.children) {
                const children = Array.isArray(props.children) ? props.children : [props.children];
                for (const child of children) {
                    if (child && child.props) {
                        if (child.props.userId) return String(child.props.userId);
                        if (child.props.id) return String(child.props.id);
                        if (child.props.user && child.props.user.id) return String(child.props.user.id);
                    }
                }
            }
        } catch (_) {}
        
        return null;
    }

    function extractIdFromElement(el) {
        if (!el) return null;
        const mention = el.querySelector('[class*="mention"]');
        if (mention) {
            const id = getUserIdFromMention(mention);
            if (id) return id;
        }
        const text = el.textContent || '';
        const idMatch = text.match(/(\d{17,20})/);
        if (idMatch) return idMatch[1];
        
        const idFromProps = getUserIdFromProps(el) || (mention ? getUserIdFromProps(mention) : null);
        if (idFromProps) return idFromProps;

        return null;
    }

    async function findUserIdByUsername(username) {
        if (!username) return null;
        const cleanUsername = username.replace(/[@#]/g, '').trim();
        try {
            let res = await fetch(`${SUPABASE_URL}/sapphire_cases?select=punished_user_discord_id&punished_user_display_name=ilike.${encodeURIComponent(cleanUsername)}&limit=1`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].punished_user_discord_id) {
                    return data[0].punished_user_discord_id;
                }
            }
        } catch (_) {}
        try {
            let res = await fetch(`${SUPABASE_URL}/staff_profiles?select=discord_id&display_name=ilike.${encodeURIComponent(cleanUsername)}&limit=1`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].discord_id) {
                    return data[0].discord_id;
                }
            }
        } catch (_) {}
        return null;
    }

    // ─── Embed başlık/açıklama al ───────────────────────────────────────────
    function getEmbedTitle(embedEl) {
        if (!embedEl) return '';
        const titleEl = embedEl.querySelector(
            '[class*="embedTitle"], [class*="embedDescription"], h2, h3'
        );
        return titleEl ? titleEl.textContent.trim() : '';
    }

    function getEmbedDescription(embedEl) {
        if (!embedEl) return '';
        const descEl = embedEl.querySelector('[class*="embedDescription"]');
        return descEl ? descEl.textContent.trim() : '';
    }

    // ─── Discord message ID DOM'dan al ─────────────────────────────────────
    // Mesaj element'inin id'si "chat-messages-123456789" formatında olabilir
    // veya data-id attribute'u
    function getMessageId(messageEl) {
        if (!messageEl) return null;
        const id = messageEl.id || messageEl.getAttribute('data-id') || '';
        // Format: "chat-messages-GUILDID-MSGID" veya "message-content-MSGID"
        const match = id.match(/(\d{17,20})(?!.*\d{17,20})/);
        if (match) return match[1];

        // aria-label üzerinden dene
        const label = messageEl.getAttribute('aria-label') || '';
        const labelMatch = label.match(/(\d{17,20})/);
        return labelMatch ? labelMatch[1] : null;
    }

    // ─── Bilgileri Etiketlere Göre Ayıklama Yardımcısı ────────────────────────
    function getValueByLabels(embedEl, fullText, labels) {
        // Try embed fields first
        for (const label of labels) {
            const val = getEmbedFieldValue(embedEl, label);
            if (val) return val.trim();
        }
        // Try regex patterns in fullText
        for (const label of labels) {
            const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('(?:' + escapedLabel + ')\\s*[:\\s#-]+\\s*([^\\n]+)', 'i');
            const match = fullText.match(regex);
            if (match) return match[1].trim();
        }
        return null;
    }

    // ─── Embed Description İçindeki <small> ve <strong> Alanlarını Çekme ───────
    function getDescriptionFields(embedEl) {
        const fields = {};
        if (!embedEl) return fields;
        const descEl = embedEl.querySelector('[class*="embedDescription"]');
        if (!descEl) return fields;

        const smalls = descEl.querySelectorAll('small');
        smalls.forEach(small => {
            const strongEl = small.querySelector('strong');
            if (!strongEl) return;
            const label = strongEl.textContent.replace(/:/g, '').trim().toLowerCase();
            
            const clone = small.cloneNode(true);
            const strongInClone = clone.querySelector('strong');
            if (strongInClone) strongInClone.remove();
            
            const linkEl = clone.querySelector('a');
            let val = '';
            if (linkEl) {
                val = linkEl.textContent.trim();
            } else {
                val = clone.textContent.trim();
            }
            
            if (label && val) {
                fields[label] = val;
            }
        });
        return fields;
    }

    // ─── Mevcut kanal ID'sini URL'den al ───────────────────────────────────
    function getCurrentChannelId() {
        // discord.com/channels/GUILDID/CHANNELID
        const match = window.location.pathname.match(/\/channels\/\d+\/(\d+)/);
        return match ? match[1] : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  #dispute-logs PARSER (Appeal.gg Embed'leri)
    // ═══════════════════════════════════════════════════════════════════════
    async function parseDisputeMessage(messageEl, force = false) {
        try {
            const msgId = getMessageId(messageEl);
            if (!msgId) return;

            if (!force) {
                const alreadySeen = await isAlreadySeen(msgId);
                if (alreadySeen) return;
            }

            const embedEl = messageEl.querySelector('[class*="embed"]');
            if (!embedEl) return;

            const title = getEmbedTitle(embedEl);
            const description = getEmbedDescription(embedEl);
            const rawFullText = title + ' ' + description + ' ' + embedEl.textContent;
            const fullText = rawFullText.toLowerCase();

            // Yalnızca Appeal Accepted / Rejected / New appeal embed'lerini işle
            const isAccepted = fullText.includes('appeal accepted') || 
                               fullText.includes('itiraz kabul') || 
                               fullText.includes('itiraz onay') || 
                               fullText.includes('kabul edildi') || 
                               fullText.includes('onaylandı');
            const isRejected = fullText.includes('appeal rejected') || 
                               fullText.includes('itiraz reddedildi') || 
                               fullText.includes('itiraz red') || 
                               fullText.includes('reddedildi');
            const isNewAppeal = fullText.includes('yeni itiraz') || 
                                fullText.includes('new appeal') || 
                                fullText.includes('itiraz form') || 
                                fullText.includes('itiraz gönderildi');
            if (!isAccepted && !isRejected && !isNewAppeal) return;

            let status = 'pending';
            if (isAccepted) status = 'approved';
            else if (isRejected) status = 'rejected';

            const descFields = getDescriptionFields(embedEl);

            // User alanından Discord ID
            let userId = extractDiscordId(descFields['kullanıcı'] || descFields['üye'] || descFields['itiraz eden'] || descFields['user'] ||
                         getValueByLabels(embedEl, description + ' ' + title, ['user', 'kullanıcı', 'üye', 'itiraz eden', 'itirazcı', 'itiraz_eden', 'hesap', 'account']));
            
            if (!userId) {
                // description veya fullText içinde mention var mı?
                userId = extractDiscordId(description) || extractDiscordId(fullText);
            }
            
            if (!userId) {
                const userMatch = fullText.match(/(?:user|kullanıcı|üye|itiraz eden|itirazcı|account|hesap|member)[:\s#-]+(?:<@!?)?(\d{17,20})>?/i);
                if (userMatch) {
                    userId = userMatch[1];
                }
            }

            // Punishment ID alanından case_id (#1754 → "1754")
            let caseId = null;
            const punishmentVal = descFields['ceza id'] || descFields['ceza'] || descFields['itiraz id'] || descFields['case id'] || descFields['case'] || descFields['vaka'] ||
                                  getValueByLabels(embedEl, rawFullText, ['punishment id', 'punishment', 'ceza id', 'ceza', 'case id', 'case', 'vaka', 'itiraz id', 'itiraz no']);
            if (punishmentVal) {
                const idMatch = punishmentVal.match(/#?([A-Za-z0-9]{3,20})/);
                caseId = idMatch ? idMatch[1] : punishmentVal.trim();
            }
            if (!caseId) {
                const caseMatch = rawFullText.match(/(?:punishment id|punishment|ceza id|ceza|case id|case|vaka|itiraz id|itiraz no)[:\s#-]+#?([A-Za-z0-9]{3,20})/i) ||
                                  rawFullText.match(/#([A-Za-z0-9]{3,20})/);
                if (caseMatch) {
                    caseId = caseMatch[1];
                }
            }

            // Build a comprehensive details string to store in appeal_reason
            let fullDetails = '';
            if (title) {
                fullDetails += `[Başlık] ${title}\n`;
            }
            if (description) {
                fullDetails += `[Açıklama]\n${description}\n`;
            }
            
            // Add all embed fields
            const fieldsEls = embedEl.querySelectorAll('[class*="embedField"]');
            if (fieldsEls.length > 0) {
                fullDetails += `\n[Alanlar]\n`;
                fieldsEls.forEach(fieldEl => {
                    const nameEl = fieldEl.querySelector('[class*="embedFieldName"]');
                    const valEl = fieldEl.querySelector('[class*="embedFieldValue"]');
                    if (nameEl && valEl) {
                        fullDetails += `- ${nameEl.textContent.trim()}: ${valEl.textContent.trim()}\n`;
                    }
                });
            }
            
            // Add footer if exists
            const footerEl = embedEl.querySelector('[class*="embedFooterText"]');
            if (footerEl) {
                fullDetails += `\n[Alt Bilgi] ${footerEl.textContent.trim()}\n`;
            }

            let appealReason = fullDetails.trim();
            if (!appealReason) {
                appealReason = title || 'İçerik belirtilmemiş';
            }
            appealReason = appealReason.slice(0, 4000);

            // user_tag embed'de görünen kullanıcı adı
            const userFieldVal = descFields['kullanıcı'] || descFields['üye'] || descFields['user'] ||
                                 getEmbedFieldValue(embedEl, 'user') || getEmbedFieldValue(embedEl, 'kullanıcı') || getEmbedFieldValue(embedEl, 'üye');
            const userTag = userFieldVal
                ? userFieldVal.replace(/<@!?\d{17,20}>/g, '').trim() || null
                : null;

            if (!userId && userTag) {
                userId = await findUserIdByUsername(userTag);
            }

            if (!userId || !appealReason) {
                console.warn('Lutheus Scraper Fail: dispute-logs — userId veya reason eksik. msgId:', msgId, 'userId:', userId, 'reason:', appealReason);
                return;
            }

            const record = {
                case_id:             caseId || null,
                user_id:             userId,
                user_tag:            userTag,
                appeal_reason:       appealReason,
                status:              status,
                discord_message_id:  msgId,
            };

            await supabaseUpsert('case_appeals', record);
            await markAsSeen(msgId);
            console.log(`[Lutheus Scraper] dispute-log kaydedildi: ${msgId} | ${status} | user: ${userId}`);
        } catch (error) {
            console.warn('Lutheus Scraper Fail: parseDisputeMessage error', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  #ceza-kanıtları PARSER
    // ═══════════════════════════════════════════════════════════════════════
    async function parseEvidenceMessage(messageEl, force = false) {
        try {
            const msgId = getMessageId(messageEl);
            if (!msgId) return;

            if (!force) {
                const alreadySeen = await isAlreadySeen(msgId);
                if (alreadySeen) return;
            }

            // ── Mesaj İçerik Metnini Çıkar ─────────────────────────────────
            // messageEl.innerText tüm Discord UI'ı alıyor (yazar adı, timestamp, vs.).
            // Sadece gerçek mesaj içeriğini (ceza satırını) almak için message-content div'ini hedefliyoruz.
            const contentEl = messageEl.querySelector(
                '[id*="message-content-"], [class*="messageContent_"], [class*="markup_"]'
            );
            const rawMessageText = contentEl
                ? (contentEl.innerText || contentEl.textContent || '').trim()
                : (messageEl.innerText || messageEl.textContent || '').trim();
            
            // Boş satırları ve fazladan boşlukları temizle
            const messageText = rawMessageText
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean)
                .join(' ');
            
            // ── Kullanıcı ID'lerini Çıkar ──────────────────────────────────────
            // Sadece mesaj içeriğindeki 17-20 basamaklı Discord ID'leri
            const rawIds = Array.from(messageText.matchAll(/\b(\d{17,20})\b/g)).map(m => m[0]);
            const userIds = Array.from(new Set(rawIds));
            if (userIds.length === 0) return;

            // ── URL Extraction ────────────────────────────────────────────────
            const allUrls = new Set();

            // 1) Discord attachment anchor links (originalLink_*, imageZoom_*)
            //    These have the real CDN href even before lazy-load
            messageEl.querySelectorAll('a[class*="originalLink"], a[class*="imageZoom"], a[class*="imageWrapper"]').forEach(a => {
                const href = a.href || a.getAttribute('href');
                if (href && (href.includes('cdn.discordapp.com/attachments/') || href.includes('media.discordapp.net/attachments/'))) {
                    try {
                        const u = new URL(href);
                        u.searchParams.delete('width');
                        u.searchParams.delete('height');
                        u.searchParams.delete('ex');
                        u.searchParams.delete('is');
                        u.searchParams.delete('hm');
                        allUrls.add(u.toString());
                    } catch (_) {
                        allUrls.add(href);
                    }
                }
            });

            // 2) All other non-discord-channel links
            messageEl.querySelectorAll('a[href]').forEach(a => {
                const href = a.href;
                if (href
                    && !href.includes('discord.com/channels/')
                    && !href.includes('discord.com/users/')
                    && !href.startsWith('data:')
                ) {
                    allUrls.add(href);
                }
            });

            // 3) img src (already loaded ones)
            messageEl.querySelectorAll('img[src]').forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (src
                    && !src.startsWith('data:')
                    && (src.includes('cdn.discordapp.com/attachments/') || src.includes('media.discordapp.net/attachments/'))
                ) {
                    try {
                        const u = new URL(src);
                        u.searchParams.delete('width');
                        u.searchParams.delete('height');
                        allUrls.add(u.toString());
                    } catch (_) {
                        allUrls.add(src);
                    }
                }
            });

            // 4) video elements
            messageEl.querySelectorAll('video').forEach(video => {
                const src = video.src || video.querySelector('source')?.src;
                if (src && !src.startsWith('data:')) allUrls.add(src);
            });

            const urlArray = Array.from(allUrls);

            // 5) Fallback: extract raw https links from text
            if (urlArray.length === 0) {
                const allTextLinks = [...messageText.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(m => m[0]);
                allTextLinks.forEach(l => allUrls.add(l));
                urlArray.push(...allTextLinks);
            }

            if (urlArray.length === 0) {
                // Mesajda hiç link/resim yok — kanıt olarak kaydetme
                await markAsSeen(msgId);
                return;
            }

            const videoUrls = urlArray.filter(url => 
                url.toLowerCase().match(/\.(mp4|mov|webm|mkv|avi)(\?|$)/) || 
                url.includes('youtube.com/') || 
                url.includes('youtu.be/') || 
                url.includes('streamable.com/')
            );
            const imageUrls = urlArray.filter(url => !videoUrls.includes(url));

            const mainProofUrl = imageUrls[0] || null;
            const mainVideoUrl = videoUrls[0] || null;

            const additionalProofs = [];
            const maxLen = Math.max(imageUrls.length, videoUrls.length);
            for (let i = 1; i < maxLen; i++) {
                const img = imageUrls[i] || null;
                const vid = videoUrls[i] || null;
                if (img || vid) {
                    additionalProofs.push({
                        proof_url: img,
                        video_url: vid,
                        raw_text: null
                    });
                }
            }

            // Get message timestamp from Snowflake ID (100% accurate and DOM-independent)
            const msgTime = getTimestampFromSnowflake(msgId);

            console.log(`[Lutheus Scraper] #ceza-kanıtları found userIds:`, userIds, `urls:`, urlArray.length, urlArray);

            // ── Authenticated token (RLS bypass) ─────────────────────────────
            const authToken = await getSupabaseAuthToken();

            // Link evidence to recent cases for each user ID
            for (const targetUserId of userIds) {
                try {
                    // SADECE EN SON 1 DAVA: Her kanıt mesajı her kullanıcı için
                    // yalnızca o kullanıcının en son cezasına bağlanır.
                    // limit=1 → tek bir dava, tarih filtresi yok.
                    // Bu sayede user'ın birden fazla yakın davası varsa hepsine
                    // yanlışlıkla aynı kanıt bağlanmaz.
                    const res = await fetch(
                        `${SUPABASE_URL}/sapphire_cases?punished_user_discord_id=eq.${targetUserId}&order=created_at_sapphire.desc&limit=1`,
                        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}` } }
                    );
                    if (!res.ok) {
                        console.warn(`[Lutheus Scraper] sapphire_cases fetch failed for ${targetUserId}: ${res.status}`);
                        continue;
                    }

                    const recentCases = await res.json();
                    if (!recentCases || recentCases.length === 0) {
                        console.log(`[Lutheus Scraper] No cases found for userId ${targetUserId}`);
                        continue;
                    }

                    // En son davayı al (limit=1 ile zaten tek case geliyor)
                    const matchedCase = recentCases[0];

            // ── Storage'a Upload + DB'ye Kaydet ────────────────────────────────────
            // Discord CDN URL'lerini Supabase Storage'a yükle
            const storedProofUrl   = await uploadToStorage(mainProofUrl, matchedCase.case_id, 0);
            const storedVideoUrl   = mainVideoUrl ? await uploadToStorage(mainVideoUrl, matchedCase.case_id, 0) : null;

            // additional_proofs için de upload yap
            const storedAdditional = [];
            for (let ai = 0; ai < additionalProofs.length; ai++) {
                const ap = additionalProofs[ai];
                const apUrl   = ap.proof_url   ? await uploadToStorage(ap.proof_url,   matchedCase.case_id, ai + 1) : null;
                const apVideo = ap.video_url   ? await uploadToStorage(ap.video_url,   matchedCase.case_id, ai + 1) : null;
                if (apUrl || apVideo) {
                    storedAdditional.push({ proof_url: apUrl, video_url: apVideo, raw_text: ap.raw_text });
                }
            }

            // Dead link ise (upload null döndürirse) proof'u kaydetme
            if (!storedProofUrl && !storedVideoUrl && storedAdditional.length === 0) {
                console.warn(`[Lutheus Scraper] All URLs dead/unavailable for case #${matchedCase.case_id}, skipping proof insert`);
                continue;
            }

            // Temiz raw_text: sadece mesaj içeriği (yazar/timestamp gelmez)
            const record = {
                case_id: matchedCase.case_id,
                proof_url: storedProofUrl,
                video_url: storedVideoUrl,
                raw_text: messageText,
                additional_proofs: storedAdditional.length > 0 ? storedAdditional : null,
                updated_at: new Date().toISOString()
            };

            await supabaseUpsert('case_proofs', record, 'case_id');
            console.log(`[Lutheus Scraper] ✓ Linked evidence to case #${matchedCase.case_id} (user: ${targetUserId}, reason: ${(matchedCase.reason_raw || '').slice(0,40)})`);
                } catch (err) {
                    console.error(`[Lutheus Scraper] Error matching cases for user ${targetUserId}:`, err);
                }
            }

            await markAsSeen(msgId);
        } catch (error) {
            console.warn('Lutheus Scraper Fail: parseEvidenceMessage error', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  #ticket-logs PARSER (Hadron Embed'leri)
    // ═══════════════════════════════════════════════════════════════════════
    async function parseTicketMessage(messageEl) {
        try {
            const msgId = getMessageId(messageEl);
            if (!msgId) return;

            const alreadySeen = await isAlreadySeen(msgId);
            if (alreadySeen) return;

            const embedEl = messageEl.querySelector('[class*="embed"]');
            if (!embedEl) return;

            const embedText = (embedEl.textContent || '').toLowerCase();
            
            // ── Ticket ID & Name ────────────────────────────────────────────
            let ticketId = null;
            let ticketName = null;

            const ticketIdVal = getValueByLabels(embedEl, embedText, [
                'ticket id', 'ticket no', 'id', 'bilet id', 'bilet no', 'bilet', 'talep no', 'talep'
            ]);
            if (ticketIdVal) {
                const numMatch = ticketIdVal.match(/(\d+)/);
                ticketId = numMatch ? numMatch[1] : ticketIdVal.trim();
            }
            if (!ticketId) {
                const ticketIdMatch = embedText.match(/(?:ticket id|ticket no|bilet id|bilet no|talep no|id|no)[:\s#-]+(\d+)/i) ||
                                      embedText.match(/#(\d{4,8})\b/) ||
                                      embedText.match(/(?:ticket|bilet|talep)[-_\s]?#?(\d+)/i);
                if (ticketIdMatch) {
                    ticketId = ticketIdMatch[1];
                }
            }

            const titleText = getEmbedTitle(embedEl);
            const nameMatch = (titleText + ' ' + embedText).match(/(?:ticket|bilet|talep)[-_\s]?(\d{4})/i) ||
                               (titleText + ' ' + embedText).match(/(?:ticket|bilet|talep)[-_\s]?(\d+)/i);
            if (nameMatch) {
                const numStr = nameMatch[1].padStart(4, '0');
                ticketName = `ticket-${numStr}`;
            }
            if (!ticketName && ticketId) {
                const numStr = String(ticketId).padStart(4, '0');
                ticketName = `ticket-${numStr}`;
            }

            // ── Opened By / Creator ──────────────────────────────────────
            let userId = null;
            let userTag = null;
            const openedByEl = getEmbedFieldValueElement(embedEl, 'opened by') ||
                               getEmbedFieldValueElement(embedEl, 'creator') ||
                               getEmbedFieldValueElement(embedEl, 'oluşturan') ||
                               getEmbedFieldValueElement(embedEl, 'bilet sahibi') ||
                               getEmbedFieldValueElement(embedEl, 'user') ||
                               getEmbedFieldValueElement(embedEl, 'kullanıcı') ||
                               getEmbedFieldValueElement(embedEl, 'üye') ||
                               getEmbedFieldValueElement(embedEl, 'itiraz eden');
            if (openedByEl) {
                userId = extractIdFromElement(openedByEl);
                userTag = openedByEl.textContent.replace(/<@!?\d{17,20}>/g, '').trim() || null;
            }
            if (!userId) {
                const openedByVal = getValueByLabels(embedEl, embedText, [
                    'opened by', 'creator', 'oluşturan', 'bilet sahibi', 'user', 'kullanıcı', 'üye', 'itiraz eden'
                ]);
                if (openedByVal) {
                    userId = extractDiscordId(openedByVal);
                    userTag = openedByVal.replace(/<@!?\d{17,20}>/g, '').trim() || null;
                }
            }
            if (!userId) {
                const userMatch = embedText.match(/(?:opened by|creator|oluşturan|owner|sahibi|kullanıcı|üye|bilet sahibi|açan|itiraz eden)[:\s#-]+(?:<@!?)?(\d{17,20})>?/i) ||
                                  embedText.match(/<@!?(\d{17,20})>/);
                if (userMatch) {
                    userId = userMatch[1];
                }
            }

            // ── Closed By / Claimed By ───────────────────────────────────
            let assignedModId = null;
            const closedByEl = getEmbedFieldValueElement(embedEl, 'closed by') ||
                               getEmbedFieldValueElement(embedEl, 'claimed by') ||
                               getEmbedFieldValueElement(embedEl, 'kapatan') ||
                               getEmbedFieldValueElement(embedEl, 'ilgilenen') ||
                               getEmbedFieldValueElement(embedEl, 'yetkili') ||
                               getEmbedFieldValueElement(embedEl, 'moderatör');
            if (closedByEl) {
                assignedModId = extractIdFromElement(closedByEl);
            }
            if (!assignedModId) {
                const closedByVal = getValueByLabels(embedEl, embedText, [
                    'closed by', 'claimed by', 'kapatan', 'ilgilenen', 'yetkili', 'moderatör'
                ]);
                if (closedByVal) {
                    assignedModId = extractDiscordId(closedByVal);
                }
            }
            if (!assignedModId) {
                const modMatch = embedText.match(/(?:closed by|claimed by|kapatan|ilgilenen|moderatör|yetkili)[:\s#-]+(?:<@!?)?(\d{17,20})>?/i);
                if (modMatch) {
                    assignedModId = modMatch[1];
                } else {
                    const allMentions = [...embedText.matchAll(/<@!?(\d{17,20})>/g)];
                    if (allMentions.length >= 2) {
                        assignedModId = allMentions[1][1];
                    }
                }
            }

            // ── Category ─────────────────────────────────────────────────
            let category = getValueByLabels(embedEl, embedText, [
                'category', 'kategori', 'panel', 'tür'
            ]);
            if (!category) {
                const catMatch = embedText.match(/(?:category|kategori|panel|tür)[:\s#-]+([^\n]+)/i);
                if (catMatch) {
                    category = catMatch[1].trim();
                }
            }

            // ── Message Count ────────────────────────────────────────────
            let messageCount = 0;
            const msgCountVal = getValueByLabels(embedEl, embedText, [
                'message', 'mesaj', 'count', 'messages', 'mesaj sayısı'
            ]);
            if (msgCountVal) {
                const countMatch = msgCountVal.match(/(\d+)/);
                if (countMatch) messageCount = parseInt(countMatch[1], 10) || 0;
            }
            if (!messageCount) {
                const countMatch = embedText.match(/(?:message|mesaj|count|messages|mesaj sayısı)[:\s#-]+(\d+)/i);
                if (countMatch) {
                    messageCount = parseInt(countMatch[1], 10) || 0;
                }
            }

            if (!userId && userTag) {
                const cleanTag = userTag.replace(/^@/, '').trim();
                userId = await findUserIdByUsername(cleanTag);
            }

            if (!ticketId) {
                // ticketId yoksa ticket logu değildir, sessizce geç
                return;
            }
            if (!userId) {
                // Bazı ticket loglarında açan kişi görünmeyebilir, veya embed alan adı farklıdır.
                // userId yoksa kaydetmek yerine sessizce uyarısız atla veya logla
                console.log(`[Lutheus Scraper] ticket-log userId eksik, atlanıyor. msgId: ${msgId}`);
                return;
            }

            let transcriptUrl = null;
            let threadUrl = null;

            const links = messageEl.querySelectorAll('a[href]');
            links.forEach(link => {
                const href = link.getAttribute('href');
                const text = link.textContent.toLowerCase();
                if (text.includes('transcript') || text.includes('online')) {
                    transcriptUrl = href;
                } else if (text.includes('thread') || text.includes('konu') || text.includes('view thread')) {
                    threadUrl = href;
                }
            });

            const record = {
                ticket_id:          ticketId,
                ticket_name:        ticketName,
                user_id:            userId,
                user_tag:           userTag,
                category:           category ? String(category).slice(0, 100) : null,
                assigned_mod_id:    assignedModId,
                message_count:      messageCount,
                discord_message_id: msgId,
                transcript_url:     transcriptUrl,
                thread_url:         threadUrl,
            };

            await supabaseUpsert('user_tickets', record, 'ticket_id');
            await markAsSeen(msgId);
            console.log(`[Lutheus Scraper] ticket-log kaydedildi: #${ticketId} | mod: ${assignedModId} | msgId: ${msgId}`);
        } catch (error) {
            console.warn('Lutheus Scraper Fail: parseTicketMessage error', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  KANAL TESPİTİ & MutationObserver
    // ═══════════════════════════════════════════════════════════════════════

    let currentObserver = null;
    let lastChannelId = null;

    // Rate-limited sequential ticket processor
    let _ticketScanRunning = false;
    async function scanTicketMessagesSequential(messageEls) {
        if (_ticketScanRunning) return; // Önceki tarama devam ediyorsa yeni başlatma
        _ticketScanRunning = true;
        const arr = Array.from(messageEls);
        for (const el of arr) {
            try {
                await parseTicketMessage(el);
            } catch (err) {
                console.warn('[Lutheus Scraper] Ticket parse error:', err);
            }
            // Her mesaj arasında 10 saniye bekle - Hadron rate limit önlemi
            await new Promise(r => setTimeout(r, 10000));
            // İptal kontrolü: kanal değiştiyse dur
            if (getCurrentChannelId() !== TICKET_CHANNEL_ID) {
                console.log('[Lutheus Scraper] Kanal değişti, ticket tarama durduruldu.');
                break;
            }
        }
        _ticketScanRunning = false;
        console.log('[Lutheus Scraper] Ticket tarama tamamlandı.');
    }

    function scanVisibleMessages(channelId) {
        const messageEls = document.querySelectorAll('[class*="message_"],[id*="chat-messages-"]');
        const isDispute  = (channelId === DISPUTE_CHANNEL_ID);
        const isEvidence = (channelId === EVIDENCE_CHANNEL_ID);
        const isTicket   = (channelId === TICKET_CHANNEL_ID);

        if (!isDispute && !isEvidence && !isTicket) return;

        if (isTicket) {
            // Hadron rate limit: sıralı ve 10 saniye aralıklı tarama
            console.log(`[Lutheus Scraper] Ticket kanalı: ${messageEls.length} mesaj bulundu, 10sn aralıklı tarama başlıyor...`);
            scanTicketMessagesSequential(messageEls);
            return;
        }

        messageEls.forEach((el) => {
            try {
                if (isDispute)  parseDisputeMessage(el, true);
                if (isEvidence) parseEvidenceMessage(el, true);
            } catch (error) {
                console.warn('Lutheus Scraper Fail: scanVisibleMessages element error:', el?.id, error);
            }
        });
    }

    function startObserver(channelId) {
        if (currentObserver) {
            currentObserver.disconnect();
            currentObserver = null;
        }

        const container = document.querySelector('[class*="scroller_"],[class*="messagesWrapper_"]');
        if (!container) {
            // Henüz DOM yok, 1s sonra tekrar dene
            setTimeout(() => startObserver(channelId), 1000);
            return;
        }

        // İlk tarama — sayfada zaten yüklü mesajlar
        scanVisibleMessages(channelId);

        // Queue for new ticket messages to prevent concurrent rate limits from MutationObserver
        let mutationTicketQueue = [];
        let mutationTicketProcessing = false;

        async function processMutationTicketQueue() {
            if (mutationTicketProcessing || mutationTicketQueue.length === 0) return;
            mutationTicketProcessing = true;
            while (mutationTicketQueue.length > 0) {
                const msgEl = mutationTicketQueue.shift();
                if (getCurrentChannelId() !== TICKET_CHANNEL_ID) {
                    mutationTicketQueue = [];
                    break;
                }
                try {
                    await parseTicketMessage(msgEl);
                } catch (err) {
                    console.warn('[Lutheus Scraper] Ticket parse error in mutation queue:', err);
                }
                // Wait 10 seconds between processed messages
                await new Promise(r => setTimeout(r, 10000));
            }
            mutationTicketProcessing = false;
        }

        currentObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    try {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        // Yeni mesaj elementi mi?
                        const msgEl = node.matches('[class*="message_"],[id*="chat-messages-"]')
                             ? node
                             : node.querySelector('[class*="message_"],[id*="chat-messages-"]');
                        if (!msgEl) continue;

                        const chId = getCurrentChannelId();
                        if (chId === DISPUTE_CHANNEL_ID) {
                            parseDisputeMessage(msgEl);
                        } else if (chId === EVIDENCE_CHANNEL_ID) {
                            parseEvidenceMessage(msgEl);
                        } else if (chId === TICKET_CHANNEL_ID) {
                            mutationTicketQueue.push(msgEl);
                            processMutationTicketQueue();
                        }
                    } catch (error) {
                        console.warn('Lutheus Scraper Fail: MutationObserver message node parsing error:', error);
                    }
                }
            }
        });

        currentObserver.observe(container, { childList: true, subtree: true });
        console.log('[Lutheus Scraper] MutationObserver başlatıldı. Kanal:', channelId);
    }

    // URL değişimlerini izle (Discord SPA navigasyonu)
    function watchNavigation() {
        const checkChannel = () => {
            const channelId = getCurrentChannelId();
            if (!channelId || channelId === lastChannelId) return;
            lastChannelId = channelId;

            const isTarget = (channelId === DISPUTE_CHANNEL_ID || channelId === EVIDENCE_CHANNEL_ID || channelId === TICKET_CHANNEL_ID);

            if (isTarget) {
                console.log(`[Lutheus Scraper] Hedef kanal tespit edildi: ${channelId}`);
                // DOM tamamen yüklenene kadar bekle
                setTimeout(() => startObserver(channelId), 1500);
            } else {
                // Hedef dışı kanalda observer'ı durdur
                if (currentObserver) {
                    currentObserver.disconnect();
                    currentObserver = null;
                    console.log('[Lutheus Scraper] Hedef dışı kanal, observer durduruldu.');
                }
            }
        };

        // MutationObserver ile title/URL değişimlerini yakala
        const navObserver = new MutationObserver(checkChannel);
        navObserver.observe(document.querySelector('title') || document.head, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        // popstate & hashchange
        window.addEventListener('popstate', checkChannel);

        // İlk kontrol
        setTimeout(checkChannel, 2000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  GLOBAL API (service_worker.js mesajlarına yanıt)
    // ═══════════════════════════════════════════════════════════════════════
    window.GearTech = window.GearTech || {};
    window.GearTech.DiscordScraper = {
        startScan: function () {
            const chId = getCurrentChannelId();
            if (chId) {
                startObserver(chId);
                return { started: true, channelId: chId };
            }
            return { started: false, channelId: null };
        },
        stopScan: function () {
            if (currentObserver) {
                currentObserver.disconnect();
                currentObserver = null;
            }
            return { stopped: true };
        },
        getCurrentChannel: function () {
            return getCurrentChannelId();
        },
    };

    // ─── Service Worker mesaj handler'ı ────────────────────────────────────
    if (isExtensionContextValid()) {
        chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
            try {
                if (request.action === 'DISCORD_SCRAPER_START') {
                    const result = window.GearTech.DiscordScraper.startScan();
                    sendResponse({ success: true, ...result });
                } else if (request.action === 'DISCORD_SCRAPER_STOP') {
                    const result = window.GearTech.DiscordScraper.stopScan();
                    sendResponse({ success: true, ...result });
                }
            } catch (error) {
                console.warn('Lutheus Scraper Fail: message handler error', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        });
    }

    // Başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchNavigation);
    } else {
        watchNavigation();
    }

    console.log('[Lutheus Scraper] discordScraper.js yüklendi.');
})();
