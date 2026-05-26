const { getDb } = require('../_lib/firebaseAdmin');
const { requirePermission, safeDocId } = require('../_lib/serverAuth');
const { PERMISSIONS, normalizeRole } = require('../_lib/roles');
const { ok, badRequest, forbidden, serverError } = require('../_lib/apiResponse');

// SECTION: ADMIN_CATCH_ALL
// PURPOSE: Merged administrative API router to comply with Vercel serverless function allocations limit.

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeIdentityKey(value) {
    return String(value || '').trim();
}

function getRoute(req) {
    const route = req.query?.route;
    if (Array.isArray(route)) return String(route[0] || '').replace(/^\/+|\/+$/g, '');
    return String(route || '').replace(/^\/+|\/+$/g, '');
}

async function addAudit(db, action, actor, details = {}) {
    return db.collection('auditLogs').add({
        action,
        actorUid: actor?.uid || null,
        actorRole: actor?.role || null,
        details,
        createdAt: new Date().toISOString()
    }).catch(() => null);
}

async function handleAuditLogs(req, res, db) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requirePermission(req, PERMISSIONS.AUDIT_LOGS_VIEW);

    const snap = await db.collection('auditLogs')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(res, { items });
}

async function handleGoogleAllowlist(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW);

        const snap = await db.collection('googleAllowlist').limit(200).get();
        const items = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                email: String(data.email || doc.id || '').toLowerCase(),
                allowed: data.allowed !== false,
                role: normalizeRole(data.role || 'viewer')
            };
        });

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const payload = {
            email,
            allowed: req.body?.allowed !== false,
            role: normalizeRole(req.body?.role || 'viewer'),
            note: req.body?.note || '',
            expiresAt: req.body?.expiresAt || null,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        const id = safeDocId(email);
        await db.collection('googleAllowlist').doc(id).set(payload, { merge: true });
        await addAudit(db, 'google_allowlist_updated', actor, payload);

        return ok(res, { item: { id, ...payload } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.query.email || req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const id = safeDocId(email);
        await db.collection('googleAllowlist').doc(id).delete();
        await addAudit(db, 'google_allowlist_deleted', actor, { email });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRoleCache(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        const snap = await db.collection('roleCache').limit(500).get();
        const items = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                identityKey: data.identityKey || doc.id,
                role: normalizeRole(data.role || 'pending')
            };
        });

        return ok(res, { items });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const payload = {
            identityKey,
            discordId: req.body?.discordId || String(identityKey).replace(/^discord:/, ''),
            displayName: req.body?.displayName || '',
            role: normalizeRole(req.body?.role || 'pending'),
            manualAccuracy: req.body?.manualAccuracy !== undefined ? Number(req.body.manualAccuracy) : null,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        const id = safeDocId(identityKey);
        await db.collection('roleCache').doc(id).set(payload, { merge: true });
        await addAudit(db, 'role_cache_updated', actor, payload);

        return ok(res, { item: { id, ...payload } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.query.identityKey || req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const id = safeDocId(identityKey);
        await db.collection('roleCache').doc(id).delete();
        await addAudit(db, 'role_cache_deleted', actor, { identityKey });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRolePolicy(req, res, db) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_VIEW);

        const doc = await db.collection('rolePolicy').doc('settings').get();
        const policy = doc.exists ? doc.data() : null;

        return ok(res, { policy });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
        const actor = await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_UPDATE);
        const policy = req.body?.policy;

        if (!policy || typeof policy !== 'object') {
            return badRequest(res, 'POLICY_REQUIRED');
        }

        const payload = {
            ...policy,
            updatedBy: actor.uid,
            updatedAt: new Date().toISOString()
        };

        await db.collection('rolePolicy').doc('settings').set(payload, { merge: true });
        await addAudit(db, 'role_policy_updated', actor, { keys: Object.keys(policy) });

        return ok(res, { policy: payload });
    }

    res.setHeader('Allow', 'GET,PATCH,POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

// SECTION: DISCORD_BOT_DASHBOARD
// PURPOSE: Handles get/set guild configurations, automod, logging, welcome modules etc.
async function handleDiscordBotDashboard(req, res, db) {
    const guildId = String(req.query?.guildId || req.body?.guildId || '').trim();
    if (!guildId) return badRequest(res, 'GUILD_ID_REQUIRED');

    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.DISCORD_BOT_VIEW || 'discord_bot:view');

        const moduleDoc = await db.collection('guildModuleConfigs').doc(guildId).get();
        const mainDoc = await db.collection('guildConfigs').doc(guildId).get();

        const configs = {
            moderation: {},
            automod: {},
            logging: {},
            welcome: {},
            permissions: {},
            levels: {},
            settings: {}
        };

        if (moduleDoc.exists) {
            Object.assign(configs, moduleDoc.data());
        }
        if (mainDoc.exists) {
            configs.settings = mainDoc.data();
        }

        return ok(res, { configs });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.DISCORD_BOT_UPDATE || 'discord_bot:update');
        const configs = req.body?.configs;
        if (!configs || typeof configs !== 'object') {
            return badRequest(res, 'CONFIGS_REQUIRED');
        }

        const settings = configs.settings || {};
        delete configs.settings;

        await db.collection('guildModuleConfigs').doc(guildId).set(configs, { merge: true });
        await db.collection('guildConfigs').doc(guildId).set(settings, { merge: true });

        await addAudit(db, 'discord_bot_settings_updated', actor, { guildId });

        return ok(res, { success: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleDiscordBotAction(req, res, db) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const actor = await requirePermission(req, PERMISSIONS.DISCORD_BOT_UPDATE || 'discord_bot:update');
    const guildId = String(req.body?.guildId || '').trim();
    const action = String(req.body?.action || '').trim();
    const payload = req.body?.payload || {};

    if (!guildId) return badRequest(res, 'GUILD_ID_REQUIRED');
    if (!action) return badRequest(res, 'ACTION_REQUIRED');

    if (action === 'reset_config') {
        await db.collection('guildModuleConfigs').doc(guildId).delete();
        await db.collection('guildConfigs').doc(guildId).delete();
    } else if (action === 'test_welcome') {
        // Trigger a test log case document to send to Discord Bot via Firestore listeners
        await db.collection('cases').add({
            caseId: Math.floor(Math.random() * 9000) + 1000,
            isTest: true,
            authorName: actor.email || 'Admin',
            reason: payload.message || 'Lutheus Karşılama Entegrasyon Testi',
            scrapedAt: new Date().toISOString()
        });
    }

    await addAudit(db, `discord_bot_action:${action}`, actor, { guildId, payload });

    return ok(res, { success: true });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const db = getDb();
        const route = getRoute(req);

        if (route === 'audit-logs') return handleAuditLogs(req, res, db);
        if (route === 'google-allowlist') return handleGoogleAllowlist(req, res, db);
        if (route === 'role-cache') return handleRoleCache(req, res, db);
        if (route === 'role-policy') return handleRolePolicy(req, res, db);
        if (route === 'discord-bot-dashboard') return handleDiscordBotDashboard(req, res, db);
        if (route === 'discord-bot-action') return handleDiscordBotAction(req, res, db);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', route });
    } catch (error) {
        if (error.statusCode === 403) return forbidden(res);
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
