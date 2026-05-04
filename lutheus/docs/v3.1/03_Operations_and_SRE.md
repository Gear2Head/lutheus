# 03 - Operations & SRE (Lutheus CezaRapor v3.1)

## 1. SRE Runbooks

### Runbook: IR-001 (Veritabanı Bağlantı Kopması veya Yüksek Latency)
- **Belirti:** API uç noktalarında sürekli 502/504 dönmesi. `db_connection_errors` metriğinde spike.
- **Aksiyon 1:** Read Replica sağlık durumunu Prometheus üzerinden kontrol et.
- **Aksiyon 2:** Eğer Primary çökmüşse, `Promote Replica to Primary` operasyonunu başlat.
- **Aksiyon 3:** `Feature Flag` üzerinden DB-Ağır okumaları (Örn: Rapor ekranları) kapat (Kill Switch). Sistemi "Yazma Öncelikli" (Graceful Degradation) moduna al. İsteklere sadece 202 Accepted dönüp state'i Redis'te veya WAL (Write Ahead Log)'da tamponla.

### Runbook: IR-002 (Bot Compromise / API Key Sızıntısı Şüphesi)
- **Belirti:** Discord Bot'tan saniyede yüzlerce ban/kick isteği gelmesi. Anormal yetkili komut aktivitesi.
- **Aksiyon 1:** `EmergencyLockdown` modunu devreye al. Tüm HMAC/JWT isteklerini doğrudan 403 ile reddedecek şekilde Gateway Mühürlenir.
- **Aksiyon 2:** Discord Developer Portal'dan bot token'ını derhal regenerate et.
- **Aksiyon 3:** Secret Manager (Vault) üzerinden `HMAC_SHARED_SECRET` rotasyonunu tetikle. Uzantıların ve servislerin mTLS ile yeni anahtarı dağıtmasını bekle.

## 2. Performance Test Plan & Load Profiles

**Test Aracı:** k6 (load testing)

**Profiller:**
1. **Normal İş Yükü (Baseline):** 
   - 100 RPS Gateway trafiği.
   - Dağılım: %70 Read, %20 Queued Scan, %10 WS Sync.
   - SLA Beklentisi: P95 Latency < 100ms. Aktif CPU tüketimi < %40.
2. **Spike (Kriz Anı / Flash Crowd):**
   - Saniyede 1500+ istek (Popüler büyük sunucuların eş zamanlı raid baskını yemesi).
   - SLA Beklentisi: Backpressure ve Token Bucket devreye girer. Yüksek aşımda API 429 Too Many Requests (Token Bucket) veya 202 Accepted ile sınırlarken, Worker'lar Load Shedding yaparak hayatta kalır.
3. **Soak Test (Uzun Süreli Dayanıklılık):**
   - 12 saat boyunca sürekli ortalama yük. (300 RPS)
   - Odak: Node.Js Garbage Collection stresi, Redis memory şişmeleri ve Memory Leak profilini doğrulama.

## 3. Cost Model & Budget Guardrails

- **Compute:** Auto-scaling (HPA) Node.js pod'ları. Minimum kaynak atıl maliyetini önlemek adına gece minimuma çeken scale-to-zero (veya 1 pod) prensibi uygulanacaktır.
- **Cloud/Network:** Olası bir Layer-7 abüse durumunda fatura şoku (Bill Shock) yaşamamak için Cloudflare API bazlı limitler veya AWS Billing Alarm (Bütçenin %80'inde Trigger) aktif tutulmalıdır. Agresif scraper trafiği firewall üzerinden hard-banlanır.

## 4. Canary & Rollback Strategy

Tüm yeni versiyon build'leri kademeli dağıtılır.
1. Yeni versiyon sadece trafiğin (örneğin session/tenant hash ile) %5'ine verilir.
2. Otomatik Sağlamlık Denetimi: `error_rate_5xx` veya `latency_p99` son 10 dakika içindeki Baseline (eski X versiyonu) değerinden %15 fazla saparsa **otomatik rollback** devresi (ArgoCD veya benzeri tool) işlem yapar.
3. SLI değerleri sağlıklı aralıkta seyrediyorsa oran %25 -> %50 -> %100 skalasında kontrollü açılır.

## 5. Chaos Testing Plan

Kesintiyi beklemek yerine biz davet ederiz. Üretim veya benzeri Staging ortamlarında Chaos Engineering uygulanır.
- **Hata Enjeksiyonu:** Chaos Mesh çalıştırılarak belirli servis pod'larının aralıklı öldürülmesi (PodKill).
- **Network Gecikmesi:** Sürekli Redis ve DB istekleri arasına Blackhole gecikmeleri konulup `CircuitBreaker`ların nasıl Open state'e geçtiği simüle edilir. Fail Fast özelliği doğrulanır.

## 6. Release Management Checklist
- [ ] Okyanus Sonrası: CI/CD Security Gate (SAST / Audit) Yeşil renkte bitti.
- [ ] İleri/Geri Migrasyon Planı (Idempotent DDL) mevcut ve onaylı.
- [ ] Yeni eklentilerin Performance Benchmark'ı baseline limitini kırmıyor.
- [ ] Runbook güncellemeleri, Alert threshold güncellemeleri incelendi.
- [ ] SBOM export edildi; tüm bağımlılıklar ve güvenlik referansları arşive atıldı.

## 7. Operational SLIs/SLOs

- **Availability SLO:** Hedef %99.9 Uptime. Ölçüm: Toplam Hatalı İstek (500-504) / Toplam HTTP İstekleri metrik aralığı.
- **Latency/Performance SLO:** Taramaların kuyruğa girme isteği (HTTP POST) P95 sınırında <= 150ms bitirilmelidir.
- **Freshness SLO:** İhlal bulunduktan sonraki Notification (WSS/Discord Sync) Push zamanlaması <= 2000 milisaniye (2 sn).
