// SECTION: GROQ_LIB
// PURPOSE: Discord Bot üzerinden Groq AI entegrasyonu.
// CUK analizi, kota yönetimi, audit log kaydı ve Pointtrain sorgulama içerir.

import { supabase } from '../botConfig.js';

// ─── Rütbe → Günlük Limit Tablosu ─────────────────────────────────────────
const DEFAULT_GROQ_LIMITS: Record<string, number> = {
    kurucu: 500,
    admin: 350,
    yonetici: 250,
    genel_sorumlu: 225,
    discord_yoneticisi: 210,
    kidemli: 175,
    kidemli_discord_moderatoru: 175,
    senior_moderator: 150,
    discord_moderatoru: 40,
    discord_destek_ekibi: 10,
    viewer: 0,
    pending: 0,
    blocked: 0,
    eski_yetkili: 0,
};

// Rütbeyi normalize eder (api/_lib/roles.js ile tutarlı)
export function normalizeRole(role: string): string {
    const normalized = String(role || 'pending').trim().toLowerCase()
        .replace(/i̇/g, 'i').replace(/ı/g, 'i')
        .replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '_');

    const aliases: Record<string, string> = {
        owner: 'kurucu',
        super_admin: 'admin',
        yönetici: 'yonetici',
        manager: 'genel_sorumlu',
        kidemli_discord_moderatoru: 'kidemli_discord_moderatoru',
        'kidemli discord moderatoru': 'kidemli_discord_moderatoru',
        kıdemli: 'kidemli_discord_moderatoru',
        kidemli: 'kidemli_discord_moderatoru',
        senior_mod: 'senior_moderator',
        mod: 'discord_moderatoru',
        moderator: 'discord_moderatoru',
        discord_mod: 'discord_moderatoru',
        discord_moderatoru: 'discord_moderatoru',
        support: 'discord_destek_ekibi',
        destek: 'discord_destek_ekibi',
    };

    return aliases[normalized] || aliases[normalized.replace(/_/g, '')] || normalized;
}

export const UST_YONETIM_ROLLERI = [
    'kurucu',
    'admin',
    'yonetici',
    'genel_sorumlu',
    'discord_yoneticisi',
    'senior_moderator',
    'kidemli',
    'kidemli_discord_moderatoru'
];

export function isUstYonetim(role: string): boolean {
    const normalized = normalizeRole(role);
    return UST_YONETIM_ROLLERI.includes(normalized);
}


// ─── Günlük Kota Anahtar ──────────────────────────────────────────────────
function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
}

function quotaKey(discordId: string): string {
    return `ai_quota_${discordId}_${todayKey()}`;
}

// ─── Günlük Limit Çözümleme ───────────────────────────────────────────────
export async function resolveLimit(role: string): Promise<number> {
    try {
        const { data: row } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'settings')
            .maybeSingle();

        const policy = row?.value || {};
        const limits = policy.groqLimits || {};
        const normalizedRole = normalizeRole(role);
        return Number(limits[normalizedRole] ?? DEFAULT_GROQ_LIMITS[normalizedRole] ?? 0);
    } catch {
        return DEFAULT_GROQ_LIMITS[normalizeRole(role)] ?? 0;
    }
}



import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dynamic rules
let cukRules = {
    sunucu_dinamigi: {
        allowed: [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0]
    }
};
try {
    const rulesPath = path.resolve(__dirname, '../../../../packages/cuk/rules.json');
    if (fs.existsSync(rulesPath)) {
        cukRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    }
} catch (e: any) {
    console.warn('Discord Bot: CUK Rules load failed, using default rules:', e.message);
}

// ─── CUK System Prompt ────────────────────────────────────────────────────
const CUK_SYSTEM_PROMPT = `Sen Lutheus CUK (Ceza Uygulama Kitapçığı) Denetim Asistanısın. Görevin: Türkçe moderatör ceza sebeplerini ve sürelerini CUK kurallarına göre analiz edip KESIN ve ANLAŞILIR Türkçe yanıt vermek.

CUK Kural Kitabı (Güncel):
1. Yetkililere Saygısızlık (yetkili, adal, admin, mod, ekip, ismini kötüleme, aşağılama, iftira): İzin verilen süreler: 12s (720dk), 24s (1440dk), 48s (2880dk), süresiz (0).
2. Oyunculara Saygısızlık:
   - 1. Derece (Şahsa Hakaret): 3sa (180dk), 6sa (360dk), 12sa (720dk), süresiz (0).
   - 2. Derece (Ailevi Hakaret) (anne, baba, ananı, orospu vb.): 6sa (360dk), 12sa (720dk), 24sa (1440dk), süresiz (0).
   - 3. Derece (Troll/Toxic): 6sa (360dk), 12sa (720dk), 24sa (1440dk), süresiz (0).
   - 4. Derece (Kitleye Hakaret) (herkes, topluluk, kitle): 12sa (720dk), 24sa (1440dk), 48sa (2880dk), süresiz (0).
3. Küfür/Hakaret:
   - 1. Derece (Yöneltme Olmayan Küfür) (küfür, argo, uygunsuz kelime/mesaj/içerik): 15dk, 30dk, 60dk, 120dk, 240dk, 480dk, 960dk, 1920dk, süresiz (0).
   - 2. Derece (Cinsellik/NSFW): 12sa (720dk), 24sa (1440dk), 48sa (2880dk), süresiz (0).
4. Dini/Milli Değerler (dini, milli, kutsal, atatürk, allah, peygamber, bayrak): Sadece 7 gün (10080dk) veya süresiz (0). ("Dinamik" gibi kelimelerde "din" ile eşleştirme yapma!)
5. Sunucu Dinamiği: İzin verilen süreler: ${JSON.stringify(cukRules.sunucu_dinamigi.allowed)} dk veya süresiz (0).
6. Reklam (reklam, davet linki, discord.gg, üye çekme): Sadece 24sa (1440dk) veya süresiz (0).
7. Destek Talebi:
   - 1. Derece (Tekrarlı Bilet Açımı): 1sa (60dk) veya süresiz (0).
   - 2. Derece (Uygunsuz Üslup/Troll): 24sa (1440dk) veya süresiz (0).
8. Yönetim Kararı / Discord ToS: Her zaman GEÇERLİ ("valid": true).

ANALİZ VE TOLERANS KURALLARI:
- Süre kontrollerinde 5 dakikalık tolerans payı vardır. Eğer verilen süre, ilgili kuraldaki hedef süreden en fazla 5 dakika az veya çok ise (örneğin 6 saat = 360 dk yerine 355 dk veya 358 dk gibi değerler gelirse) bunu CUK ile uyumlu say ve "valid": true döndür.
- Kategori dışı, belirsiz, anlamsız veya placeholder sebeplerde (örneğin "bos", "test", "abc" vb.) ya da kitapçıktaki sürelere uymayan cezalarda KESİNLİKLE "valid": false döndür.
- Süre dakika cinsinden verilir. Eğer süresiz ise 0 olarak kabul et.
- Eğer görsel (ekran görüntüsü) eklendiyse, içindeki metin ve ihlali oku ve denetimde kullan. Görselde hiçbir metin, kullanıcı adı veya ihlal içeriği okunamıyorsa "imageUnreadable": true olarak döndür.
- Yanıtını SADECE aşağıdaki JSON formatında ver, başka açıklama ekleme.

JSON ÇIKTI FORMATI:
{
  "valid": true/false,
  "categoryMatched": "Eşleşen kategori adı (veya 'Diğer')",
  "summary": "Kısa Türkçe denetim özeti (1-2 cümle).",
  "riskReasons": "Neden geçersiz olduğu (geçerliyse null).",
  "recommendedAction": "Doğru süre önerisi ve gerekçesi.",
  "confidenceNote": "Semantik sınıflandırma mantığı notu.",
  "imageUnreadable": false
}`;

// ─── Kota Tüketimi ────────────────────────────────────────────────────────
export async function consumeQuota(discordId: string, role: string): Promise<{ remaining: number; limit: number }> {
    const limit = await resolveLimit(role);
    if (limit <= 0) throw new Error('AI_DISABLED_FOR_ROLE');

    const key = quotaKey(discordId);

    const { data, error } = await supabase.rpc('increment_ai_quota', {
        key_param: key,
        role_param: role,
        limit_param: limit
    });

    if (error) {
        throw new Error(error.message || 'FAILED_TO_CONSUME_QUOTA');
    }

    const used = Number(data?.used || 0);
    return { remaining: Math.max(0, limit - used), limit };
}

// ─── Kalan Kota Sorgulama (tüketmeden) ────────────────────────────────────
export async function getRemainingQuota(discordId: string, role: string): Promise<{ remaining: number; limit: number; used: number }> {
    const limit = await resolveLimit(role);
    const key = quotaKey(discordId);

    const { data: row } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    const used = Number(row?.value?.used || 0);
    return { remaining: Math.max(0, limit - used), limit, used };
}

// ─── Groq API Çağrısı ─────────────────────────────────────────────────────
export async function callGroq(payload: {
    reason_raw?: string;
    duration_ms?: number;
    imageUrl?: string;
    question?: string;
}): Promise<Record<string, unknown>> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return {
            valid: null,
            degraded: true,
            categoryMatched: "AI Disabled",
            summary: "AI service unavailable. Deterministic validation only.",
            riskReasons: "GROQ_API_KEY_MISSING",
            recommendedAction: null,
            confidenceNote: "Fallback mode activated."
        };
    }

    const hasImage = Boolean(payload.imageUrl);
    const model = hasImage ? 'meta-llama/llama-4-scout-17b-16e-instruct' : (process.env.GROQ_MODEL || 'llama-3.1-8b-instant');

    const userContent: unknown[] = [];

    const textPayload = {
        reason_raw: payload.reason_raw || null,
        duration_minutes: payload.duration_ms ? Math.round(payload.duration_ms / 60000) : null,
        question: payload.question || null,
    };

    userContent.push({ type: 'text', text: JSON.stringify(textPayload) });

    if (hasImage) {
        userContent.push({
            type: 'image_url',
            image_url: { url: payload.imageUrl },
        });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.05,
            max_tokens: 700,
            messages: [
                { role: 'system', content: CUK_SYSTEM_PROMPT },
                { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
        }),
    });

    const data = await response.json() as any;
    if (!response.ok) {
        throw new Error(data?.error?.message || 'GROQ_REQUEST_FAILED');
    }

    const content = data.choices?.[0]?.message?.content || '{}';
    try {
        const cleaned = content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(cleaned);
    } catch (err) {
        console.error('GROQ_PARSE_ERROR', content);
        return {
            valid: false,
            categoryMatched: "Parse Failure",
            summary: "AI response malformed.",
            riskReasons: "JSON_PARSE_FAILURE",
            recommendedAction: "Use deterministic CUK validation.",
            confidenceNote: "AI output corrupted."
        };
    }
}

// ─── Audit Log Yazma ──────────────────────────────────────────────────────
export async function writeAiQueryAudit(params: {
    discordId: string;
    displayName: string;
    role: string;
    question: string;
    response: Record<string, unknown>;
    remaining: number;
    limit: number;
    hasImage: boolean;
}): Promise<void> {
    try {
        await supabase.from('audit_logs').insert([{
            action: 'bot_ai_query',
            actor_discord_id: params.discordId,
            actor_email: null,
            actor_user_id: null,
            target_type: 'bot_dm',
            metadata: {
                discordId: params.discordId,
                displayName: params.displayName,
                role: params.role,
                question: params.question.slice(0, 500),
                response: params.response,
                hasImage: params.hasImage,
                quotaRemaining: params.remaining,
                quotaLimit: params.limit,
                source: 'discord_bot_dm',
            },
            created_at: new Date().toISOString(),
        }]);
    } catch (err: any) {
        console.warn('Discord Bot: Failed to write ai query audit log:', err.message);
    }
}

// ─── Pointtrain Sorgu ─────────────────────────────────────────────────────
export async function fetchPointtrainStats(discordId: string, guildId: string): Promise<{
    found: boolean;
    caseCount?: number;
    validCount?: number;
    invalidCount?: number;
    accuracy?: number;
    rank?: number;
}> {
    try {
        const { data: cases } = await supabase
            .from('sapphire_cases')
            .select('author_discord_id, cuk_verdict')
            .eq('guild_id', guildId);

        if (!cases || cases.length === 0) return { found: false };

        const allByMod = new Map<string, { valid: number; invalid: number; total: number }>();
        for (const c of cases) {
            const id = c.author_discord_id;
            if (!id) continue;
            if (!allByMod.has(id)) allByMod.set(id, { valid: 0, invalid: 0, total: 0 });
            const entry = allByMod.get(id)!;
            entry.total++;
            if (c.cuk_verdict === 'valid') entry.valid++;
            else if (c.cuk_verdict === 'invalid') entry.invalid++;
        }

        const myStats = allByMod.get(discordId);
        if (!myStats) return { found: false };

        // Sıralaması: toplam geçerliye göre sırala
        const sorted = Array.from(allByMod.entries()).sort((a, b) => b[1].valid - a[1].valid);
        const rank = sorted.findIndex(([id]) => id === discordId) + 1;
        const accuracy = myStats.total > 0 ? Math.round((myStats.valid / myStats.total) * 100) : 0;

        return {
            found: true,
            caseCount: myStats.total,
            validCount: myStats.valid,
            invalidCount: myStats.invalid,
            accuracy,
            rank,
        };
    } catch (err: any) {
        console.warn('Discord Bot: Pointtrain stats fetch failed:', err.message);
        return { found: false };
    }
}
