# Lutheus CezaRapor Supabase Senkronizasyon Duzeltme Promptu

Sen bu repoda Caveman Fullstack AI Auto Coder olarak calisiyorsun.

## Hedef

Chrome extension dashboard ana sayfasinda veri bos gorunuyor, ancak `Son Cezalar` sekmesinde Supabase `sapphire_cases` verisi geliyor. Auth/admin ekraninda su API hatalari var:

```text
GET https://lutheus.vercel.app/api/admin/staff-profiles 404
GET https://lutheus.vercel.app/api/admin/role-cache 500
```

Aktif gercek veri kaynagi GitHub'daki eski DB degil, Supabase projesidir:

```text
https://jxhzhaqqtlynbnntwpyu.supabase.co
```

Amac: isimler, yetkililer, cezalar, kayitlar, role cache, staff profile ve dashboard istatistikleri aktif Supabase sistemiyle tek kaynak olarak senkron calissin.

## Repo Baglami

Ilk kontrol edilecek dosyalar:

```text
api/admin/[route].js
api/_lib/serverAuth.js
api/_lib/supabaseClient.js
src/lib/adminApiClient.js
src/lib/firebaseRepository.js
src/lib/storage.js
src/lib/supabaseRest.js
src/dashboard/admin.js
src/dashboard/admin.html
src/dashboard/admin.css
supabase/schema.sql
vercel.json
package.json
```

Kopya build/source dosyalari varsa ayni fix gerekli yerlere uygulanmali:

```text
public/lib/*
public/dashboard/*
public/auth/*
```

## Bilinen Semptomlar

1. `src/lib/supabaseRest.js` uzerinden `sapphire_cases` listesi geliyor:

```text
GET /rest/v1/sapphire_cases?select=*&limit=500&order=created_at_sapphire.desc
```

2. `src/dashboard/admin.js` `loadData()` su zinciri kullaniyor:

```text
Storage.getCases()
Storage.getUserRegistry()
FirebaseRepository.listUserRegistry()
Storage.getStaffDirectory()
Storage.getDynamicRules()
Storage.getLatestPointtrainRun()
Storage.getUserInfo()
```

3. `Son Cezalar` sekmesinde cezalar var ama ana dashboard istatistikleri/yetkili eslesmeleri eksik.

4. Auth/admin bolumunde `role_cache` ve `staff_profiles` API'leri bozuk oldugu icin staff directory ve yetkili isimleri Supabase ile tam eslesmiyor.

5. `Son Cezalar` ekraninda su uyari gorunuyor:

```text
Cozumlenmemis: 33 ceza kaydi yetkili listesine dahil edilmedi.
```

Bu, `sapphire_cases.author_discord_id` / `author_display_name` ile `staff_profiles` / `role_cache` arasinda eksik veya hatali eslesme oldugunu gosterir.

## Root Cause Adaylari

Kontrol et ve sadece dogruladigini duzelt:

1. Vercel deploy aktif kodu eski olabilir veya `api/admin/[route].js` deploy'a dahil olmuyor olabilir. `staff-profiles` route'u repoda var ama prod 404 donuyor.

2. `role-cache` 500 hatasi Supabase schema farkindan kaynaklanabilir. Canli DB, `supabase/schema.sql` ile ayni olmayabilir.

3. `role_cache.discord_id` foreign key ile `staff_profiles.discord_id` referansli. `staff_profiles` satiri yokken `role_cache` upsert veya seed islemi 500 uretebilir.

4. `api/_lib/serverAuth.js` permission cozumlemesi `role_cache`, `staff_profiles`, `google_allowlist` tablolarina bagli. Bu tablolardan biri eksik/hatalıysa admin API zinciri kiriliyor.

5. `Storage.getStaffDirectory()` sadece `roleCache` icindeki kisileri staff directory'ye aliyor. `roleCache` bos veya API hataliysa `sapphire_cases` icindeki ceza sahipleri dashboard ana sayfasinda yetkili olarak sayilmayabilir.

6. `FirebaseRepository.listUserRegistry()` artik Supabase staff profile API'sine bagli. `staff-profiles` 404 oldugu icin remote registry bos donuyor.

7. GitHub'daki schema ile aktif Supabase DB farkli oldugu icin eksik kolon, tablo veya constraint uyumsuzlugu olabilir.

## Zorunlu Duzeltme Kriterleri

Minimal patch yap. Gereksiz refactor yapma.

### API

- `/api/admin/staff-profiles` prod ve localde 200 donmeli.
- `/api/admin/role-cache` prod ve localde 200 donmeli.
- API hata durumunda detayli secret loglama yapma.
- `staff_profiles` ve `role_cache` eksik/uyumsuz veri durumunda dashboard tamamen bos kalmamali.
- `role_cache` yazmadan once ilgili `staff_profiles` kaydi yoksa minimal profile satiri olustur veya FK uyumlu siralama kullan.

### Supabase

- Canli DB ile `supabase/schema.sql` farklarini tespit et.
- Eksik tablolar/kolonlar/indexler icin idempotent migration ekle.
- Mevcut veriyi silme.
- `sapphire_cases`, `staff_profiles`, `role_cache`, `google_allowlist`, `audit_logs`, `app_settings` zincirini koru.
- RLS/policy varsa bilincsiz kapatma veya bypass etme. Mevcut projede RLS kapali ise bunu sadece migration uyumlulugu icin koru.

### Dashboard

- `Son Cezalar`da gelen `sapphire_cases` verisi ana dashboard istatistiklerine de yansimali.
- Yetkili isimleri icin oncelik sirasi:

```text
staff_profiles.display_name
staff_profiles.username
role_cache.raw_payload.displayName
sapphire_cases.author_display_name
local staffDirectory displayName
User <discord_id>
```

- Avatar icin oncelik sirasi:

```text
staff_profiles.avatar_url
role_cache.raw_payload.avatar
sapphire_cases.author_avatar_url
local staffDirectory avatar
fallback avatar
```

- `author_discord_id` varsa staff key olarak bunu kullan.
- `author_discord_id` yok ama `author_display_name` varsa isim/alias bazli gecici eslesme yap; kalici DB yazimi sadece guvenilir discord id varsa yap.
- `Storage.getStaffDirectory()` role cache bos olsa bile `sapphire_cases` icindeki yetkililerden okunabilir directory uretebilmeli.
- Dashboard bos state, loading state ve hata state bozulmamali.

### Auth Console

- Auth sayfasinda gereksiz console error ureten API cagrilarini duzelt.
- Admin API kullanilamiyorsa 60 saniyelik failure cache dashboard verisini tamamen kilitlememeli.
- `AUTH_REQUIRED`, `FORBIDDEN`, `ADMIN_API_UNAVAILABLE` durumlari kisa ve kontrollu handle edilmeli.

## Uygulama Sirasi

1. `rg "staff-profiles|role-cache|getStaffDirectory|loadData|sapphire_cases|author_display_name|author_discord_id" api src public supabase` ile hedefleri bul.

2. `api/admin/[route].js` icinde:
   - `getRoute(req)` route parsing dogru mu kontrol et.
   - `staff-profiles` ve `role-cache` handler'lari Vercel path ile calisiyor mu dogrula.
   - GET handler'larinda tablo/kolon hatasi varsa kontrollu fallback veya migration gereksinimi cikar.

3. `supabase/schema.sql` icin canli DB uyum migration'i hazirla:
   - `create table if not exists`
   - `alter table add column if not exists`
   - `create index if not exists`
   - FK constraint veri uyumunu bozuyorsa once orphan verileri staff_profiles'e seed edecek idempotent SQL ekle.

4. `src/lib/storage.js` icinde `getStaffDirectory()` ve `upsertStaffDirectoryFromCases()` davranisini duzelt:
   - role cache bos diye mevcut directory temizlenmesin.
   - cases icinden staff directory hydrate edilsin.
   - sadece role cache'te olmayan diye ceza sahipleri silinmesin.

5. `src/dashboard/admin.js` `loadData()` icinde:
   - `cases` geldikten sonra staff directory cases ile hydrate edilsin.
   - remote registry ve staff directory merge sirasi Supabase verisini bozmasin.
   - dashboard render oncesi `state.staffDirectory` dolu olsun.

6. `src/lib/firebaseRepository.js` icinde:
   - `listUserRegistry()` staff-profiles API 404/500 alirsa bos array donsun ama cases kaynakli profile sync'i engellemesin.
   - `saveUserProfilesFromCases()` role cache'e avatar yazmadan once staff profile upsert sirasi FK ile uyumlu olsun.

7. Kopya runtime dosyalari varsa `public/lib/*` ve `public/dashboard/*` icin ayni degisiklikleri uygula.

8. Gerekirse `api/admin/staff-profiles.js` ve `api/admin/role-cache.js` gibi Vercel uyumlu wrapper route dosyalari ekle. Wrapper sadece mevcut `[route].js` handler'ina delegate etmeli; mantik kopyalama.

9. Buyuk dosyalarda dokunulan bolumlere section anchor ekle:

```js
// SECTION: STAFF_DIRECTORY_SYNC
// PURPOSE: Supabase role cache, staff profiles ve Sapphire cases verilerinden yetkili rehberini olusturur.
```

```js
// SECTION: DASHBOARD_DATA_LOAD
// PURPOSE: Supabase cezalarini, yetkili profillerini ve role cache verisini dashboard state'ine yukler.
```

## Test Komutlari

Mevcut scriptleri kontrol et ve mumkun olanlari calistir:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --runInBand --passWithNoTests
```

API smoke test icin local/prod token gerekiyorsa token degerini chat'e yazma. Token yoksa statik test ve unit testlerle yetin.

## Kabul Kriterleri

- `npm.cmd run lint` gecmeli veya sadece mevcut ilgisiz eski hata varsa dosya:satir raporlanmali.
- `npm.cmd run typecheck` gecmeli.
- `Son Cezalar`daki ceza sayisi ana dashboard istatistiklerinde gorunmeli.
- `Cozumlenmemis: 33 ceza kaydi yetkili listesine dahil edilmedi` uyarisi ya tamamen kalkmali ya da sadece gercekten `author_discord_id` ve guvenilir isim eslesmesi olmayan kayitlar icin kalmali.
- `/api/admin/staff-profiles` 404 vermemeli.
- `/api/admin/role-cache` 500 vermemeli.
- Supabase aktif DB ana kaynak olmali; GitHub'daki eski DB varsayimina gore kod yazilmamali.
- Mevcut auth guard, permission guard ve secret handling zayiflatilmamali.

## Final Cikti

Is basariliysa sadece:

```text
bitti
```

Hata varsa en fazla 5 satir:

```text
hata: dosya:satir - kisa sebep
```
