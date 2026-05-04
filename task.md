# Lutheus Project - Teknik Analiz ve Geliştirme Planı

## 🔴 P0 - Canlı Yayın ve Erişim
- [ ] **Vercel Deploy Yetkisi:** Local `main` değişiklikleri GitHub/Vercel'e gitmiyor. GitHub credential veya Vercel CLI token kurulmadan canlı `lutheus.vercel.app` güncellenmez.
- [ ] **Vercel Preview Kontrolü:** Deploy sonrası `/extension`, `/dashboard`, `/bot`, `/src/auth/login.html` route'ları tek tek doğrulanacak.
- [ ] **Env Senkronizasyonu:** HF ve Vercel için `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`, `OAUTH_STATE_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON` değerleri ayrı ayrı doğrulanacak.
- [ ] **Secret Rotasyonu:** Sohbete yazılmış token/key benzeri değerler Discord Developer Portal ve HF/Vercel env üzerinden rotate edilecek.

## 🔴 P0 - Discord Bot Invite ve Online Olma
- [x] **Eksik Invite Linki:** Sadece `client_id` içeren link bot eklemez. Canonical invite artık `scope=bot applications.commands`, `permissions=8`, `integration_type=0` üretir.
- [x] **Guild Hedefli Invite:** `/invite-lutheus` ve bot dashboard invite linki hedef sunucu ID ile `disable_guild_select=true` üretir.
- [x] **HF Root/Unknown Route:** HF iframe/path varyasyonlarında `NOT_FOUND` yerine bot paneli döner.
- [x] **Diagnostics Endpoint:** `/diagnostics` token geçerliliği, client id eşleşmesi, REST timeout ve invite linklerini JSON olarak verir.
- [x] **Timeout Toleransı:** Discord REST/undici timeout değerleri 30 saniyeye çıkarıldı, retry sayısı artırıldı.
- [ ] **Discord Developer Portal Kontrolü:** Application > Installation altında Guild Install açık; Bot sekmesinde Public Bot açık olmalı. Kapalıysa invite başarılı görünse bile bot sunucuya düşmeyebilir.
- [ ] **Gateway Network Kontrolü:** HF loglarında `Connect Timeout` sürerse `/diagnostics` çıktısına göre HF outbound Discord erişimi veya token problemi ayrıştırılacak.
- [ ] **Sunucu Audit Log Kontrolü:** Invite başarılı görünüyorsa Discord sunucusunda Audit Log > Bot Add kaydı kontrol edilecek.

## 🔴 P0 - Login Sistemi
- [x] **Discord Firebase Provider Kısıtı:** Firebase paid provider yerine custom Discord OAuth akışı kullanılıyor.
- [x] **Fallback Session:** Firebase custom token üretilemezse signed local session fallback devreye girer.
- [ ] **Vercel OAuth Callback:** Canlı deploy sonrası `/api/auth/discord/start` ve `/api/auth/discord/callback` gerçek domain üzerinde test edilecek.
- [ ] **Role Cache Bootstrap:** İlk admin için `BOOTSTRAP_DISCORD_IDS` env zorunlu hale getirilecek.

## 🟠 P1 - Sapphire Tarama
- [x] **API-first Tarama:** Extension, yakaladığı Sapphire API endpoint'ini kaydeder ve hızlı taramada sayfa açmadan `fetch(..., credentials: include)` ile veri çekmeyi dener.
- [x] **Fallback Tarama:** API endpoint yoksa veya API hata verirse dashboard tab/scraper moduna otomatik düşer.
- [x] **Progress Bar Düzeltmesi:** Yüzde hesabı clamp edildi, API/Dashboard modu progress label'a eklendi.
- [x] **Avatar Meta Yakalama:** Sapphire API response içindeki user/mod avatar alanları network listener tarafından kaydedilir.
- [ ] **API Endpoint Keşif UI:** Side panel'de son yakalanan Sapphire API endpoint'i ve API-first durumu gösterilecek.
- [ ] **Detay Fetch Kuyruğu:** Detaylı taramada concurrency limitli ve retry/backoff destekli kuyruk kullanılacak.
- [ ] **IndexedDB Arşiv:** 10k+ case için `chrome.storage.local` yerine IndexedDB arşiv katmanı eklenecek.

## 🟡 P1 - Vercel Admin Dashboard
- [x] **Admin/Bot Route Ayrımı:** `/dashboard` admin, `/bot` bot ayarları, `/extension` public extension sitesi olarak ayrıldı.
- [ ] **Extension ile Eşdeğerlik:** Extension admin panelindeki CUK, rol cache, erişim, pointtrain ve rapor ekranları Vercel'de birebir test edilecek.
- [ ] **Canlı Veri Boşluğu:** Root global dashboard'daki 0 veri sorunu Firestore auth/rules veya yanlış koleksiyon path'i olarak ayrıştırılacak.
- [ ] **Bot Dashboard Geliştirme:** `/bot` içinde diagnostics, canonical invite copy, target guild invite ve env health checklist görsel olarak gösterilecek.

## 🟢 P2 - Stabilite ve Operasyon
- [ ] **Structured Logs:** Bot login retry, invite diagnostics ve command register sonuçları tek formatta loglanacak.
- [ ] **Health Badge:** HF/Vercel dashboard üzerinde bot ready/offline ve token mismatch uyarısı gösterilecek.
- [ ] **Runbook:** `docs/discord-bot-runbook.md` ile bot ekleme, env kurma, token rotate ve HF timeout çözümü belgelenecek.
- [ ] **CI Check:** `npm run check` GitHub Action'a bağlanacak.

## ✅ Doğrulama Komutları
- [x] `node --check bot-entry.js`
- [x] `npm run lint`
- [x] `npm test -- --runInBand`
