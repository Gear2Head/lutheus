const { supabase } = require('./supabaseClient');
const { normalizeRole, isOwnerIdentity, hasPermission } = require('./roles');
const jwt = require('jsonwebtoken');

// SECTION: SERVER_AUTH
// PURPOSE: Handles server-side identity verification, allowance checks, and custom role mappings using Supabase.

// Validate that SUPABASE_JWT_SECRET is set at startup time.
// If missing, jwt.verify will silently fail for every request → silent 401 cascade.
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[serverAuth] SUPABASE_JWT_SECRET is required. ' +
    'Without it every JWT verification will fail and all admin API calls will return 401. ' +
    'Find the value in Supabase Dashboard → Settings → API → JWT Secret, ' +
    'then add it to Vercel Dashboard → Settings → Environment Variables.'
  );
}

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
        decoded.user_metadata?.custom_claims?.discordId,
        decoded.app_metadata?.custom_claims?.discordId,
        decoded.app_metadata?.discordId,
        decoded.firebase?.identities?.['discord.com']?.[0],
        String(decoded.uid || '').startsWith('discord:') ? String(decoded.uid).replace(/^discord:/, '') : null,
        String(decoded.sub || '').startsWith('discord:') ? String(decoded.sub).replace(/^discord:/, '') : null,
        // sub may be the raw Discord snowflake (set in callback.js / exchange.js)
        /^\d{17,20}$/.test(String(decoded.sub || '')) ? String(decoded.sub) : null
    ].filter(Boolean);

    return candidates.find((value) => /^\d{17,20}$/.test(String(value))) || '';
}

function extractAppRole(decoded) {
    return normalizeRole(
        decoded.user_metadata?.custom_claims?.role
        || decoded.app_metadata?.custom_claims?.role
        || decoded.app_metadata?.role
        || 'pending'
    );
}

async function maybeSingleSafe(builder, source) {
    try {
        const { data, error } = await builder.maybeSingle();
        if (error) {
            console.warn(`[serverAuth] ${source} lookup failed:`, error.message || error);
            return null;
        }
        return data || null;
    } catch (err) {
        console.warn(`[serverAuth] ${source} lookup threw exception:`, err.message || err);
        return null;
    }
}

async function resolveActorFromToken(req) {
    const token = getBearerToken(req);
    if (!token) {
        throw Object.assign(new Error('AUTH_MISSING_SESSION'), { statusCode: 401, code: 'AUTH_MISSING_SESSION' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
        const isExpired = jwtError.name === 'TokenExpiredError';
        const code = isExpired ? 'AUTH_EXPIRED_SESSION' : 'AUTH_INVALID_SESSION';
        throw Object.assign(new Error(code), { statusCode: 401, code });
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

    if (!role) {
        const claimRole = extractAppRole(decoded);
        if (claimRole !== 'pending') {
            role = claimRole;
            source = 'jwtCustomClaims';
        }
    }

    role = normalizeRole(role || 'pending');

    console.info('[serverAuth.resolveActorFromToken]', {
        uid: uid ? uid.slice(0, 8) + '...' : null,
        hasDiscordId: Boolean(discordId),
        hasEmail: Boolean(email),
        role,
        source
    });

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
        throw Object.assign(new Error('AUTH_BLOCKED'), { statusCode: 403, code: 'AUTH_BLOCKED' });
    }
    return actor;
}

async function requirePermission(req, permission) {
    const actor = await requireUser(req);

    if (!hasPermission(actor.role, permission)) {
        // Distinguish: user authenticated but wrong role vs truly missing
        const code = actor.role === 'pending'
            ? 'AUTH_STAFF_NOT_FOUND'
            : 'AUTH_FORBIDDEN_ROLE';

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
        } catch (_auditError) {
            // ignore audit log errors — do not block the response
        }

        throw Object.assign(new Error(code), {
            statusCode: 403,
            code,
            message: code === 'AUTH_STAFF_NOT_FOUND'
                ? 'Bu Discord hesabının admin panel yetkisi yok.'
                : 'Bu işlem için yeterli yetkiniz yok.'
        });
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
