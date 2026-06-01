const { supabase } = require('../_lib/supabaseClient');
const { requirePermission } = require('../_lib/serverAuth');
const { DEFAULT_GROQ_LIMITS, PERMISSIONS, normalizeRole } = require('../_lib/roles');

// SECTION: AI_SERVICE
// PURPOSE: Handles server-side AI evaluation with Groq, utilizing Supabase Auth and app_settings-based rate limits.

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

async function resolveLimit(role) {
    const { data: row } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'settings')
        .maybeSingle();

    const policy = row ? (row.value || {}) : {};
    const limits = policy.groqLimits || {};
    return Number(limits[normalizeRole(role)] ?? DEFAULT_GROQ_LIMITS[normalizeRole(role)] ?? 0);
}

async function consumeQuota(uid, role) {
    const limit = await resolveLimit(role);
    if (limit <= 0) throw new Error('AI_DISABLED_FOR_ROLE');

    const key = `ai_quota_${uid}_${todayKey()}`;

    const { data: row } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();

    const current = row ? (row.value || {}) : {};
    const used = Number(current.used || 0);

    if (used >= limit) throw new Error('AI_RATE_LIMIT_EXCEEDED');

    await supabase.from('app_settings').upsert([{
        key,
        value: {
            uid,
            role,
            date: todayKey(),
            used: used + 1,
            limit,
            updatedAt: new Date().toISOString()
        }
    }], { onConflict: 'key' });

    return limit;
}

async function callGroq(payload) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY_MISSING');

    const model = payload.image ? 'llama-3.2-11b-vision-preview' : (process.env.GROQ_MODEL || 'llama-3.1-8b-instant');
    const userContent = [];

    // Strip image from text payload to keep tokens low
    const textPayload = { ...payload };
    delete textPayload.image;

    userContent.push({
        type: 'text',
        text: JSON.stringify(textPayload)
    });

    if (payload.image) {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: payload.image
            }
        });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 400,
            messages: [
                {
                    role: 'system',
                    content: `You are the master Lutheus CUK (Ceza Uygulama Kitapçığı) Audit Assistant. Your job is to semantically analyze Turkish moderation reasons and durations and decide if they strictly follow the CUK rules.

                    Here is the definitive CUK Rulebook:
                    1. "Yetkililere Saygısızlık" (Keywords: yetkili, adal, admin, mod, ekip, ismini kötüleme, aşağılama, iftira): Min duration is 12 hours (720 minutes). If duration is less than 12 hours, it is INVALID.
                    2. "Oyunculara Saygısızlık" (Keywords: oyuncu, şahsa, kişiye, üyeye, saygısızlık, hakaret): Min duration is 6 hours (360 minutes). If less than 6 hours, it is INVALID.
                    3. "Küfür/Hakaret" (Keywords: küfür, argo, uygunsuz kelime/mesaj/içerik): Allowed durations are strictly in [15, 30, 60, 120, 240, 480, 720, 960, 1440, 1920, 2880] minutes.
                    4. "Dini/Milli Değerler" (Keywords: dini değer, milli değer, kutsal, atatürk, din, milli, kutsala): Min duration is 7 days (10080 minutes). (Do not match 'dinamik' or similar words with 'din').
                    5. "Sunucu Dinamiği" (Keywords: sunucu dinamiği, dinamik, sunucu düzeni, sohbet bozmak, sohbet bütünlüğünü bozmak, kanalın amacı, flood, spam, polemik, toksiklik, toxic, kışkırtma): Allowed durations are strictly in [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760] minutes.
                    6. "Reklam" (Keywords: reklam, davet linki, discord.gg, youtube.com, üye çekme): Min duration is 24 hours (1440 minutes).
                    7. "Destek Talebi" (Keywords: destek, bilet, ticket, tekrarlı, troll): Min duration is 1 hour (60 minutes).
                    8. "Yönetim Kararı" / "Discord ToS": Always approved.

                    Analyze the input reason semantically. Even if the exact keyword is not present, map it if the meaning is identical (e.g. "sohbet bütünlüğünü bozacak davranış" -> Sunucu Dinamiği).
                    If an image (e.g., screenshot of game chat or discord logs) is attached, run OCR or extract relevant text/violations from the image to audit the case.

                    Return a JSON object containing:
                    {
                      "summary": "Short Turkish summary of the audit.",
                      "valid": true/false,
                      "categoryMatched": "The matched category name above (or 'Diğer')",
                      "riskReasons": "Why the penalty is invalid/wrong if valid is false, otherwise null.",
                      "recommendedAction": "Action details, correct duration suggestion.",
                      "confidenceNote": "Note explaining semantic classification logic."
                    }`
                },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            response_format: { type: 'json_object' }
        })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'GROQ_REQUEST_FAILED');
    }
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const actor = await requirePermission(req, PERMISSIONS.DASHBOARD_VIEW);
        await consumeQuota(actor.uid, actor.role);
        const analysis = await callGroq(req.body || {});
        res.status(200).json({ success: true, role: actor.role, analysis });
    } catch (error) {
        console.error('AI Analyze API Error:', error);
        const statusCode = error.statusCode || (error.message === 'AI_RATE_LIMIT_EXCEEDED' ? 429 : 400);
        res.status(statusCode).json({
            success: false,
            error: error.message || 'AI_ANALYZE_FAILED'
        });
    }
};
