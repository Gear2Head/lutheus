# Lutheus CezaRapor - User TODO

## Senin Yapman Gerekenler

1. Vercel projesi oluştur ve deploy et. `[YAPILDI]`
   - Root dizin: `C:\Projects\lutheus`
   - Proje: `https://vercel.com/gearheads-projects-cd620944/lutheus`
   - Production domain: `https://lutheus.vercel.app/`
   - `src/config/appConfig.js` içindeki `vercelAuthBaseUrl` değeri `https://lutheus.vercel.app` olarak güncellendi.

2. Discord Developer Portal ayarlarını yap.
   - OAuth2 redirect URL:
     `https://<vercel-domain>/api/auth/discord/callback`
   - Scope: `identify`
   - İlk admin Discord ID'lerini `BOOTSTRAP_DISCORD_IDS` env değişkenine virgülle ekle.

3. Firebase Console ayarlarını yap. [done]
 
4. Google OAuth ayarını yap. [Firebase auto yapmıyacak mı zaten?]
   - Chrome extension ID belli olduktan sonra Google OAuth client oluştur.
   - Redirect URI:
     `https://<extension-id>.chromiumapp.org/google`
   - Client ID'yi `src/config/appConfig.js` içindeki `googleClientId` alanına eklet.

5. Secret güvenliği. [Done]

## Vercel Env Listesi

### Discord Auth

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
OAUTH_STATE_SECRET=
BOOTSTRAP_DISCORD_IDS=
```

### Firebase Admin

Tek parça önerilen kullanım:

```env
FIREBASE_SERVICE_ACCOUNT_JSON=
```

Alternatif parçalı kullanım:

```env
FIREBASE_PROJECT_ID=lutheus-project
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Groq AI

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

### Eski Backend/Bot Opsiyonel Envler

Bu değişkenler eski backend/bot dosyalarında geçiyor. Yeni Vercel auth akışı için şart değil.

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

## Canlı Test Sırası

1. `npm.cmd run lint`
2. `npm.cmd run test`
3. `.env` dosyasındaki zorunlu anahtarları kontrol et. `[YAPILDI]`
4. Chrome'da extension'ı unpacked olarak `C:\Projects\lutheus` dizininden yükle.
5. Login olmadan sidepanel/admin açılmadığını kontrol et.
6. Discord bootstrap admin ile giriş yap.
7. Admin panelden Google allowlist kaydı ekle.
8. Allowlist Google hesabıyla giriş yap.
9. Moderator rolünde CUK/DB yönetimi kapalı mı kontrol et.
10. Admin rolünde Sapphire scan başlat.
11. Firestore'da `users`, `roleCache`, `googleAllowlist`, `cases`, `scanRuns`, `analysis`, `auditLogs` koleksiyonlarını kontrol et.
12. Groq AI yorumunu çalıştır; role-based limit aşımında CUK analizinin devam ettiğini doğrula.

## Beklenen Son Durum

- `npm.cmd run lint` başarılı.
- `npm.cmd run test` başarılı.
- Extension root dizinden yükleniyor.
- Discord login Firebase custom token ile çalışıyor.
- Google login allowlist ile çalışıyor.
- Admin/yönetici/kıdemli tüm yönetim yüzeylerine erişiyor.
- Moderator sadece kendi profil ve istatistik detayını görüyor.
