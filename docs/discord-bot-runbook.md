# Discord Bot Runbook

## Doğru Invite Linki

Sadece `client_id` içeren link botu eklemez:

```text
https://discord.com/oauth2/authorize?client_id=1500551629768888542
```

Kullanılacak canonical link:

```text
https://discord.com/oauth2/authorize?client_id=1500551629768888542&scope=bot+applications.commands&permissions=8&integration_type=0
```

Lutheus sunucusuna kilitli link:

```text
https://discord.com/oauth2/authorize?client_id=1500551629768888542&scope=bot+applications.commands&permissions=8&integration_type=0&guild_id=1354854696874938590&disable_guild_select=true
```

## Discord Developer Portal Kontrolü

1. Application ID `DISCORD_CLIENT_ID` ile aynı olmalı.
2. Installation sekmesinde Guild Install açık olmalı.
3. Installation scopes içinde `bot` ve `applications.commands` olmalı.
4. Bot sekmesinde Public Bot açık olmalı. Kapalıysa sadece application owner ekleyebilir.
5. Bot token rotate edildiyse HF `DISCORD_TOKEN` yeniden kaydedilmeli.

## HF Diagnostics

Space açıldıktan sonra:

```text
/health
/invite-url
/diagnostics
```

`/diagnostics` içinde:

- `token.valid: true` olmalı.
- `token.matchesConfiguredClientId: true` olmalı.
- `runtime.ready: true` botun gateway'e bağlandığını gösterir.
- `DISCORD_REST_TIMEOUT` veya `Connect Timeout` HF outbound ağında Discord erişim sorunu olduğunu gösterir.

## Gateway Timeout Çözüm Sırası

1. HF secrets içinde `DISCORD_TOKEN` var mı kontrol et.
2. `/diagnostics` REST token kontrolünü çalıştır.
3. REST de timeout veriyorsa HF Space outbound Discord erişimi problemli olabilir.
4. REST valid ama gateway timeout ise Space restart yap, sonra loglarda `BOT_READY` bekle.
5. `TokenInvalid` görülürse token rotate et.

## HF Sync

GitHub `main` otomatik olarak Hugging Face Space'e gitmez. `.github/workflows/sync-hf-space.yml`
workflow'u bunun icin eklendi. GitHub repo secrets icine `HF_TOKEN` adinda Hugging Face write token
eklenmeli, sonra workflow manuel calistirilabilir veya `main` push'u ile otomatik calisir.
