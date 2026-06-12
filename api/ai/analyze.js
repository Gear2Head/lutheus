const { supabase } = require('../_lib/supabaseClient');
const { requirePermission } = require('../_lib/serverAuth');
const { DEFAULT_GROQ_LIMITS, PERMISSIONS, normalizeRole } = require('../_lib/roles');
const fs = require('fs');
const path = require('path');

// Load CUK Rules dynamically
let cukRules = {
    "sunucu_dinamigi": {
        "allowed": [
            15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 1920, 2880, 5760, 0
        ]
    }
};
try {
    const rulesPath = path.resolve(__dirname, '../../packages/cuk/rules.json');
    if (fs.existsSync(rulesPath)) {
        cukRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    }
} catch (e) {
    console.warn('CUK Rules load failed, using default rules:', e.message);
}

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

// quotaId: Use bare Discord snowflake (no 'discord:' prefix) so that
// the Vercel panel and the Discord bot (groq.ts) share the same quota key.
function resolveQuotaId(actor) {
    // actor.discordId is the bare snowflake extracted from the JWT by serverAuth.js
    if (actor.discordId && /^\d{17,20}$/.test(actor.discordId)) return actor.discordId;
    // fallback: strip 'discord:' prefix from uid
    return String(actor.uid || '').replace(/^discord:/, '');
}

async function checkQuota(quotaId, role) {
    const limit = await resolveLimit(role);
    if (limit <= 0) throw new Error('AI_DISABLED_FOR_ROLE');

    const key = `ai_quota_${quotaId}_${todayKey()}`;

    const { data: row } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();

    const current = row ? (row.value || {}) : {};
    const used = Number(current.used || 0);

    if (used >= limit) throw new Error('AI_RATE_LIMIT_EXCEEDED');

    return { limit, used, remaining: limit - used };
}

async function consumeQuota(quotaId, role) {
    const key = `ai_quota_${quotaId}_${todayKey()}`;
    const limit = await resolveLimit(role);

    const { data, error } = await supabase.rpc('increment_ai_quota', {
        key_param: key,
        role_param: role,
        limit_param: limit
    });

    if (error) {
        throw new Error(error.message || 'FAILED_TO_CONSUME_QUOTA');
    }

    const used = Number(data?.used || 0);
    return { limit, used, remaining: Math.max(0, limit - used) };
}

async function callGroq(payload) {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
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

    const model = payload.image ? 'meta-llama/llama-4-scout-17b-16e-instruct' : (process.env.GROQ_MODEL || 'llama-3.1-8b-instant');
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
            temperature: 0.05,
            max_tokens: 600,
            messages: [
                {
                    role: 'system',
                    content: `Sen Lutheus CUK (Ceza Uygulama Kitapçığı) Denetim Asistanısın. Görevin: Türkçe moderatör ceza sebeplerini ve sürelerini CUK kurallarına göre analiz edip KESIN ve ANLAŞILIR Türkçe yanıt vermek.

CUK Kural Kitabı (Güncel):
1. Yetkililere Saygısızlık (yetkili, admin, mod, ekip, ismini kötüleme, aşağılama, iftira): İzin verilen süreler: 12s (720dk), 24s (1440dk), 48s (2880dk), süresiz. 12 saatten az → GEÇERSİZ.
2. Oyunculara Saygısızlık (oyuncu, şahsa, kişiye, üyeye, hakaret, aptal, mal, salak): İzin verilen süreler: 3s (180dk), 6s (360dk), 12s (720dk), süresiz.
   - Ailevi hakaret (anne, baba, ananı, orospu vb.): 6s (360dk), 12s (720dk), 24s (1440dk), süresiz.
   - Kitleye hakaret (herkes, topluluk, kitle): 12s (720dk), 24s (1440dk), 48s (2880dk), süresiz.
3. Küfür/Hakaret (küfür, argo, uygunsuz kelime/mesaj/içerik): Kademe süreler: 15, 30, 60, 120, 240, 480, 720, 960, 1440, 1920, 2880 dk veya süresiz.
   - Cinsellik içeriyorsa: 12s (720dk), 24s (1440dk), 48s (2880dk) veya süresiz.
4. Dini/Milli Değerler (dini, milli, kutsal, atatürk, allah, peygamber, bayrak): Min 7 gün (10080dk) veya süresiz. ("Dinamik" gibi kelimelerde "din" ile eşleştirme yapma!)
5. Sunucu Dinamiği (sunucu dinamiği, dinamik, flood, spam, polemik, sohbet bütünlüğü, kanal dışı, etiket, kampanya, yalan): İzin verilen süreler: ${JSON.stringify(cukRules.sunucu_dinamigi.allowed)} dk veya süresiz.
6. Reklam (reklam, davet linki, discord.gg, youtube.com): Min 24s (1440dk) veya süresiz.
7. Destek Talebi (destek, bilet, ticket, tekrarlı bilet): Tekrarlı bilet: 1s (60dk); Troll/Uygunsuz üslup: 24s (1440dk).
8. Yönetim Kararı / Discord ToS: Her zaman GEÇERLİ.

ANALİZ KURALLARI:
- Kelimenin tam olarak geçmesi şart değil. Anlam eşdeğerliği yeterli. Örnek: "sohbet bütünlüğünü bozacak davranış" → Sunucu Dinamiği.
- Süre dakika cinsinden verilir. Eğer süresiz ise 0 olarak kabul et.
- Eğer görsel (ekran görüntüsü) eklendiyse, içindeki metin ve ihlali oku ve denetimde kullan.
- Yanıtını SADECE aşağıdaki JSON formatında ver, başka açıklama ekleme.

JSON ÇIKTI FORMATI:
{
  "valid": true/false,
  "categoryMatched": "Eşleşen kategori adı (veya 'Diğer')",
  "summary": "Kısa Türkçe denetim özeti (1-2 cümle).",
  "riskReasons": "Neden geçersiz olduğu (geçerliyse null).",
  "recommendedAction": "Doğru süre önerisi ve gerekçesi.",
  "confidenceNote": "Semantik sınıflandırma mantığı notu."
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
    const content = data?.choices?.[0]?.message?.content || '{}';
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

async function callGroqForProof(payload) {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
        return {
            valid: true,
            categoryMatched: "AI Disabled",
            summary: "AI service unavailable. Defaulting to valid.",
            degraded: true
        };
    }

    const model = payload.image ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant';
    const userContent = [];

    const textPayload = {
        reason_raw: payload.reason_raw,
        duration_raw: payload.duration_raw,
        type: payload.type,
        raw_text: payload.raw_text
    };

    userContent.push({
        type: 'text',
        text: `Lütfen bu kanıt verisini denetle:\n${JSON.stringify(textPayload)}`
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
            temperature: 0.05,
            max_tokens: 600,
            messages: [
                {
                    role: 'system',
                    content: `Sen Lutheus CUK (Ceza Uygulama Kitapçığı) Kanıt Denetim Asistanısın.
Görevlerin:
1. Eğer kanıt resmi (ekran görüntüsü) varsa, üzerindeki sohbet loglarını OCR ile oku.
2. Bu kanıtın, kesilen ceza sebebiyle ('${payload.reason_raw}') ve ceza süresiyle ('${payload.duration_raw}') uyumlu olup olmadığını CUK kurallarına göre analiz et.
3. Örneğin: Ceza sebebi "Küfür" ise ve resimde küfür içeren bir sohbet logu varsa, bu kanıt geçerlidir (valid: true). Eğer resimde küfür yoksa veya başka bir kullanıcının konuşmasıysa veya ceza sebebiyle tamamen alakasızsa geçerli değildir (valid: false).
4. Yanıtını SADECE aşağıdaki JSON formatında ver, başka açıklama ekleme.

JSON ÇIKTI FORMATI:
{
  "valid": true/false,
  "categoryMatched": "CUK kategorisi",
  "summary": "Neden geçerli veya geçersiz olduğuna dair 1-2 cümlelik kısa Türkçe açıklama."
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
    const content = data?.choices?.[0]?.message?.content || '{}';
    try {
        return JSON.parse(content.trim());
    } catch (err) {
        console.error('GROQ_PROOF_PARSE_ERROR', content);
        return {
            valid: false,
            categoryMatched: "Parse Failure",
            summary: "AI response malformed."
        };
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const actor = await requirePermission(req, PERMISSIONS.DASHBOARD_VIEW);
        const quotaId = resolveQuotaId(actor);
        
        const { case_id, force_reanalyze } = req.body || {};
        
        if (case_id) {
            // Case-specific proof analysis
            // 1. Fetch case proof
            const { data: proof } = await supabase
                .from('case_proofs')
                .select('*')
                .eq('case_id', case_id)
                .maybeSingle();
                
            if (!proof) {
                return res.status(404).json({ success: false, error: 'PROOF_NOT_FOUND' });
            }
            
            // If already analyzed and not force_reanalyze, return existing
            if (proof.ai_verdict && !force_reanalyze) {
                return res.status(200).json({
                    success: true,
                    role: actor.role,
                    analysis: {
                        valid: proof.ai_verdict === 'valid',
                        categoryMatched: proof.ai_verdict === 'valid' ? 'Valid' : 'Invalid',
                        summary: proof.ai_analysis,
                        ai_verdict: proof.ai_verdict,
                        ai_analysis: proof.ai_analysis
                    }
                });
            }
            
            // 2. Fetch case details
            const { data: caseRow } = await supabase
                .from('sapphire_cases')
                .select('*')
                .eq('case_id', case_id)
                .maybeSingle();
                
            if (!caseRow) {
                return res.status(404).json({ success: false, error: 'CASE_NOT_FOUND' });
            }
            
            // Check quota
            await checkQuota(quotaId, actor.role);
            
            // 3. Call Groq
            const groqPayload = {
                reason_raw: caseRow.reason_raw,
                duration_raw: caseRow.duration_raw,
                type: caseRow.type,
                raw_text: proof.raw_text
            };
            if (proof.proof_url) {
                groqPayload.image = proof.proof_url;
            }
            
            const analysis = await callGroqForProof(groqPayload);
            
            // Consume quota
            let quota = { remaining: 0, limit: 0, used: 0 };
            if (!analysis.degraded) {
                quota = await consumeQuota(quotaId, actor.role);
            }
            
            // 4. Update case_proofs
            const aiVerdict = analysis.valid ? 'valid' : 'invalid';
            const aiAnalysis = analysis.summary || 'Analiz tamamlandı.';
            
            await supabase
                .from('case_proofs')
                .update({
                    ai_verdict: aiVerdict,
                    ai_analysis: aiAnalysis,
                    updated_at: new Date().toISOString()
                })
                .eq('case_id', case_id);
                
            return res.status(200).json({
                success: true,
                role: actor.role,
                analysis: {
                    valid: analysis.valid,
                    categoryMatched: analysis.categoryMatched,
                    summary: aiAnalysis,
                    ai_verdict: aiVerdict,
                    ai_analysis: aiAnalysis
                },
                quota: { remaining: quota.remaining, limit: quota.limit, used: quota.used }
            });
        }

        // Default behavior (general text/image analysis)
        // Check quota first without consuming
        await checkQuota(quotaId, actor.role);

        const analysis = await callGroq(req.body || {});

        let quota = { remaining: 0, limit: 0, used: 0 };
        if (!analysis?.degraded) {
            quota = await consumeQuota(quotaId, actor.role);
        } else {
            // Get current remaining quota stats without consuming
            const limit = await resolveLimit(actor.role);
            const key = `ai_quota_${quotaId}_${todayKey()}`;
            const { data: row } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', key)
                .maybeSingle();
            const current = row ? (row.value || {}) : {};
            const used = Number(current.used || 0);
            quota = { limit, used, remaining: Math.max(0, limit - used) };
        }

        // Write audit log for dashboard queries
        try {
            const body = req.body || {};
            await supabase.from('audit_logs').insert([{
                action: 'bot_ai_query',
                actor_discord_id: actor.discordId || null,
                actor_email: actor.email || null,
                actor_user_id: actor.uid || null,
                target_type: 'dashboard',
                metadata: {
                    discordId: actor.discordId || null,
                    role: actor.role,
                    question: String(body.reason_raw || body.question || '').slice(0, 500),
                    response: analysis,
                    hasImage: Boolean(body.image),
                    quotaRemaining: quota.remaining,
                    quotaLimit: quota.limit,
                    source: 'dashboard_panel',
                },
                created_at: new Date().toISOString(),
            }]);
        } catch (auditErr) {
            console.warn('AI Analyze: Failed to write audit log:', auditErr.message);
        }

        res.status(200).json({
            success: true,
            role: actor.role,
            analysis,
            quota: { remaining: quota.remaining, limit: quota.limit, used: quota.used }
        });
    } catch (error) {
        console.error('AI Analyze API Error:', error);
        const statusCode = error.statusCode || (error.message === 'AI_RATE_LIMIT_EXCEEDED' ? 429 : (error.message === 'AI_DISABLED_FOR_ROLE' ? 403 : 400));
        res.status(statusCode).json({
            success: false,
            error: error.message || 'AI_ANALYZE_FAILED'
        });
    }
};

