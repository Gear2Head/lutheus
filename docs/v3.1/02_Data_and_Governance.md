# 02 - Data & Governance (Lutheus CezaRapor v3.1)

## 1. Database Migration Plan (Online Schema Changes)

Kesintisiz geçiş ve yüksek erişilebilirlik (HA) standartlarına göre veri göç planı.

**Aşama 1: Schema Expansion (Sıfır Kesinti)**
1. v3.1 için yeni tablolar veya sütunlar `NULL` veya `DEFAULT` değerler alacak şekilde eklenir. (Mevcut kod hiçbir değişiklik yapmadan okuma yazma yapabilmelidir.)
2. `CREATE INDEX CONCURRENTLY` kullanılarak okuma/yazma kilitlenmeden indeksler oluşturulur.
3. Yeni `idempotency_key`, `checksum`, `actor_session` gibi alanlar eklenir.

**Aşama 2: Dual Write (Çift Yazma)**
1. Uygulama kodu güncellenir. WORM loglarına veya yeni tablolara veri yazan Saga orchestrator devreye girer. Geriye dönük uyumluluk için eski tablolar (v3.0) da güncellenmeye devam eder.

**Aşama 3: Backfill (Veri Doldurma)**
1. Background worker'lar aracılığıyla (`migration-worker`), v3.0 kayıtları yavaşça okunup yeni v3.1 yapısına göre zenginleştirilerek aktarılır. Bu adım CPU ve IOPS limitleri gözetilerek (bulkhead) throttle (limit) edilir.

**Aşama 4: Switch Read Path**
1. Kod, artık okumaları yeni v3.1 yapısından yapacak şekilde güncellenir.
2. Metrikler (Error Rate, Latency) 48 saat izlenir.

**Aşama 5: Cleanup**
1. Eski okuma/yazma yolları kapatılır. Eski sütunlar/tablolar drop edilir.

## 2. Feature Flag Governance Model

Her özellik dinamik Feature Flag'lerle yönetilecektir (LaunchDarkly benzeri veya Redis tabanlı).

**Flag Sınıflandırması:**
- **Kill Switches:** Herhangi bir anomali durumunda sistemi anında degrade etmek için (Örn: `ENABLE_ML_INFERENCE_ENGINE`). SRE yetkisi gerektirir.
- **Operational Flags:** Yük yönetimi için (Örn: `USE_READ_REPLICA`, `QUEUE_CONSUME_RATE_LIMIT`).
- **Release Flags:** Beta kullanıcılar veya sunucular için kontrollü dağıtım (Örn: `DISCORD_NEW_UI_EMBEDS`).

**Yönetişim Politikası:**
- Geçici (Release) flag'ler 3 sprint sonunda koddaki varsayılan davranış haline getirilmek (veya silinmek) zorundadır. Aksi takdirde teknik borç kabul edilir.
- Flag durum değişiklikleri daima Audit Log üzerinden geçer ve Slack/Discord '#ops-alerts' kanalına anında yansır.

## 3. Org-Level Security Policy Template

Lutheus platformunda her kod parçası ve operasyon bu politikaya uymak zorundadır:

### 3.1. Zero-Trust İlkeleri
- "İç network" diye bir kavram yoktur. Servisler arası iletişim (API <-> Worker) DAİMA mTLS ile şifrelenir.
- Rol yoksa yetki de yoktur. Explicit "Deny by Default" kuralı uygulanır.

### 3.2. Sır Yönetimi (Secret Management)
- Hiçbir `.env` dosyası veya Hardcoded secret kod reposunda barınmaz.
- Tüm credential'lar HashiCorp Vault veya AWS Secrets Manager üzerinden dinamik alınır. Dinamik sırların maksimum ömrü 24 saattir. (Secret Rotation Policy).
- HMAC türetimleri için HKDF zorunludur.

### 3.3. Veri Gizliliği Raporlama ve İhlal Yanıtı (Incident Response)
- PII (Discord User ID gibi) verilerin bulunduğu her sütun veritabanı seviyesinde `AES-256 GCM` ile (Field-Level Encryption) şifrelenir.
- Şifreleme anahtarları (DEK/KEK) periyodik rotasyona tabidir.
- Herhangi bir veri sızıntısı tespitinde, Playbook `IR-001` (Breach Containment) azami 5 dakika içinde başlatılmalıdır.
