const { supabase } = require('./supabaseClient');
const { normalizeRole, isOwnerIdentity, hasPermission } = require('./roles');
const jwt = require('jsonwebtoken');

// SECTION: SERVER_AUTH
// PURPOSE: Handles server-side identity verification, allowance checks, and custom role mappings using Supabase.

function safeDocId(value) {
    return String(value || 'unknown').trim().toLowerCase().replace(/\//g, '_');
}

function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

function extractDiscordId(decoded) {
    const candidates = [
        decoded.discordId,
        decoded.user_metadata?.discordId,
        decoded.firebase?.identities?.['discord.com']?.[0],
        String(decoded.uid || '').startsWith('discord:') ? String(decoded.uid).replace(/^discord:/, '') : null,
        String(decoded.sub || '').startsWith('discord:') ? String(decoded.sub).replace(/^discord:/, '') : null
    ].filter(Boolean);

    return candidates.find((value) => /^\d{17,20}$/.test(String(value))) || '';
}

async function maybeSingleSafe(builder, source) {
    const { data, error } = await builder.maybeSingle();
    if (error) {
        console.warn(`[serverAuth] ${source} lookup failed:`, error.message || error);
        return null;
    }
    return data || null;
}

async function resolveActorFromToken(req) {
    const token = getBearerToken(req);
    if (!token) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { statusCode: 401 });
    }

    // Verify JWT using SUPABASE_JWT_SECRET (custom tokens signed by exchange endpoints)
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-key-with-at-least-32-characters-long';
    let decoded;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
        throw Object.assign(new Error('AUTH_REQUIRED'), { statusCode: 401 });
    }

    const uid = decoded.sub || decoded.uid || '';
    const email = String(decoded.email || decoded.user_metadata?.email || '').trim().toLowerCase();
    const discordId = extractDiscordId(decoded);


    let role = null;
    let source = 'none';

    if (isOwnerIdentity({ email, discordId })) {
        role = 'kurucu';
        source = 'ownerIdentity';
    }

    // 2. googleAllowlist check
    if (!role && email) {
        const allowRow = await maybeSingleSafe(supabase
            .from('google_allowlist')
            .select('*')
            .eq('email', email)
            .eq('active', true), 'google_allowlist');

        if (allowRow?.dashboard_access_role) {
            role = allowRow.dashboard_access_role;
            source = 'googleAllowlist';
        }
    }

    // 3. roleCache check
    if (!role && discordId) {
        const roleRow = await maybeSingleSafe(supabase
            .from('role_cache')
            .select('*')
            .eq('discord_id', discordId)
            .eq('active', true), 'role_cache');

        if (roleRow?.staff_rank) {
            role = roleRow.staff_rank;
            source = 'roleCache';
        }
    }

    // 4. staff_profiles check
    if (!role && discordId) {
        const profileRow = await maybeSingleSafe(supabase
            .from('staff_profiles')
            .select('*')
            .eq('discord_id', discordId)
            .eq('is_active_staff', true), 'staff_profiles');

        if (profileRow?.staff_rank) {
            role = profileRow.staff_rank;
            source = 'staff_profiles';
        }
    }

    role = normalizeRole(role || 'pending');

    return {
        uid,
        email,
        discordId,
        role,
        roleSource: source
    };
}

async function requireUser(req) {
    const actor = await resolveActorFromToken(req);
    if (actor.role === 'blocked') {
        throw Object.assign(new Error('AUTH_BLOCKED'), { statusCode: 403 });
    }
    return actor;
}

async function requirePermission(req, permission) {
    const actor = await requireUser(req);

    if (!hasPermission(actor.role, permission)) {
        try {
            await supabase.from('audit_logs').insert([{
                action: 'unauthorized_access_attempt',
                target_type: 'api',
                actor_email: actor.email || null,
                actor_discord_id: actor.discordId || null,
                metadata: {
                    resource: req.url || 'api',
                    permission: permission,
                    uid: actor.uid,
                    role: actor.role,
                    roleSource: actor.roleSource,
                    method: req.method,
                    path: req.url,
                    userAgent: req.headers['user-agent'] || null
                }
            }]);
        } catch (auditError) {
            // ignore database audit log errors to prevent blocking the response
        }

        throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
    }

    return actor;
}

module.exports = {
    requireUser,
    requirePermission,
    resolveActorFromToken,
    extractDiscordId,
    safeDocId
};
