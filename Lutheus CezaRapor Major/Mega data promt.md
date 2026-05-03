Lutheus CezaRapor Sorun Analizi ve TODO Planı
Özet
JS dosyalarının sentaks kontrolü geçti, ancak işlevsel tarafta birden fazla kritik kırık var.
En ciddi sorunlar: noop güvenlik akışları, eksik Storage API sözleşmesi, yanlış state geçişleri ve uzantı UI’sinde sanitize edilmemiş render.
Doğrulama sınırı: repo kökünde package.json, tsconfig.json ve test/CI yapılandırması yok; bu yüzden build/test ile doğrulama yapılamadı. Bu, TS katmanının aktif entegrasyonda olmadığına dair güçlü bir işaret.
Bulgular
[P0] Lockdown komutu gerçekte backend’i kilitlemiyor.
requestBackend tamamen stub ve her zaman true dönüyor; komut başarı mesajı verse de gerçek bir ops çağrısı yapılmıyor. EmergencyLockdown.ts EmergencyLockdown.ts

[P0] Rate limiter fiilen kapalı.
Middleware “rate limit var” gibi görünüyor ama karar fonksiyonu daima true döndürüyor; hiçbir istek throttle edilmiyor. TokenBucketRateLimiter.ts TokenBucketRateLimiter.ts

[P1] HMAC guard yanlış uzunlukta imzada 401 yerine exception üretebilir ve fallback secret ile çalışıyor.
timingSafeEqual eşit olmayan buffer uzunluklarında throw eder; ayrıca varsayılan sabit secret prod’da sessizce kabul ediliyor. HmacVerifier.ts HmacVerifier.ts

[P1] Saga state’leri iş tamamlanmadan ileri taşınıyor.
Orchestrator yalnızca queue’ya push ettikten sonra EVIDENCE_COLLECTED, ANALYZED ve fiilen “completed” kabul ediyor; bu da false-positive completion ve rollback tutarsızlığı üretir. ScanOrchestrator.ts ScanOrchestrator.ts

[P1] Admin paneli bazı akışlarda doğrudan runtime error verecek.
admin.js, Storage.saveCases(...) çağırıyor ama storage.js içinde böyle bir method yok; kural uygulama ve ceza silme akışları kırık. admin.js admin.js storage.js

[P1] Extension UI, scrape edilen verileri ham innerHTML ile basıyor.
Kullanıcı adı, reason, not gibi alanlar escape edilmeden render ediliyor; dashboard verisi kirliyse extension UI içinde DOM injection/XSS oluşabilir. sidepanel.js sidepanel.js admin.js admin.js

[P2] Background scan API’si tutarsız defaultlarla geliyor.
runAutonomousScan içindeki varsayılan guildId proje genelindeki sabitten farklı ve tanımlı startDate/endDate hiç uygulanmıyor. service_worker.js service_worker.js service_worker.js

[P2] TS katmanı büyük ölçüde ölü veya doğrulanmamış kod görünüyor.
Bu bir çıkarım: canlı giriş noktaları yalnızca JS modüllerine gidiyor, repo kökünde build config yok ve TS sınıfları repo içinde neredeyse hiç tüketilmiyor. sidepanel.html admin.html

TODO
EmergencyLockdown için gerçek signed backend client yaz, başarısızlıkta kullanıcıya success mesajı verme, audit log ekle.
TokenBucketRateLimiter içine gerçek Redis atomik akışını koy; Lua/EVAL veya tek round-trip script ile token refill + decrement yap.
HmacVerifierGuard içinde header canonicalization, uzunluk kontrolü, future timestamp reddi ve zorunlu env secret doğrulaması ekle.
ScanOrchestrator state machine’i “queued / running / analyzed / completed” diye ayır; queue push ile completion’ı karıştırma.
Storage.saveCases ekle ya da admin.js akışlarını updateCases(..., false) ile normalize et; tek yazma API’si bırak.
Storage API’sindeki çakışan method isimlerini temizle; sessionSnapshot ve lastSessionSnapshot semantiğini tek modele indir.
innerHTML kullanılan render noktalarını escape helper veya DOM node oluşturma ile değiştir; özellikle name, reason, note, avatar alanlarını sanitize et.
service_worker.js içindeki guild defaultlarını tek sabite bağla; runAutonomousScan içinde tarih filtresi gerçekten uygula.
Repo köküne gerçek build zinciri ekle: package.json, workspace yapısı, tsconfig, lint, test ve minimum CI.
TS tarafta placeholder/stub kalan sınıfları ya gerçek implementasyonla tamamla ya da aktif dağıtımdan çıkar.
Geliştirme İçin Özellik Önerileri
Tarama oturumları için diff görünümü: “son taramadan bu yana eklenen/silinen/değişen cezalar”.
Moderatör performansında trend analizi: hafta/ay bazlı doğruluk ve hacim grafikleri.
Rule simulation modu: yeni CUK kuralını kaydetmeden önce mevcut veride etkisini önizleme.
Evidence replay/debug ekranı: belirli bir case’in neden valid/invalid çıktığını adım adım gösterme.
Güvenli export/import: imzalı JSON export, sürüm bilgisi ve schema migration desteği.
Background health paneli: content script bağlantısı, son başarılı tarama, inject retry sayısı, storage quota kullanımı.
Varsayımlar
İnceleme mevcut dosya ağacına ve statik okumaya dayanıyor; çalışan bir build/test hattı olmadığı için dinamik doğrulama sınırlı.
Öncelik üretim etkisine göre verildi; önce P0/P1 maddeleri kapatılmalı, sonra mimari toparlama yapılmalı.



Geliştirme TODO Backlog'u
Özet
Bu backlog, mevcut repo yapısını üretime yakın hale getirmek için önceliklendirilmiş geliştirme iş listesidir. Sıralama, önce kırık akışları ve güvenlik açıklarını kapatacak, sonra mimari temizlik ve yeni özellikleri ekleyecek şekilde hazırlanmıştır.

Public API ve Sözleşme Değişiklikleri
src/lib/storage.js tek ve tutarlı bir API yüzeyi sunmalı.
get, set, getCases, saveCases, updateCases, getSettings, saveSettings, getUserInfo, setUserInfo, getSessionSnapshot, setSessionSnapshot, clear, clearCases
src/background/service_worker.js mesaj sözleşmeleri belgelemeli.
OPEN_DASHBOARD_AND_SCAN, INJECT_SCRIPTS, SEND_TO_TAB, OPEN_ADMIN, CLOSE_TAB, GET_DASHBOARD_TAB
TS katmanında gerçek entegrasyon varsa backend/public contracts netleştirilmeli.
HmacVerifierGuard, TokenBucketRateLimiter, SyncGateway, ScanOrchestrator
Tarama sonucu veri modeli standardize edilmeli.
id, user, userId, authorName, authorId, reason, createdRaw, type, scrapedAt, reviewStatus, validationStatus, validationReason, note
Detaylı TODO
Repo köküne package.json ekle ve workspace yapısını tanımla.
tsconfig.json ve gerekirse jsconfig.json ekle; JS/TS dosyalarının modül çözümlemesini standardize et.
Lint için minimum eslint kurulumu ekle; en az src, apps, packages klasörlerini kapsa.
Tek komutla doğrulama için npm run check, npm run lint, npm run test scriptleri oluştur.
src/lib/storage.js içindeki duplicate getSessionSnapshot tanımlarını tek metoda indir.
src/lib/storage.js içine eksik saveCases metodunu ekle veya tüm çağrıları updateCases(..., false) ile değiştirilecek şekilde tasarla.
src/lib/storage.js içindeki setUserInfo/getUserInfo gibi kullanılan ama API karşılaştırmasında kaybolan metotları görünür ve stabil hale getir.
src/lib/storage.js için migration mantığı ekle; eski storage anahtarları yeni şemaya otomatik taşınsın.
src/background/service_worker.js içindeki sabit guild id kullanımını tek kaynaktan yönet.
src/background/service_worker.js içindeki runAutonomousScan için startDate/endDate filtrelerini gerçekten uygula.
src/background/service_worker.js içinde message action’larını enum benzeri tek sabitte topla.
src/background/service_worker.js içinde retry akışlarını timeout ve hata kodlarıyla ayrıştır.
src/content/main.js için action bazlı dispatcher düzeni kur; büyüdükçe switch dağılmasın.
src/content/scraper.js içinde selector fallback’lerini versiyonlu strateji haline getir.
src/content/scraper.js için “selector health” metrikleri ekle; hangi selector ne kadar çalışıyor kaydedilsin.
src/content/navigation.js için pagination hata durumlarını açık şekilde döndür.
src/sidepanel/sidepanel.js tarama state yönetimini tek obje yerine küçük state machine ile düzenle.
src/sidepanel/sidepanel.js içinde tarama başlat/durdur akışlarına cancel-safe yapı ekle.
src/sidepanel/sidepanel.js içinde progress durumunu gerçek “processed/new/skipped/error” sayaçlarıyla genişlet.
src/sidepanel/sidepanel.js içindeki tüm innerHTML kullanım noktalarını sanitize helper veya DOM oluşturma ile değiştir.
src/dashboard/admin.js içindeki tüm innerHTML render’larını escaped render katmanına taşı.
Avatar, kullanıcı adı, reason, note gibi scrape edilmiş tüm alanları güvenli render zorunluluğuna al.
src/lib/utils.js içine ortak escapeHtml ve güvenli text/attr yardımcıları ekle.
src/dashboard/admin.js içindeki Storage.saveCases bağımlı akışları düzelt; kural kaydetme ve ceza silme akışları tekrar çalışır hale gelsin.
src/dashboard/admin.js için büyük fonksiyonları modüllere ayır.
Admin panelde “değişiklik kaydedildi/kaydedilemedi” durumları için deterministic toast ve log standardı ekle.
src/lib/cukEngine.js ve src/lib/cukEngineV2.js arasında tek aktif motoru belirle; ikili yapı varsa strateji desenine çevir.
Dinamik kurallar için schema doğrulaması ekle; bozuk kural storage’a yazılamasın.
Kural değiştirince toplu revalidate işlemini chunk’lara böl; büyük veri setinde UI freeze olmasın.
src/lib/scanSessionEngine.js ile Storage session snapshot mantığını birleştir; iki ayrı oturum sistemi olmasın.
Haftalık snapshot ve session snapshot kavramlarını ayır ve belgeye dök.
apps/backend/src/common/middleware/TokenBucketRateLimiter.ts içine gerçek Redis token bucket implementasyonu yaz.
Rate limiter için fail-open/fail-closed kararı config tabanlı olsun; kod içine gömülmesin.
apps/backend/src/security/HmacVerifier.ts içinde fallback secret kullanımını kaldır; env yoksa uygulama boot etmesin.
HMAC doğrulamada timestamp future-skew ve buffer length kontrollerini ekle.
HMAC için canonical body üretimini standartlaştır; raw-body middleware sözleşmesini netleştir.
apps/backend/src/gateway/SyncGateway.ts için JWT payload tipi tanımla; any benzeri belirsizlikleri kaldır.
Websocket bağlantılarında authorization failure nedeni loglansın ama token içeriği sızdırılmasın.
packages/shared-core/src/saga/ScanOrchestrator.ts içinde gerçek state progression kur.
ScanOrchestrator için QUEUED, COLLECTING, ANALYZING, COMPLETED, FAILED, ROLLED_BACK gibi açık durumlar tanımla.
Saga rollback sırasında hangi adımın geri alındığı ayrıca saklansın.
apps/discord-bot/src/commands/critical/EmergencyLockdown.ts stub backend çağrısını gerçek imzalı ops client ile değiştir.
Lockdown komutuna audit trail, correlation id ve idempotency ekle.
apps/extension/src/security/IntegrityVerifier.ts içindeki self-destruct davranışını kontrollü degrade moduna çevir; Object.freeze(window) gibi kırıcı davranışlardan kaçın.
TS katmanı aktif kullanılacaksa apps/* ve packages/* için gerçek entrypoint ve build pipeline oluştur.
TS katmanı aktif kullanılmayacaksa placeholder enterprise sınıflarını docs/roadmap altına taşı; canlı repo yüzeyinden ayır.
Test katmanında önce Storage, parseDate, page parsing, CUK validation, background message routing için birim testleri yaz.
En kritik kullanıcı senaryoları için smoke test listesi oluştur.
“İlk kurulum”, “ilk tarama”, “admin panel açma”, “kural güncelleme”, “ceza silme”, “export alma” akışlarını manuel kabul senaryolarına bağla.
docs altında gerçek mimari, veri modeli, message contract ve storage schema dökümanı ekle.
Test Planı
Storage API smoke testleri: eksik method çağrısı olmamalı, clear/save/update akışları veri kaybetmemeli.
Tarama akışı testi: dashboard açma, inject, page info alma, scrape, filtreleme, storage yazma.
Admin panel testi: veri yükleme, kural kaydetme, revalidate, ceza silme, rol değiştirme.
Güvenlik testleri: XSS payload render testi, HMAC invalid length testi, expired timestamp testi.
Resilience testleri: content script yokken reinject, tab kapanınca graceful fail, storage parse bozulunca fallback.
Backend testleri: rate limit eşik testi, websocket auth testi, saga rollback testi, lockdown endpoint entegrasyon testi.
Özellik Geliştirme Backlog'u
Son taramadan bu yana fark görünümü.
Moderatör bazlı trend grafikleri.
Kural simülasyon modu.
Vakaya özel “neden invalid/valid” açıklama ekranı.
Export için imzalı rapor formatı.
Storage quota ve sync health paneli.
Selector kırılması için otomatik uyarı sistemi.
Tarama planlayıcı ve zamanlanmış haftalık snapshot.
Büyük veri setleri için sanal listeleme.
Moderasyon verilerinde anomali tespiti ve alarm akışı.
Varsayımlar
Öncelik sırası P0/P1 kırıkları kapatmak, sonra mimari sadeleştirme, sonra yeni özellikler.
Mevcut repo bir Chrome extension merkezli çalışma akışına sahip; backend ve TS katmanının tam entegrasyonu henüz tamamlanmamış görünüyor.
Implementasyon sırasında bu plan TODO.md veya docs/development-backlog.md olarak dosyaya dönüştürülebilir; bu turda yalnızca karar-tam plan çıkarıldı.