const { getAuth, getDb, admin } = require('../_lib/firebaseAdmin');
const { DEFAULT_GROQ_LIMITS, normalizeRole } = require('../_lib/roles');

function getBearer(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

async function resolveLimit(db, role) {
    const policy = await db.collection('rolePolicy').doc('settings').get();
    const limits = policy.exists ? (policy.data().groqLimits || {}) : {};
    return Number(limits[normalizeRole(role)] ?? DEFAULT_GROQ_LIMITS[normalizeRole(role)] ?? 0);
}

async function consumeQuota(db, uid, role) {
    const limit = await resolveLimit(db, role);
    if (limit <= 0) throw new Error('AI_DISABLED_FOR_ROLE');
    const ref = db.collection('aiQuota').doc(`${encodeURIComponent(uid)}_${todayKey()}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const used = snap.exists ? Number(snap.data().used || 0) : 0;
        if (used >= limit) throw new Error('AI_RATE_LIMIT_EXCEEDED');
        tx.set(ref, {
            uid,
            role,
            date: todayKey(),
            used: used + 1,
            limit,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
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
        const token = getBearer(req);
        if (!token) throw new Error('AUTH_REQUIRED');
        const decoded = await getAuth().verifyIdToken(token);
        const db = getDb();
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const role = normalizeRole(userDoc.exists ? userDoc.data().role : decoded.role);
        await consumeQuota(db, decoded.uid, role);
        const analysis = await callGroq(req.body || {});
        res.status(200).json({ success: true, role, analysis });
    } catch (error) {
        res.status(error.message === 'AI_RATE_LIMIT_EXCEEDED' ? 429 : 400).json({
            success: false,
            error: error.message || 'AI_ANALYZE_FAILED'
        });
    }
};
