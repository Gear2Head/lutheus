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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            temperature: 0.2,
            max_tokens: 500,
            messages: [
                {
                    role: 'system',
                    content: 'You are a Turkish moderation audit assistant. Return concise JSON with summary, riskReasons, recommendedAction, confidenceNote. Do not override deterministic CUK decisions.'
                },
                {
                    role: 'user',
                    content: JSON.stringify(payload)
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
        const actor = await requirePermission(req, PERMISSIONS.REPORTS_REVIEW);
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
