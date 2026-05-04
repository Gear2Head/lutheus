# Lutheus CezaRapor - User TODO

## Durum

- Proje koku: `C:\Projects\lutheus`
- Vercel proje sayfasi: `https://vercel.com/gearheads-projects-cd620944/lutheus`
- Canli domain: `https://lutheus.vercel.app/`
- API health endpoint: `https://lutheus.vercel.app/api/health`
- `src/config/appConfig.js` icindeki `vercelAuthBaseUrl` canli domaine ayarli.
- Google OAuth client ID uygulama config dosyasina islendi.
- `.env.example` eklendi; gercek `.env` git disinda kaliyor.
- `npm.cmd run env:check`, `npm.cmd run lint`, `npm.cmd run test` kontrol komutlari hazir.

## Benim Tamamladigim Teknik Isler

- Extension giris kapisi login ekranina baglandi.
- Discord OAuth akisi Vercel broker + Firebase custom token mantigina gore hazirlandi.
- Google login akisi allowlist kontroluyle baglandi.
- Google allowlist okumasi Firebase ID token ile yapilacak sekilde duzeltildi.
- Firestore role cache, allowlist, user upsert ve role policy katmani eklendi.
- Admin/moderator erisim ayrimi UI guard seviyesinde baglandi.
- Groq cagrisi client secret gommeden Vercel proxy uzerinden calisacak sekilde tasarlandi.
- `api/health.js` eklendi.
- `scripts/check-env.cjs` eklendi; secret degerlerini yazdirmadan env sekli kontrol ediliyor.
- `package.json` Windows uyumlu lint/test scriptlerine cekildi.

## Senin Yapman Gerekenler

1. Vercel env degiskenlerini canli projeye gir.
   - Local `.env` hazir olsa bile Vercel dashboard icinde ayrica tanimlanmali.
   - Production, Preview ve Development ortamlarini ihtiyaca gore esitle.

2. ~~Discord Developer Portal ayarlarini tamamla.~~ (Tamamlandı)
   - OAuth2 redirect URL:
     `https://lutheus.vercel.app/api/auth/discord/callback`
   - Scope: `identify`
   - Ilk admin Discord ID'lerini `BOOTSTRAP_DISCORD_IDS` icine virgulle ekle. (758769576778661989 olarak eklendi)

3. Firebase Console ayarlarini dogrula.
   - Authentication acik olmali.
   - Google provider acik olmali.
   - Firestore database acik olmali.
   - **ÖNEMLİ:** `npx firebase-tools@latest login` komutunu terminalde çalıştırıp Google hesabınla giriş yapmalı ve ardından `npx firebase-tools@latest deploy --only firestore:rules --project lutheus-project` komutuyla rules'ları deploy etmelisin. Veya Firebase Console'dan `firestore.rules` içeriğini kopyalayıp Rules sekmesine yapıştırabilirsin.

4. Chrome extension ID ciktiktan sonra Google OAuth redirect URI ekle.
   - Redirect URI formati:
     `https://<extension-id>.chromiumapp.org/google`
   - Extension ID degisirse Google OAuth ayari da degisir.

5. Ilk admin erisimini dogrula.
   - Discord ile giris yap.
   - `BOOTSTRAP_DISCORD_IDS` icindeki hesap admin yetkisi almali.
   - Admin panelden Google allowlist kaydi ekle.

6. Google allowlist kaydi ekle.
   - Firestore koleksiyon:
     `googleAllowlist/{email}`
   - Ornek alanlar:
     `allowed: true`
     `role: "admin"` veya `"moderator"`
     `addedBy: "<admin uid>"`

7. Canli testleri sirayla yap.
   - `https://lutheus.vercel.app/api/health`
   - Discord login
   - Google login allowlist yokken red
   - Google login allowlist varken giris
   - Moderator rolunde DB/CUK edit kapali mi
   - Admin rolunde allowlist, role cache, scan ve Groq yonetimi acik mi

## Vercel Env Listesi

### Zorunlu

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
OAUTH_STATE_SECRET=
BOOTSTRAP_DISCORD_IDS=
FIREBASE_SERVICE_ACCOUNT_JSON=
GROQ_API_KEY=
```

### Onerilen

```env
GROQ_MODEL=llama-3.1-8b-instant
```

### Firebase Admin Alternatif Kullanim

`FIREBASE_SERVICE_ACCOUNT_JSON` kullanmiyorsan bu uclu kullanilabilir:

```env
FIREBASE_PROJECT_ID=lutheus-project
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Eski Backend/Bot Opsiyonelleri

Yeni Vercel auth akisi icin zorunlu degiller; eski backend veya Discord bot akislarinda gerekebilir.

```env
NODE_ENV=
BACKEND_BASE_URL=
BOT_HMAC_SECRET=
HMAC_SHARED_SECRET=
RATE_LIMIT_FAIL_OPEN=
REDIS_URL=
REDIS_HOST=
ALLOWED_ORIGINS=
```

## Lokal Kontrol Komutlari

```powershell
npm.cmd run env:check
npm.cmd run lint
npm.cmd run test
```

## Kabul Kriterleri

- `npm.cmd run env:check` secret degerlerini yazdirmadan basarili.
- `npm.cmd run lint` uyarisiz basarili.
- `npm.cmd run test` basarili.
- Extension login olmadan sidepanel/admin acmiyor.
- Discord login Firebase custom token ile oturum aciyor.
- Google login sadece allowlist e-postalarinda calisiyor.
- Admin/yonetici/kidemli yonetim yuzeylerine erisiyor.
- Moderator sadece kendi profil ve sinirli istatistik alanlarini goruyor.

## Hugging Face Spaces Deployment Guide (Ücretsiz & 7/24 Bot Hosting)

Lutheus Bot'u kredi kartı gerektirmeden tamamen ücretsiz ve sürekli aktif tutmak için bu adımları takip edin.

### 1. Space Hazırlığı
1. Hugging Face hesabınızda **New Space** oluşturun.
2. SDK olarak **Docker** seçin.
3. **Space Hardware** olarak "CPU Basic (Free)" seçili kalsın.

### 2. Gerekli Dosyaların Hazırlanması
Bot klasörünüzde (`apps/discord-bot/`) şu dosyaların olduğundan emin olun:

**A. `Dockerfile` İçeriği:**
```dockerfile
FROM node:20
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
COPY --chown=user . .
RUN npm install
ENV PORT=7860
EXPOSE 7860
CMD ["node", "apps/discord-bot/src/index.js"]
```

**B. Sağlık Kontrolü (Port 7860):**
Botun ana dosyasına (`index.js`) Hugging Face'in "Running" durumuna geçmesi için şu kodu en üste ekleyin:
```javascript
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
}).listen(7860);
```

### 3. Gizli Değişkenlerin (Secrets) Eklenmesi
Space ayarlarında (**Settings > Variables and secrets**) şu anahtarları tanımlayın:
- `DISCORD_TOKEN`
- `BACKEND_BASE_URL`
- `BOT_HMAC_SECRET`
- `FIREBASE_CONFIG` (Gerekiyorsa)

### 4. Dosyaları Yükleme ve Yayına Alma
1. **Files and versions** sekmesine gidin.
2. **Upload files** butonuna tıklayın.
3. Proje klasörünüzdeki tüm dosyaları (`node_modules`, `.git` ve `.env` hariç) sürükleyip bırakın.
4. "Commit changes" diyerek kaydedin.

Sistem otomatik olarak **Building** aşamasına geçecek ve birkaç dakika içinde **Running** (Yeşil) olacaktır.

