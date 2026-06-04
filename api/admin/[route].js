const { supabase } = require('../_lib/supabaseClient');
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
    const normalized = String(route || '').replace(/^\/+|\/+$/g, '');
    if (normalized) return normalized;
    const match = String(req.url || '').match(/\/api\/admin\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

const DEFAULT_ROLE_CONFIG = Object.freeze([
    { role_key: 'kurucu', role_label: 'Kurucu', role_order: 0, permission_group: 'owner', permission_level: 100, is_management: true, visible: true, color_hex: '#7f1d1d' },
    { role_key: 'admin', role_label: 'Admin', role_order: 1, permission_group: 'admin', permission_level: 100, is_management: true, visible: true, color_hex: '#b91c1c' },
    { role_key: 'yonetici', role_label: 'Yonetici', role_order: 2, permission_group: 'management', permission_level: 100, is_management: true, visible: true, color_hex: '#dc2626' },
    { role_key: 'genel_sorumlu', role_label: 'Genel Sorumlu', role_order: 3, permission_group: 'management', permission_level: 100, is_management: true, visible: true, color_hex: '#ea580c' },
    { role_key: 'discord_yoneticisi', role_label: 'Discord Yoneticisi', role_order: 4, permission_group: 'management', permission_level: 100, is_management: true, visible: true, color_hex: '#db2777' },
    { role_key: 'senior_moderator', role_label: 'Senior Moderator', role_order: 5, permission_group: 'management', permission_level: 100, is_management: true, visible: true, color_hex: '#3498db' },
    { role_key: 'kidemli_discord_moderatoru', role_label: 'Kidemli Discord Moderatoru', role_order: 6, permission_group: 'management', permission_level: 100, is_management: true, visible: true, color_hex: '#c2410c' },
    { role_key: 'discord_moderatoru', role_label: 'Discord Moderatoru', role_order: 6, permission_group: 'moderation', permission_level: 50, is_management: false, visible: true, color_hex: '#fb923c' },
    { role_key: 'discord_destek_ekibi', role_label: 'Discord Destek Ekibi', role_order: 7, permission_group: 'support', permission_level: 25, is_management: false, visible: true, color_hex: '#be185d' },
    { role_key: 'viewer', role_label: 'Viewer', role_order: 8, permission_group: 'viewer', permission_level: 10, is_management: false, visible: true, color_hex: '#64748b' },
    { role_key: 'pending', role_label: 'Beklemede', role_order: 98, permission_group: 'pending', permission_level: 0, is_management: false, visible: false, color_hex: '#71717a' },
    { role_key: 'blocked', role_label: 'Engelli', role_order: 99, permission_group: 'blocked', permission_level: -1, is_management: false, visible: false, color_hex: '#52525b' }
]);

const SEEDED_ROLE_CACHE = Object.freeze([
    { discord_id: '758769576778661989', staff_rank: 'kurucu', active: true, source: 'lutheus-owner', raw_payload: { displayName: 'Gear_Head' } }
]);


const OWNER_ALLOWLIST = Object.freeze([
    { id: 'gearheadd0@gmail.com', email: 'gearheadd0@gmail.com', allowed: true, role: 'kurucu' }
]);

function roleConfigDefaults(role) {
    return DEFAULT_ROLE_CONFIG.find((item) => item.role_key === normalizeRole(role)) || DEFAULT_ROLE_CONFIG.find((item) => item.role_key === 'pending');
}

async function listRoleConfigRows() {
    const { data: rows, error } = await supabase
        .from('staff_role_config')
        .select('*')
        .order('role_order', { ascending: true });
    if (error) {
        console.warn('[admin] staff_role_config read failed:', error.message || error);
        return DEFAULT_ROLE_CONFIG;
    }
    return rows?.length ? rows : DEFAULT_ROLE_CONFIG;
}

function normalizeRoleConfigRow(row) {
    const roleKey = normalizeRole(row.role_key || row.role_name || row.role || row.name);
    const defaults = roleConfigDefaults(roleKey);
    return {
        roleKey,
        roleName: roleKey,
        roleLabel: row.role_label || row.role_name || defaults.role_label,
        label: row.role_label || row.role_name || defaults.role_label,
        roleOrder: Number(row.role_order ?? defaults.role_order),
        permissionGroup: row.permission_group || defaults.permission_group,
        permissionLevel: Number(row.permission_level ?? defaults.permission_level),
        isManagement: row.is_management ?? defaults.is_management,
        visible: row.visible !== false,
        colorHex: row.color_hex || defaults.color_hex,
        updatedAt: row.updated_at || null
    };
}

function profilePermissionForRole(role) {
    const defaults = roleConfigDefaults(role);
    return {
        permission_group: defaults.permission_group,
        permission_level: defaults.permission_level
    };
}

function mapRoleCacheRow(row) {
    const payload = row.raw_payload || {};
    return {
        id: `discord:${row.discord_id}`,
        identityKey: `discord:${row.discord_id}`,
        discordId: row.discord_id,
        displayName: row.display_name || payload.displayName || payload.name || `User ${row.discord_id}`,
        avatar: row.avatar_url || payload.avatar || payload.avatarUrl || null,
        role: normalizeRole(row.staff_rank || 'pending'),
        isActiveStaff: row.is_active_staff !== false && row.active !== false,
        source: row.source || payload.source || 'supabase',
        permissionGroup: row.permission_group || null,
        permissionLevel: row.permission_level ?? null,
        updatedAt: row.updated_at || row.last_synced_at || null
    };
}

function seededStaffProfiles() {
    return SEEDED_ROLE_CACHE.map((row) => ({
        id: row.discord_id,
        discordId: row.discord_id,
        discordUserId: row.discord_id,
        sapphireAuthorId: row.discord_id,
        email: row.discord_id === '758769576778661989' ? 'gearheadd0@gmail.com' : null,
        displayName: row.raw_payload.displayName,
        name: row.raw_payload.displayName,
        username: null,
        avatar: null,
        avatarUrl: null,
        role: normalizeRole(row.staff_rank),
        isActiveStaff: row.active !== false,
        permissionGroup: profilePermissionForRole(row.staff_rank).permission_group,
        permissionLevel: profilePermissionForRole(row.staff_rank).permission_level,
        source: row.source,
        rawPayload: row.raw_payload,
        updatedAt: null,
        lastSeen: null
    }));
}

async function addAudit(action, actor, details = {}) {
    try {
        await supabase.from('audit_logs').insert([{
            action,
            actor_user_id: actor?.uid || null,
            actor_email: actor?.email || null,
            actor_discord_id: actor?.discordId || null,
            target_type: 'admin',
            metadata: details
        }]);
    } catch (_auditError) {
        return null;
    }
    return null;
}

async function handleAuditLogs(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    await requirePermission(req, PERMISSIONS.AUDIT_LOGS_VIEW);

    const { data: rows, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) return serverError(res, error);

    const items = (rows || []).map((row) => ({
        id: row.id,
        action: row.action,
        actorUid: row.actor_user_id,
        actorRole: row.metadata?.role || null,
        details: row.metadata,
        createdAt: row.created_at
    }));
    return ok(res, { items });
}

async function handleGoogleAllowlist(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_VIEW);

        const { data: rows, error } = await supabase.from('google_allowlist').select('*').limit(200);
        if (error) {
            console.warn('[admin] google_allowlist read failed:', error.message || error);
            return ok(res, { items: OWNER_ALLOWLIST, warning: 'GOOGLE_ALLOWLIST_UNAVAILABLE' });
        }

        const items = (rows || []).map((row) => ({
            id: row.email,
            email: row.email,
            allowed: row.active,
            role: normalizeRole(row.dashboard_access_role || 'viewer')
        }));

        return ok(res, { items: [...OWNER_ALLOWLIST, ...items.filter((item) => item.email !== 'gearheadd0@gmail.com')] });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const payload = {
            email,
            dashboard_access_role: normalizeRole(req.body?.role || 'viewer'),
            active: req.body?.allowed !== false,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('google_allowlist').upsert([payload], { onConflict: 'email' });
        if (error) return serverError(res, error);

        await addAudit('google_allowlist_updated', actor, payload);

        return ok(res, { item: { id: email, email, allowed: payload.active, role: payload.dashboard_access_role } });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.GOOGLE_ALLOWLIST_UPDATE);
        const email = normalizeEmail(req.query.email || req.body?.email);

        if (!email) return badRequest(res, 'EMAIL_REQUIRED');

        const { error } = await supabase.from('google_allowlist').delete().eq('email', email);
        if (error) return serverError(res, error);

        await addAudit('google_allowlist_deleted', actor, { email });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRoleCache(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        let { data: rows, error } = await supabase.from('role_cache').select('*').limit(500);
        if (error) {
            console.warn('[admin] role_cache read failed:', error.message || error);
            return ok(res, { items: SEEDED_ROLE_CACHE.map(mapRoleCacheRow), warning: 'ROLE_CACHE_UNAVAILABLE' });
        }

        if (!rows || rows.length === 0) {
            const seedPayloads = SEEDED_ROLE_CACHE.map((row) => ({ ...row, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
            const staffPayloads = seedPayloads.map(p => ({
                discord_id: p.discord_id,
                display_name: p.raw_payload.displayName,
                permission_group: profilePermissionForRole(p.staff_rank).permission_group,
                permission_level: profilePermissionForRole(p.staff_rank).permission_level,
                staff_rank: p.staff_rank,
                is_active_staff: true,
                raw_payload: p.raw_payload,
                updated_at: new Date().toISOString()
            }));

            const { error: seedStaffError } = await supabase.from('staff_profiles').upsert(staffPayloads, { onConflict: 'discord_id' });
            const { error: seedRoleError } = seedStaffError
                ? { error: seedStaffError }
                : await supabase.from('role_cache').upsert(seedPayloads, { onConflict: 'discord_id' });
            if (seedStaffError || seedRoleError) {
                console.warn('[admin] role cache seed failed:', seedStaffError?.message || seedRoleError?.message || seedStaffError || seedRoleError);
                return ok(res, { items: seedPayloads.map(mapRoleCacheRow), warning: 'ROLE_CACHE_SEED_FALLBACK' });
            }

            const { data: reRows } = await supabase.from('role_cache').select('*').limit(500);
            rows = reRows || [];
        }

        const ids = (rows || []).map((row) => row.discord_id).filter(Boolean);
        const { data: profiles, error: profileError } = ids.length
            ? await supabase.from('staff_profiles').select('*').in('discord_id', ids)
            : { data: [], error: null };
        if (profileError) console.warn('[admin] staff profile join failed:', profileError.message || profileError);
        const profileById = new Map((profiles || []).map((profile) => [profile.discord_id, profile]));
        const items = (rows || []).map((row) => mapRoleCacheRow({ ...row, ...(profileById.get(row.discord_id) || {}), active: row.active, raw_payload: row.raw_payload, source: row.source, last_synced_at: row.last_synced_at }));
        const existingIds = new Set(items.map((item) => item.discordId).filter(Boolean));
        const seeded = SEEDED_ROLE_CACHE.filter((row) => !existingIds.has(row.discord_id)).map(mapRoleCacheRow);

        return ok(res, { items: [...items, ...seeded] });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const discordId = req.body?.discordId || String(identityKey).replace(/^discord:/, '');
        const role = normalizeRole(req.body?.role || 'pending');
        const active = req.body?.isActiveStaff !== undefined ? req.body.isActiveStaff !== false : role !== 'blocked';
        const permission = profilePermissionForRole(role);

        const payload = {
            discord_id: discordId,
            staff_rank: role,
            active,
            source: req.body?.source || 'manual_or_cache',
            raw_payload: {
                identityKey,
                discordId,
                displayName: req.body?.displayName || '',
                username: req.body?.username || null,
                avatar: req.body?.avatar || req.body?.avatarUrl || null,
                role,
                isActiveStaff: active,
                manualAccuracy: req.body?.manualAccuracy !== undefined ? Number(req.body.manualAccuracy) : null,
                notes: req.body?.notes || null,
                updatedAt: new Date().toISOString()
            },
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Ensure staff_profiles entry exists to satisfy the foreign key constraint in role_cache
        const staffPayload = {
            discord_id: discordId,
            display_name: req.body?.displayName || `User ${discordId}`,
            username: req.body?.username || null,
            avatar_url: req.body?.avatar || req.body?.avatarUrl || null,
            permission_group: req.body?.permissionGroup || permission.permission_group,
            permission_level: req.body?.permissionLevel !== undefined ? Number(req.body.permissionLevel) : permission.permission_level,
            staff_rank: role,
            is_active_staff: active && role !== 'pending',
            removal_reason: active ? null : (req.body?.removalReason || 'manual_inactive'),
            removed_from_staff_at: active ? null : new Date().toISOString(),
            raw_payload: payload.raw_payload,
            updated_at: new Date().toISOString()
        };
        let warning = null;
        const { error: staffError } = await supabase.from('staff_profiles').upsert([staffPayload], { onConflict: 'discord_id' });
        if (staffError) {
            console.warn('[admin] staff profile mirror failed:', staffError.message || staffError);
            warning = 'STAFF_PROFILE_MIRROR_FAILED';
        }

        const { error } = await supabase.from('role_cache').upsert([payload], { onConflict: 'discord_id' });
        if (error) {
            console.warn('[admin] role cache upsert failed:', error.message || error);
            return ok(res, { item: mapRoleCacheRow({ ...payload, ...staffPayload, active }), warning: 'ROLE_CACHE_WRITE_FALLBACK' });
        }

        await addAudit('role_cache_updated', actor, payload.raw_payload);

        return ok(res, { item: mapRoleCacheRow({ ...payload, ...staffPayload, active }), ...(warning ? { warning } : {}) });
    }

    if (req.method === 'DELETE') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const identityKey = normalizeIdentityKey(req.query.identityKey || req.body?.identityKey);

        if (!identityKey) return badRequest(res, 'IDENTITY_KEY_REQUIRED');

        const discordId = String(identityKey).replace(/^discord:/, '');
        const { error } = await supabase.from('role_cache').delete().eq('discord_id', discordId);
        if (error) return serverError(res, error);

        const { error: profileError } = await supabase.from('staff_profiles').delete().eq('discord_id', discordId);
        if (profileError) {
            console.warn('[admin] staff profile delete error:', profileError.message || profileError);
        }

        await addAudit('role_cache_deleted', actor, { identityKey });

        return ok(res, { deleted: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleRolePolicy(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_VIEW);

        const { data: row, error } = await supabase.from('app_settings').select('*').eq('key', 'settings').maybeSingle();
        if (error) {
            console.warn('[admin] role policy read failed:', error.message || error);
            return ok(res, { policy: {}, warning: 'ROLE_POLICY_UNAVAILABLE' });
        }

        const policy = row ? row.value : null;
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

        const { error } = await supabase.from('app_settings').upsert([{ key: 'settings', value: payload }], { onConflict: 'key' });
        if (error) return serverError(res, error);

        await addAudit('role_policy_updated', actor, { keys: Object.keys(policy) });

        return ok(res, { policy: payload });
    }

    res.setHeader('Allow', 'GET,PATCH,POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleStaffProfiles(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);

        const { data: rows, error } = await supabase
            .from('staff_profiles')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(500);
        if (error) {
            console.warn('[admin] staff_profiles read failed:', error.message || error);
            return ok(res, { items: seededStaffProfiles(), warning: 'STAFF_PROFILES_UNAVAILABLE' });
        }

        const items = (rows || []).map((row) => ({
            id: row.discord_id || row.id,
            discordId: row.discord_id,
            discordUserId: row.discord_id,
            sapphireAuthorId: row.discord_id,
            email: row.email,
            displayName: row.display_name || row.username || row.raw_payload?.displayName || row.raw_payload?.name || `User ${row.discord_id}`,
            name: row.display_name || row.username || row.raw_payload?.displayName || row.raw_payload?.name || `User ${row.discord_id}`,
            username: row.username,
            avatar: row.avatar_url || row.raw_payload?.avatar || row.raw_payload?.avatarUrl || null,
            avatarUrl: row.avatar_url || row.raw_payload?.avatar || row.raw_payload?.avatarUrl || null,
            role: normalizeRole(row.staff_rank || row.raw_payload?.role || 'pending'),
            isActiveStaff: row.is_active_staff !== false,
            accessStatus: row.access_status || 'pending',
            permissionGroup: row.permission_group,
            permissionLevel: row.permission_level,
            removalReason: row.removal_reason || null,
            removedFromStaffAt: row.removed_from_staff_at || null,
            rawPayload: row.raw_payload || {},
            source: row.permission_group || row.raw_payload?.source || 'supabase',
            updatedAt: row.updated_at,
            lastSeen: row.last_seen_at
        }));

        const existingIds = new Set(items.map((item) => item.discordId).filter(Boolean));
        const seeded = seededStaffProfiles().filter((item) => !existingIds.has(item.discordId));
        return ok(res, { items: [...items, ...seeded] });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const profiles = Array.isArray(req.body?.profiles) ? req.body.profiles : [req.body || {}];
        const rows = profiles
            .map((profile) => {
                const discordId = String(profile.discordId || profile.discordUserId || profile.id || '').replace(/^discord:/, '').trim();
                if (!/^\d{17,20}$/.test(discordId)) return null;
                const role = profile.role ? normalizeRole(profile.role) : normalizeRole(profile.staffRank || 'pending');
                const permission = profilePermissionForRole(role);
                const active = profile.isActiveStaff !== false && role !== 'blocked';
                return {
                    discord_id: discordId,
                    email: profile.email || null,
                    display_name: profile.displayName || profile.name || profile.username || null,
                    username: profile.username || null,
                    avatar_url: profile.avatar || profile.avatarUrl || null,
                    staff_rank: role,
                    permission_group: profile.permissionGroup || profile.source || permission.permission_group,
                    permission_level: profile.permissionLevel !== undefined ? Number(profile.permissionLevel) : permission.permission_level,
                    is_active_staff: active,
                    removed_from_staff_at: active ? null : (profile.removedFromStaffAt || new Date().toISOString()),
                    removal_reason: active ? null : (profile.removalReason || 'manual_inactive'),
                    last_seen_at: profile.lastSeen || profile.updatedAt || new Date().toISOString(),
                    raw_payload: profile,
                    updated_at: new Date().toISOString()
                };
            })
            .filter(Boolean);

        if (!rows.length) return badRequest(res, 'STAFF_PROFILES_REQUIRED');

        let warning = null;
        const { error } = await supabase.from('staff_profiles').upsert(rows, { onConflict: 'discord_id' });
        if (error) {
            console.warn('[admin] staff_profiles write failed:', error.message || error);
            warning = 'STAFF_PROFILES_WRITE_FALLBACK';
        }

        const roleRows = rows
            .filter((row) => row.discord_id && row.staff_rank)
            .map((row) => ({
                discord_id: row.discord_id,
                staff_rank: row.staff_rank,
                rank_color: row.rank_color || null,
                source: row.permission_group || 'staff_profiles',
                active: row.is_active_staff,
                raw_payload: row.raw_payload || {},
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
        if (roleRows.length) {
            const { error: roleError } = await supabase.from('role_cache').upsert(roleRows, { onConflict: 'discord_id' });
            if (roleError) console.warn('[admin] role_cache mirror failed:', roleError.message || roleError);
        }

        await addAudit('staff_profiles_upserted', actor, { count: rows.length, warning });
        return ok(res, { items: rows, ...(warning ? { warning } : {}) });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

async function handleStaffRoleConfig(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_VIEW);
        const rows = await listRoleConfigRows();
        return ok(res, { items: rows.map(normalizeRoleConfigRow) });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ASSIGN_ROLE);
        const incoming = Array.isArray(req.body?.roles) ? req.body.roles : [req.body || {}];
        const rows = incoming
            .map((role) => {
                const roleKey = normalizeRole(role.roleKey || role.role_key || role.roleName || role.role_name);
                if (!roleKey || roleKey === 'pending') return null;
                const defaults = roleConfigDefaults(roleKey);
                return {
                    role_key: roleKey,
                    role_label: role.roleLabel || role.role_label || role.label || defaults.role_label,
                    role_name: role.roleLabel || role.role_label || role.label || defaults.role_label,
                    role_order: Number(role.roleOrder ?? role.role_order ?? defaults.role_order),
                    permission_group: role.permissionGroup || role.permission_group || defaults.permission_group,
                    permission_level: Number(role.permissionLevel ?? role.permission_level ?? defaults.permission_level),
                    is_management: role.isManagement ?? role.is_management ?? defaults.is_management,
                    visible: role.visible !== false,
                    color_hex: role.colorHex || role.color_hex || defaults.color_hex,
                    updated_at: new Date().toISOString()
                };
            })
            .filter(Boolean);

        if (!rows.length) return badRequest(res, 'ROLE_CONFIG_REQUIRED');

        const { error } = await supabase.from('staff_role_config').upsert(rows, { onConflict: 'role_key' });
        if (error) return serverError(res, error);
        await addAudit('staff_role_config_updated', actor, { count: rows.length });
        return ok(res, { items: rows.map(normalizeRoleConfigRow) });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

// SECTION: DISCORD_BOT_DASHBOARD
// PURPOSE: Handles server lists, server configurations, automod, logging, welcome messages and manual testing.

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '';
const MANAGE_GUILD = 0x20;
const ADMINISTRATOR = 0x8;

function hasManageGuildPermission(guild = {}) {
    const permissions = Number(guild.permissions || 0);
    return guild.owner === true || (permissions & MANAGE_GUILD) !== 0 || (permissions & ADMINISTRATOR) !== 0;
}

function botGuildIconUrl(guild) {
    return guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(guild.id || 0) % 5}.png`;
}

async function assertManageableInstalledGuild(actor, guildId) {
    const [botGuilds, storedGuilds] = await Promise.all([
        fetchBotGuilds(),
        actor.discordId ? fetchUserDiscordGuilds(actor.discordId) : Promise.resolve([])
    ]);
    const installed = botGuilds.some((guild) => guild.id === guildId);
    if (!installed) {
        throw Object.assign(new Error('BOT_NOT_INSTALLED_IN_GUILD'), { statusCode: 403 });
    }
    const manageable = Array.isArray(storedGuilds)
        ? storedGuilds.some((guild) => guild.id === guildId && hasManageGuildPermission(guild))
        : false;
    if (!manageable) {
        throw Object.assign(new Error('GUILD_MANAGE_PERMISSION_REQUIRED'), { statusCode: 403 });
    }
}

let cachedBotGuilds = null;
let cachedBotGuildsAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch all guilds where bot is installed via bot token
async function fetchBotGuilds() {
    const now = Date.now();
    if (cachedBotGuilds && (now - cachedBotGuildsAt) < CACHE_TTL_MS) {
        return cachedBotGuilds;
    }

    try {
        const { data, error } = await supabase
            .from('bot_runtime_status')
            .select('guild_id');

        if (!error && data && data.length > 0) {
            const mapped = data.map((r) => ({ id: r.guild_id }));
            cachedBotGuilds = mapped;
            cachedBotGuildsAt = now;
            return mapped;
        }
    } catch (dbErr) {
        console.warn('fetchBotGuilds DB check failed, falling back to Discord API:', dbErr);
    }

    const token = BOT_TOKEN();
    if (!token) {
        console.warn('fetchBotGuilds: Both DISCORD_BOT_TOKEN and DISCORD_TOKEN are missing in process.env!');
        throw new Error('DISCORD_BOT_TOKEN_MISSING');
    }

    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bot ${token}` }
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Bot guilds fetch failed:', err);
        if (cachedBotGuilds) {
            console.warn('Using expired cachedBotGuilds as emergency fallback after Discord API error.');
            return cachedBotGuilds;
        }
        throw new Error('DISCORD_GUILDS_FETCH_FAILED');
    }

    const guilds = await res.json();
    cachedBotGuilds = guilds;
    cachedBotGuildsAt = now;
    return guilds;
}

// Fetch guild details (member count, icon, etc.)
async function fetchGuildDetails(guildId) {
    const token = BOT_TOKEN();
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${token}` }
    });
    if (!res.ok) return null;
    return res.json();
}

// Fetch user's guilds from Supabase (stored during OAuth)
async function fetchUserDiscordGuilds(discordId) {
    const { data: row } = await supabase
        .from('staff_profiles')
        .select('raw_payload')
        .eq('discord_id', discordId)
        .maybeSingle();
    if (!row) return null;
    return row.raw_payload?.discordGuilds || null;
}

// Fetch guild channels from Discord API
async function fetchGuildChannels(guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const channels = await res.json();
    return channels
        .filter(c => c.type === 0 || c.type === 5)
        .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id || null }));
}

// Fetch guild roles from Discord API
async function fetchGuildRoles(guildId) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const roles = await res.json();
    return roles
        .filter(r => r.id !== guildId)
        .map(r => ({
            id: r.id,
            name: r.name,
            color: r.color || 0,
            rawPosition: r.position || 0
        }));
}

// Fetch bot's slash commands for the guild
async function fetchBotCommands(guildId) {
    const appId = process.env.DISCORD_CLIENT_ID;
    if (!appId) return [];
    const res = await fetch(`${DISCORD_API}/applications/${appId}/guilds/${guildId}/commands`, {
        headers: { Authorization: `Bot ${BOT_TOKEN()}` }
    });
    if (!res.ok) return [];
    const cmds = await res.json();
    return cmds.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        category: 'moderation',
        cooldown: 3,
        enabled: true
    }));
}

function defaultConfigs(guildId = '') {
    return {
        guildId,
        language: "tr",
        timezone: "Europe/Istanbul",
        prefix: "!",
        dashboardAccessRole: "",
        dataRetentionDays: 30,
        logChannelId: '',
        alertChannelId: '',
        statsChannelId: '',
        modules: {
            autoModeration: false,
            moderation: false,
            socialNotifications: false,
            joinRoles: false,
            reactionRoles: false,
            welcomeMessages: false,
            roleConnections: false,
            logging: false
        },
        welcomeSettings: {
            channelId: "",
            welcomeMessage: "Sunucumuza hoş geldin {user}!",
            goodbyeMessage: "{user} sunucudan ayrıldı.",
            sendDm: false,
            embedEnabled: false
        },
        joinRolesSettings: {
            roles: [],
            delayedRoles: [],
            delaySeconds: 0
        },
        loggingSettings: {
            channelId: "",
            events: {
                messageDelete: true,
                messageEdit: true,
                memberJoin: true,
                memberLeave: true,
                memberBan: true,
                memberUnban: true,
                roleUpdate: false,
                channelUpdate: false
            }
        }
    };
}

function configFromRow(row, guildId) {
    if (!row) return defaultConfigs(guildId);
    return {
        ...defaultConfigs(guildId),
        guildId,
        language: row.language || 'tr',
        timezone: row.timezone || 'Europe/Istanbul',
        prefix: row.prefix || '!',
        dashboardAccessRole: row.dashboard_access_role_id || '',
        dataRetentionDays: Number(row.data_retention_days || 30),
        logChannelId: row.log_channel_id || '',
        alertChannelId: row.alert_channel_id || '',
        statsChannelId: row.stats_channel_id || '',
        modules: { ...defaultConfigs(guildId).modules, ...(row.modules || {}) },
        welcomeSettings: { ...defaultConfigs(guildId).welcomeSettings, ...(row.welcome_settings || {}) },
        joinRolesSettings: { ...defaultConfigs(guildId).joinRolesSettings, ...(row.join_roles_settings || {}) },
        loggingSettings: { ...defaultConfigs(guildId).loggingSettings, ...(row.logging_settings || {}) },
        commandSettings: row.command_settings || {},
        webhookSettings: row.webhook_settings || {},
        isActive: row.is_active !== false,
        updatedAt: row.updated_at || null
    };
}

function rowFromConfig(guildId, config, actor) {
    return {
        guild_id: guildId,
        log_channel_id: config.logChannelId || config.loggingSettings?.channelId || null,
        alert_channel_id: config.alertChannelId || null,
        stats_channel_id: config.statsChannelId || null,
        dashboard_access_role_id: config.dashboardAccessRole || null,
        timezone: config.timezone || 'Europe/Istanbul',
        language: config.language || 'tr',
        prefix: config.prefix || '!',
        data_retention_days: Number(config.dataRetentionDays || 30),
        modules: config.modules || {},
        welcome_settings: config.welcomeSettings || {},
        join_roles_settings: config.joinRolesSettings || {},
        logging_settings: config.loggingSettings || {},
        command_settings: config.commandSettings || {},
        webhook_settings: config.webhookSettings || {},
        is_active: config.isActive !== false,
        setup_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: actor.discordId || actor.uid || actor.email || null
    };
}

async function getBotGuildConfig(guildId) {
    const { data, error } = await supabase
        .from('bot_guild_config')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();
    if (error) throw error;
    return configFromRow(data, guildId);
}

async function insertBotAction({ guildId, action, actor, payload = {}, status = 'pending', result = {} }) {
    const { data, error } = await supabase
        .from('bot_action_audit')
        .insert([{
            guild_id: guildId,
            action,
            status,
            requested_by_discord_id: actor.discordId || null,
            requested_by_uid: actor.uid || null,
            payload,
            result,
            updated_at: new Date().toISOString(),
            processed_at: status === 'pending' ? null : new Date().toISOString()
        }])
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

async function fetchDashboardLiveData(guildId) {
    const [runtime, recentActions, caseCounts, invalidCases, auditLogs] = await Promise.all([
        supabase.from('bot_runtime_status').select('*').eq('guild_id', guildId).maybeSingle(),
        supabase.from('bot_action_audit').select('*').eq('guild_id', guildId).order('created_at', { ascending: false }).limit(20),
        supabase.from('sapphire_cases').select('case_id,cuk_verdict', { count: 'exact', head: true }).eq('guild_id', guildId),
        supabase.from('sapphire_cases').select('case_id,author_display_name,reason_raw,cuk_verdict,scraped_at').eq('guild_id', guildId).eq('cuk_verdict', 'invalid').order('scraped_at', { ascending: false }).limit(10),
        supabase.from('audit_logs').select('id,action,target_type,actor_discord_id,metadata,created_at').order('created_at', { ascending: false }).limit(20)
    ]);

    return {
        runtimeStatus: runtime.data || null,
        recentActions: recentActions.data || [],
        caseStats: {
            total: caseCounts.count || 0,
            invalidRecent: invalidCases.data || []
        },
        auditLogs: auditLogs.data || []
    };
}

async function sendDiscordMessage(channelId, content, embed = null) {
    const body = { content };
    if (embed) body.embeds = [embed];

    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${BOT_TOKEN()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`DISCORD_MESSAGE_FAILED: ${err}`);
    }
    return res.json();
}

async function handleDiscordBotGuilds(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'discord_bot:view');

        const botGuilds = await fetchBotGuilds();
        const botGuildIds = new Set(botGuilds.map(g => g.id));

        let userManageableGuilds = [];
        if (actor.discordId) {
            const storedGuilds = await fetchUserDiscordGuilds(actor.discordId);
            if (storedGuilds && Array.isArray(storedGuilds)) {
                userManageableGuilds = storedGuilds.filter(hasManageGuildPermission);
            }
        }

        const installedManageableGuildIds = userManageableGuilds.filter(g => botGuildIds.has(g.id)).map(g => g.id);
        const detailsList = await Promise.all(installedManageableGuildIds.map(id => fetchGuildDetails(id).catch(() => null)));
        const detailsMap = new Map(detailsList.filter(Boolean).map(g => [g.id, g]));
        const guilds = userManageableGuilds
            .filter(g => botGuildIds.has(g.id))
            .map(g => {
                const botG = detailsMap.get(g.id);
                return {
                    id: g.id,
                    name: botG?.name || g.name,
                    memberCount: botG?.approximate_member_count || botG?.member_count || 0,
                    botInstalled: true,
                    manageable: true,
                    permissions: String(g.permissions || '0'),
                    owner: Boolean(g.owner),
                    iconUrl: botGuildIconUrl(botG || g)
                };
            });

        return ok(res, { guilds });
    } catch (err) {
        console.error('[discord-bot-guilds]', err.message);
        return serverError(res, err);
    }
}

async function handleDiscordBotDashboard(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET,POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const guildId = String(req.query?.guildId || req.body?.guildId || '').trim();
    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
        return badRequest(res, 'INVALID_GUILD_ID');
    }

    try {
        if (req.method === 'GET') {
            const actor = await requirePermission(req, 'discord_bot:view');
            await assertManageableInstalledGuild(actor, guildId);

            const [config, channels, roles, commands, liveData] = await Promise.all([
                getBotGuildConfig(guildId),
                fetchGuildChannels(guildId),
                fetchGuildRoles(guildId),
                fetchBotCommands(guildId),
                fetchDashboardLiveData(guildId)
            ]);

            return ok(res, { config, channels, roles, commands, ...liveData });
        } else {
            const actor = await requirePermission(req, 'discord_bot:update');
            await assertManageableInstalledGuild(actor, guildId);
            const configs = req.body?.configs || req.body?.config || req.body;
            if (!configs || typeof configs !== 'object') {
                return badRequest(res, 'CONFIGS_REQUIRED');
            }

            const { error } = await supabase
                .from('bot_guild_config')
                .upsert([rowFromConfig(guildId, configs, actor)], { onConflict: 'guild_id' });
            if (error) throw error;

            await addAudit('bot_guild_config_updated', actor, { guildId });
            return ok(res, { success: true });
        }
    } catch (err) {
        console.error('[discord-bot-dashboard]', err.message);
        return serverError(res, err);
    }
}

async function handleDiscordBotAction(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    try {
        const actor = await requirePermission(req, 'discord_bot:update');
        const { guildId, action, payload = {} } = req.body || {};

        if (!guildId || !/^\d{17,20}$/.test(guildId)) {
            return badRequest(res, 'INVALID_GUILD_ID');
        }
        if (!action) {
            return badRequest(res, 'MISSING_ACTION');
        }

        await assertManageableInstalledGuild(actor, guildId);
        const configs = await getBotGuildConfig(guildId);

        if (action === 'test_welcome') {
            const channelId = configs?.welcomeSettings?.channelId;
            if (!channelId) return badRequest(res, 'WELCOME_CHANNEL_NOT_SET');
            const formatted = (configs?.welcomeSettings?.welcomeMessage || 'Hos geldin {user}!')
                .replace(/{user}/g, `<@${actor.discordId || '0'}>`)
                .replace(/{username}/g, 'TestUser')
                .replace(/{server}/g, 'Sunucu')
                .replace(/{memberCount}/g, '?');
            
            // 1. Send test welcome message to channel
            await sendDiscordMessage(channelId, configs?.welcomeSettings?.embedEnabled ? null : formatted, configs?.welcomeSettings?.embedEnabled ? {
                title: 'Lutheus Test Welcome',
                description: formatted,
                color: 0x9d7bfe
            } : null);

            // 2. Send "Bu kanal ayarlandı" status message to channel
            await sendDiscordMessage(channelId, 'Lutheus Ceza Rapor Sistemi: Bu kanal başarıyla ayarlandı ve aktif hale getirildi! 🚀');

            // 3. Send a test DM to the administrator
            let dmStatus = 'not_triggered';
            if (actor.discordId) {
                try {
                    const dmChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bot ${BOT_TOKEN()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ recipient_id: actor.discordId })
                    });
                    if (dmChannelRes.ok) {
                        const dmChannel = await dmChannelRes.json();
                        await sendDiscordMessage(dmChannel.id, `Lutheus Ceza Rapor Sistemi Test DM: DM gönderme sistemi başarıyla çalışıyor! 💬\n\nWelcome DM test message: ${formatted}`);
                        dmStatus = 'success';
                    } else {
                        const dmErr = await dmChannelRes.text();
                        console.warn('Failed to open DM channel:', dmErr);
                        dmStatus = `failed_open_channel: ${dmErr}`;
                    }
                } catch (dmErr) {
                    console.warn('test_welcome DM sending failed:', dmErr);
                    dmStatus = `error: ${dmErr.message || dmErr}`;
                }
            }

            const result = { ok: true, success: true, message: 'Welcome test messages and DM sent', dmStatus };
            await insertBotAction({ guildId, action, actor, payload, status: 'completed', result });
            await addAudit(`discord_bot_action:${action}`, actor, { guildId, payload });
            return ok(res, result);
        }

        if (action === 'test_alert') {
            const channelId = configs.alertChannelId || payload.channelId;
            if (!channelId) return badRequest(res, 'ALERT_CHANNEL_NOT_SET');
            await sendDiscordMessage(channelId, null, {
                title: 'Lutheus CUK Test Alert',
                description: 'Dashboard uzerinden gercek Discord kanalina test uyarisi gonderildi.',
                color: 0xef4444
            });
            const result = { ok: true, success: true, message: 'Alert test sent' };
            await insertBotAction({ guildId, action, actor, payload, status: 'completed', result });
            await addAudit(`discord_bot_action:${action}`, actor, { guildId, payload });
            return ok(res, result);
        }

        if (['force_sync', 'sync_commands', 'lockdown', 'unlockdown'].includes(action)) {
            const row = await insertBotAction({ guildId, action, actor, payload, status: 'pending' });
            const result = { ok: true, success: true, message: 'Action queued for bot runtime', actionId: row.id };
            await addAudit(`discord_bot_action:${action}`, actor, { guildId, payload });
            return ok(res, result);
        }

        if (action === 'reset_config') {
            await supabase.from('bot_guild_config').delete().eq('guild_id', guildId);
            const result = { ok: true, message: 'Config reset' };
            await addAudit(`discord_bot_action:${action}`, actor, { guildId, payload });
            return ok(res, result);
        }

        return badRequest(res, 'UNKNOWN_ACTION');
    } catch (err) {
        console.error('[discord-bot-action]', err.message);
        return serverError(res, err);
    }
}

const { normalizeCase } = require('../_lib/sapphireNormalize');

async function handleRepairDates(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const actor = await requirePermission(req, PERMISSIONS.SYSTEM_SETTINGS_UPDATE);

    // Fetch all cases
    const { data: cases, error } = await supabase
        .from('sapphire_cases')
        .select('*');

    if (error) return serverError(res, error);

    let repairedCount = 0;
    const updates = [];

    const now = new Date();
    const cutoff = new Date('2026-06-01');

    for (const c of cases || []) {
        const createdRaw = c.created_raw || '';
        let createdIso = c.created_at_sapphire;
        let needsUpdate = false;

        // If the date is parsed in the future, it is definitely a swapped date
        if (createdIso && new Date(createdIso) > cutoff) {
            const d = new Date(createdIso);
            const year = d.getFullYear();
            const month = d.getMonth() + 1; // 1-12
            const day = d.getDate(); // 1-31
            
            // Swap: month becomes day, day becomes month
            if (day >= 1 && day <= 12) {
                const repairedDate = new Date(year, day - 1, month, d.getHours(), d.getMinutes(), d.getSeconds());
                if (!isNaN(repairedDate.getTime())) {
                    createdIso = repairedDate.toISOString();
                    needsUpdate = true;
                }
            }
        }

        // Always check if duration_ms is null but duration_raw is present (historical cases fix!)
        let durationMs = c.duration_ms;
        let expiresAt = c.expires_at;
        let isPermanent = c.is_permanent;
        let isOpen = c.is_open;
        let isActive = c.is_active;

        // Re-normalize using the normalizer helper to heal duration and active state
        const mockItem = {
            caseId: c.case_id,
            userId: c.punished_user_discord_id,
            userName: c.punished_user_display_name,
            userAvatar: c.punished_user_avatar_url,
            authorId: c.author_discord_id,
            authorName: c.author_display_name,
            authorAvatar: c.author_avatar_url,
            type: c.type,
            reason: c.reason_raw,
            duration: c.duration_raw,
            createdRaw: c.created_raw,
            createdAt: createdIso,
            sourceUrl: c.case_url,
            isOpen: c.is_open,
            closedByDiscordId: c.closed_by_discord_id,
            closedAt: c.closed_at
        };

        const normalized = normalizeCase(mockItem, c.guild_id);
        
        if (normalized.durationMs !== c.duration_ms || normalized.isPermanent !== c.is_permanent || normalized.expiresAt !== c.expires_at || normalized.isOpen !== c.is_open || createdIso !== c.created_at_sapphire) {
            needsUpdate = true;
            durationMs = normalized.durationMs;
            isPermanent = normalized.isPermanent;
            expiresAt = normalized.expiresAt;
            isOpen = normalized.isOpen;
            isActive = normalized.isOpen; // align active status
        }

        if (needsUpdate) {
            updates.push({
                case_id: c.case_id,
                guild_id: c.guild_id,
                created_at_sapphire: createdIso,
                duration_ms: durationMs,
                is_permanent: isPermanent,
                expires_at: expiresAt,
                is_open: isOpen,
                is_active: isActive,
                updated_at: new Date().toISOString()
            });
            repairedCount++;
        }
    }

    if (updates.length > 0) {
        // Chunk updates in sizes of 100 to avoid request body size limits
        for (let i = 0; i < updates.length; i += 100) {
            const chunk = updates.slice(i, i + 100);
            const { error: upsertError } = await supabase
                .from('sapphire_cases')
                .upsert(chunk, { onConflict: 'guild_id,case_id' });
            if (upsertError) {
                console.error('[Repair] Failed to save chunk:', upsertError);
                return serverError(res, upsertError);
            }
        }
    }

    await addAudit('database_dates_and_durations_repaired', actor, { count: repairedCount });

    return ok(res, { success: true, count: repairedCount });
}

// SECTION: STAFF_ACCESS_REQUESTS
// PURPOSE: GET pending access requests, PATCH approve/reject. Only management can approve.
async function handleStaffAccessRequests(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.STAFF_ACCESS_APPROVE);
        const { data: rows, error } = await supabase
            .from('staff_profiles')
            .select('discord_id, display_name, username, avatar_url, staff_rank, access_status, access_requested_at, raw_payload')
            .eq('access_status', 'pending')
            .order('access_requested_at', { ascending: true });
        if (error) return serverError(res, error);
        return ok(res, { items: (rows || []).map((r) => ({
            discordId: r.discord_id,
            displayName: r.display_name || r.username || `User ${r.discord_id}`,
            avatarUrl: r.avatar_url || null,
            staffRank: r.staff_rank || 'pending',
            accessStatus: r.access_status,
            requestedAt: r.access_requested_at
        })) });
    }

    if (req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.STAFF_ACCESS_APPROVE);
        const { discordId, action, role, rejectionReason } = req.body || {};

        if (!discordId || !/^\d{17,20}$/.test(discordId)) return badRequest(res, 'INVALID_DISCORD_ID');
        if (!['approve', 'reject', 'block'].includes(action)) return badRequest(res, 'INVALID_ACTION');

        const now = new Date().toISOString();
        let profileUpdate = {};
        let newAccessStatus;

        if (action === 'approve') {
            const assignedRole = normalizeRole(role || 'discord_moderatoru');
            const permission = profilePermissionForRole(assignedRole);
            newAccessStatus = 'approved';
            profileUpdate = {
                access_status: 'approved',
                access_approved_at: now,
                access_approved_by_discord_id: actor.discordId || null,
                staff_rank: assignedRole,
                permission_group: permission.permission_group,
                permission_level: permission.permission_level,
                is_active_staff: true,
                updated_at: now
            };

            // Upsert role_cache atomically
            const roleCacheRow = {
                discord_id: discordId,
                staff_rank: assignedRole,
                active: true,
                source: 'admin_approved',
                last_synced_at: now,
                updated_at: now
            };
            const { error: rcError } = await supabase.from('role_cache').upsert([roleCacheRow], { onConflict: 'discord_id' });
            if (rcError) console.warn('[admin] role_cache upsert on approve failed:', rcError.message);
        } else if (action === 'reject') {
            newAccessStatus = 'rejected';
            profileUpdate = {
                access_status: 'rejected',
                access_rejected_at: now,
                access_rejection_reason: rejectionReason || 'Yonetici tarafindan reddedildi',
                is_active_staff: false,
                updated_at: now
            };
        } else if (action === 'block') {
            newAccessStatus = 'blocked';
            profileUpdate = {
                access_status: 'blocked',
                staff_rank: 'blocked',
                permission_group: 'blocked',
                permission_level: -1,
                is_active_staff: false,
                updated_at: now
            };
        }

        const { error } = await supabase.from('staff_profiles').update(profileUpdate).eq('discord_id', discordId);
        if (error) return serverError(res, error);

        await addAudit(`staff_access_${action}d`, actor, { discordId, action, role, rejectionReason });
        return ok(res, { discordId, action, accessStatus: newAccessStatus });
    }

    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

// SECTION: ANNOUNCEMENTS
// PURPOSE: CRUD for announcements; POST saves draft and queues bot_action_audit dispatch.
async function handleAnnouncements(req, res) {
    if (req.method === 'GET') {
        await requirePermission(req, PERMISSIONS.ANNOUNCEMENT_MANAGE);
        const { data: rows, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) return serverError(res, error);
        return ok(res, { items: rows || [] });
    }

    if (req.method === 'POST') {
        const actor = await requirePermission(req, PERMISSIONS.ANNOUNCEMENT_MANAGE);
        const { title, body_markdown, target_roles } = req.body || {};
        if (!title || !body_markdown) return badRequest(res, 'TITLE_AND_BODY_REQUIRED');

        const now = new Date().toISOString();
        const { data: row, error } = await supabase.from('announcements').insert([{
            title,
            body_markdown,
            target_roles: target_roles || ['discord_moderatoru', 'kidemli_discord_moderatoru', 'senior_moderator', 'discord_destek_ekibi'],
            created_by_discord_id: actor.discordId || null,
            status: 'draft',
            created_at: now,
            updated_at: now
        }]).select('*').single();
        if (error) return serverError(res, error);

        await addAudit('announcement_created', actor, { id: row.id, title });
        return ok(res, { item: row });
    }

    if (req.method === 'PATCH') {
        const actor = await requirePermission(req, PERMISSIONS.ANNOUNCEMENT_MANAGE);
        const { id, action, title, body_markdown, target_roles } = req.body || {};
        if (!id) return badRequest(res, 'ANNOUNCEMENT_ID_REQUIRED');

        const now = new Date().toISOString();
        let updatePayload = { updated_at: now };
        if (title) updatePayload.title = title;
        if (body_markdown) updatePayload.body_markdown = body_markdown;
        if (target_roles) updatePayload.target_roles = target_roles;

        if (action === 'publish') {
            updatePayload.status = 'published';
            updatePayload.published_at = now;

            // Queue dispatch via bot_action_audit for bot to pick up
            const guildId = process.env.DISCORD_GUILD_ID || '';
            if (guildId) {
                await insertBotAction({
                    guildId,
                    action: 'dispatch_announcement',
                    actor,
                    payload: { announcementId: id, targetRoles: updatePayload.target_roles || target_roles },
                    status: 'pending'
                });
            }
        } else if (action === 'archive') {
            updatePayload.status = 'archived';
        }

        const { error } = await supabase.from('announcements').update(updatePayload).eq('id', id);
        if (error) return serverError(res, error);

        await addAudit(`announcement_${action || 'updated'}`, actor, { id, action });
        return ok(res, { success: true, id, action });
    }

    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const route = getRoute(req);

        if (route === 'audit-logs') return await handleAuditLogs(req, res);
        if (route === 'google-allowlist') return await handleGoogleAllowlist(req, res);
        if (route === 'role-cache') return await handleRoleCache(req, res);
        if (route === 'role-policy') return await handleRolePolicy(req, res);
        if (route === 'staff-role-config') return await handleStaffRoleConfig(req, res);
        if (route === 'staff-profiles') return await handleStaffProfiles(req, res);
        if (route === 'staff-access-requests') return await handleStaffAccessRequests(req, res);
        if (route === 'discord-bot-guilds') return await handleDiscordBotGuilds(req, res);
        if (route === 'discord-bot-dashboard') return await handleDiscordBotDashboard(req, res);
        if (route === 'discord-bot-action') return await handleDiscordBotAction(req, res);
        if (route === 'repair-dates') return await handleRepairDates(req, res);
        if (route === 'announcements') return await handleAnnouncements(req, res);

        return res.status(404).json({ ok: false, error: 'NOT_FOUND', route });
    } catch (error) {
        if (error.statusCode === 403) {
            const code = error.code || 'AUTH_FORBIDDEN_ROLE';
            return res.status(403).json({ ok: false, error: code, message: error.message || 'Forbidden' });
        }
        if (error.statusCode === 401) {
            return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
        }
        return serverError(res, error);
    }
};
