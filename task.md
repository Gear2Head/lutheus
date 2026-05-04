# Lutheus Project - Teknik Analiz ve Geliştirme Planı

## 🟢 Tamamlanan P0 Maddeleri
- [x] **Railway Geçişi:** Hugging Face ağ engeli Railway deployment ile aşıldı. Bot artık online.
- [x] **Auto-Command Deploy:** Bot her açıldığında komutları Discord'a otomatik register ediyor.
- [x] **Modular Bot-Entry:** Kod yapısı temizlendi, hata yönetimi ve retry mekanizması güçlendirildi.
- [x] **Canonical Invite:** Doğru scope ve permission içeren davet linkleri standardize edildi.

## 🔴 Güncel Sorunlar ve Öncelikler
- [ ] **Slash Command Görünürlüğü:** Railway üzerinde `DISCORD_CLIENT_ID` değişkeni doğrulanacak. Yanlışsa komutlar listede çıkmaz.
- [ ] **Firebase Sync:** Botun cezaları ve logları Firebase'e yazması için `FIREBASE_SERVICE_ACCOUNT_JSON` Railway'e tanımlanacak.
- [ ] **Vercel Dashboard:** Web panelinin bot ile haberleşmesi için backend API endpoint'leri tamamlanacak.

## 🚀 Kapsamlı Bot Özellik Planı (20+ Detay)

### 🛡️ Moderasyon ve Güvenlik
1.  **Gelişmiş Ceza Sistemi (`/ceza`):** Ban, Kick, Mute işlemlerini tek komut ve kanıt linkiyle yapma.
2.  **Ceza Geçmişi Sorgulama (`/sicil`):** Kullanıcının tüm geçmiş cezalarını listeleme.
3.  **Kanıt Yönetimi:** Cezalara sonradan `Case ID` üzerinden fotoğraf/video notu ekleme.
4.  **Süreli Susturma:** Otomatik süre bitiş takibi ve rol iadesi.
5.  **Toplu Mesaj Temizliği:** Filtreli temizlik (Sadece botlar, sadece linkler vb.).
6.  **Karantina Sistemi:** Şüpheli hesapları anında izole etme.

### 🤖 Otomasyon ve Koruma
7.  **Anti-Spam:** Hızlı mesaj gönderimini engelleme ve uyarma.
8.  **Küfür ve Reklam Filtresi:** Dinamik yasaklı kelime listesi yönetimi.
9.  **Oto-Rol:** Yeni katılanlara otomatik rol verme.
10. **Görsel Karşılama:** Kullanıcı bilgilerini içeren hoşgeldin kartları (Canvas).
11. **URL Koruma:** Sadece beyaz listedeki sitelere izin verme.

### 📊 Yönetim ve İstatistik
12. **Yetkili Performans Takibi:** Kim kaç işlem yaptı, ne kadar aktif?
13. **Detaylı Log Sistemi:** Mesaj silme, düzenleme, ses kanalı hareketleri.
14. **Sunucu Özet Paneli:** `/stats` ile aktiflik ve üye analizi.
15. **Butonlu Rol Seçimi:** Kullanıcıların kendi rollerini seçebileceği menüler.

### 🌐 Entegrasyon ve Web
16. **Web Dashboard Senkronu:** Bot ayarlarının web sitesinden anlık yönetimi.
17. **Canlı Ceza Takip Sitesi:** Web üzerinden herkese açık veya yetkiliye özel ceza listesi.
18. **Firebase Loglama:** Tüm bot hareketlerinin kalıcı olarak Firebase'de saklanması.

### 🛠️ Fonksiyonel Araçlar
19. **Ticket Sistemi:** Butonlu destek talebi ve transkript kaydı.
20. **XP ve Seviye:** Mesaj ve ses aktifliğine göre rütbe atlama.
21. **Gelişmiş Çekiliş:** Katılım şartlı ve butonlu çekiliş sistemi.
22. **Anket Sistemi:** Çoktan seçmeli ve sonuçları anlık güncellenen anketler.
