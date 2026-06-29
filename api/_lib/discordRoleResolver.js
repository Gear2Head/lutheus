const { supabase } = require('./supabaseClient');
const { isOwnerIdentity, normalizeRole } = require('./roles');

// SECTION: ROLE_GUARDS
// PURPOSE: Resolves Discord staff roles from Supabase without breaking login on read/write failures.

const SEEDED_ROLE_MEMBERS = Object.freeze([
    { id: '758769576778661989', role: 'kidemli_discord_moderatoru', name: 'Gear_Head' }
]);


const DEFAULT_ROLE_CONFIG = Object.freeze({
    kurucu: { permissionGroup: 'owner', permissionLevel: 100 },
    admin: { permissionGroup: 'admin', permissionLevel: 100 },
    yonetici: { permissionGroup: 'management', permissionLevel: 100 },
    genel_sorumlu: { permissionGroup: 'management', permissionLevel: 100 },
    discord_yoneticisi: { permissionGroup: 'management', permissionLevel: 100 },
    senior_moderator: { permissionGroup: 'management', permissionLevel: 100 },
    kidemli_discord_moderatoru: { permissionGroup: 'management', permissionLevel: 100 },
    discord_moderatoru: { permissionGroup: 'moderation', permissionLevel: 50 },
    discord_destek_ekibi: { permissionGroup: 'support', permissionLevel: 25 },
    viewer: { permissionGroup: 'viewer', permissionLevel: 10 },
    pending: { permissionGroup: 'pending', permissionLevel: 0 },
    blocked: { permissionGroup: 'blocked', permissionLevel: -1 },
    eski_yetkili: { permissionGroup: 'eski_yetkili', permissionLevel: -2 }
});

function roleDefaults(role) {
    return DEFAULT_ROLE_CONFIG[normalizeRole(role)] || DEFAULT_ROLE_CONFIG.pending;
}

async function maybeSingleSafe(builder, source) {
    const { data, error } = await builder.maybeSingle();
    if (error) {
        console.warn(`[discordRoleResolver] ${source} lookup failed:`, error.message || error);
        return null;
    }
    return data || null;
}

async function getRoleConfig(role) {
    const normalized = normalizeRole(role);
    const row = await maybeSingleSafe(
        supabase
            .from('staff_role_config')
            .select('permission_group, permission_level')
            .eq('role_key', normalized),
        'staff_role_config'
    );
    return {
        role: normalized,
        permissionGroup: row?.permission_group || roleDefaults(normalized).permissionGroup,
        permissionLevel: Number(row?.permission_level ?? roleDefaults(normalized).permissionLevel)
    };
}

function bootstrapRole(discordId) {
    if (isOwnerIdentity({ discordId })) return 'kidemli_discord_moderatoru';
    const bootstrapIds = String(process.env.BOOTSTRAP_DISCORD_IDS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return bootstrapIds.includes(String(discordId)) ? 'admin' : null;
}

async function seedRoleCache(discordUser, seeded, avatarUrl) {
    const discordId = String(discordUser.id);
    const role = normalizeRole(seeded.role);
    const permission = roleDefaults(role);
    const now = new Date().toISOString();
    const displayName = discordUser.global_name || discordUser.username || seeded.name;

    const staffPayload = {
        discord_id: discordId,
        email: discordUser.email || null,
        display_name: displayName,
        username: discordUser.username || null,
        avatar_url: avatarUrl || null,
        staff_rank: role,
        permission_group: permission.permissionGroup,
        permission_level: permission.permissionLevel,
        is_active_staff: true,
        last_seen_at: now,
        raw_payload: { displayName, role, source: 'lutheus-autoseed' },
        updated_at: now
    };
    const rolePayload = {
        discord_id: discordId,
        staff_rank: role,
        active: true,
        source: 'lutheus-autoseed',
        last_synced_at: now,
        raw_payload: { displayName, role },
        updated_at: now
    };

    const { error: staffError } = await supabase.from('staff_profiles').upsert([staffPayload], { onConflict: 'discord_id' });
    if (staffError) console.warn('[discordRoleResolver] seeded staff profile upsert failed:', staffError.message || staffError);
    const { error: roleError } = await supabase.from('role_cache').upsert([rolePayload], { onConflict: 'discord_id' });
    if (roleError) console.warn('[discordRoleResolver] seeded role cache upsert failed:', roleError.message || roleError);
}

async function resolveDiscordRole(discordUser, avatarUrl = null) {
    const discordId = String(discordUser?.id || '');
    const bootRole = bootstrapRole(discordId);
    if (bootRole) return getRoleConfig(bootRole);

    const roleRow = await maybeSingleSafe(
        supabase
            .from('role_cache')
            .select('*')
            .eq('discord_id', discordId),
        'role_cache'
    );
    if (roleRow?.staff_rank === 'blocked' || roleRow?.staff_rank === 'eski_yetkili') {
        return getRoleConfig(roleRow.staff_rank);
    }
    if (roleRow?.active === true && roleRow?.staff_rank && roleRow?.staff_rank !== 'pending') {
        // SECTION: ROLE_CACHE_ACCESS_CHECK
        // PURPOSE: Verify access_status on staff_profiles before granting non-pending role from cache.
        const profileForRoleRow = await maybeSingleSafe(
            supabase.from('staff_profiles').select('access_status, is_active_staff').eq('discord_id', discordId),
            'staff_profiles_access_check'
        );
        if (profileForRoleRow?.access_status === 'approved' && profileForRoleRow?.is_active_staff === true) {
            return getRoleConfig(roleRow.staff_rank);
        }
        // Profile not yet approved: fall through to pending
    }

    const profileRow = await maybeSingleSafe(
        supabase
            .from('staff_profiles')
            .select('*')
            .eq('discord_id', discordId),
        'staff_profiles'
    );
    if (profileRow?.staff_rank === 'blocked' || profileRow?.staff_rank === 'eski_yetkili') {
        return getRoleConfig(profileRow.staff_rank);
    }
    // SECTION: PROFILE_ACCESS_CHECK
    // PURPOSE: access_status AND is_active_staff must both pass before granting an active role.
    if (profileRow?.is_active_staff === true && profileRow?.access_status === 'approved' && profileRow?.staff_rank) {
        return getRoleConfig(profileRow.staff_rank);
    }

    // SECTION: SEEDED_ROLE_MEMBERS
    // PURPOSE: Auto-seed is disabled for normal logins. Only bootstrap/owner roles bypass this.
    // The SEEDED_ROLE_MEMBERS list is kept for migration/admin repair contexts, not automatic login grants.
    // To grant access to a staff member, use the admin approval workflow instead.
    const seeded = SEEDED_ROLE_MEMBERS.find((member) => member.id === discordId);
    if (seeded) {
        // Only seed if user has no profile yet (first-time bootstrap), not to override pending status
        const existingProfile = await maybeSingleSafe(
            supabase.from('staff_profiles').select('access_status').eq('discord_id', discordId),
            'staff_profiles_seed_check'
        );
        if (!existingProfile) {
            const isOwner = isOwnerIdentity({ discordId });
            const initialRole = isOwner ? 'kidemli_discord_moderatoru' : 'pending';
            await seedRoleCache(discordUser, { ...seeded, role: initialRole }, avatarUrl);
            if (isOwner) {
                return getRoleConfig('kidemli_discord_moderatoru');
            }
        }
    }

    return getRoleConfig('pending');
}

module.exports = {
    resolveDiscordRole,
    roleDefaults
};
