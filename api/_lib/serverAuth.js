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

    // SECTION: DB_ACCESS_STATUS_CHECK
    // PURPOSE: DB access_status and is_active_staff are verified BEFORE JWT claim fallback.
    // This prevents pending/rejected users with a stale JWT from gaining elevated access.
    let dbRowFound = false;

    // 3. roleCache check — requires active=true AND access_status=approved on staff_profiles
    if (!role && discordId) {
        const roleRow = await maybeSingleSafe(supabase
            .from('role_cache')
            .select('staff_rank, active, discord_id')
            .eq('discord_id', discordId)
            .eq('active', true), 'role_cache');

        if (roleRow?.staff_rank) {
            dbRowFound = true;
            // Verify access_status on staff_profiles before granting role from cache
            const profileCheck = await maybeSingleSafe(supabase
                .from('staff_profiles')
                .select('access_status, is_active_staff')
                .eq('discord_id', discordId), 'staff_profiles_access_check');

            if (profileCheck?.access_status === 'approved' && profileCheck?.is_active_staff === true) {
                role = roleRow.staff_rank;
                source = 'roleCache';
            } else if (roleRow.staff_rank === 'blocked' || roleRow.staff_rank === 'eski_yetkili') {
                role = roleRow.staff_rank;
                source = 'roleCache_blocked';
            }
            // else: access_status not approved — fall through, do not grant role
        }
    }

    // 4. staff_profiles check — requires is_active_staff=true AND access_status=approved
    if (!role && discordId) {
        const profileRow = await maybeSingleSafe(supabase
            .from('staff_profiles')
            .select('staff_rank, is_active_staff, access_status')
            .eq('discord_id', discordId), 'staff_profiles');

        if (profileRow) {
            dbRowFound = true;
            if (profileRow.staff_rank === 'blocked' || profileRow.staff_rank === 'eski_yetkili') {
                role = profileRow.staff_rank;
                source = 'staff_profiles';
            } else if (profileRow.is_active_staff === true && profileRow.access_status === 'approved' && profileRow.staff_rank) {
                role = profileRow.staff_rank;
                source = 'staff_profiles';
            }
            // else: access_status not approved — fall through to pending
        }
    }

    // 5. JWT claim fallback — ONLY if no DB row was found at all (offline/first-time bootstrap edge case)
    if (!role && !dbRowFound) {
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
