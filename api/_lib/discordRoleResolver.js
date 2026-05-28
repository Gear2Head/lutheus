const { supabase } = require('./supabaseClient');
const { isOwnerIdentity, normalizeRole } = require('./roles');

// SECTION: ROLE_GUARDS
// PURPOSE: Resolves Discord staff roles from Supabase without breaking login on read/write failures.

const SEEDED_ROLE_MEMBERS = Object.freeze([
    { id: '770612318689165313', role: 'yonetici', name: 'Yagi' },
    { id: '202889333563195402', role: 'yonetici', name: 'BarisYilmaz' },
    { id: '344121374320754709', role: 'yonetici', name: 'Rei' },
    { id: '1109657614968692840', role: 'genel_sorumlu', name: 'Maty' },
    { id: '962062500189331506', role: 'genel_sorumlu', name: 'Swenss' },
    { id: '860192567177773076', role: 'discord_yoneticisi', name: 'xGoveer' },
    { id: '758769576778661989', role: 'kidemli_discord_moderatoru', name: 'Gear_Head' },
    { id: '529357404882599966', role: 'discord_moderatoru', name: 'DadluKedi' },
    { id: '1360069068794626139', role: 'discord_destek_ekibi', name: 'Timur' },
    { id: '707582959766732872', role: 'viewer', name: 'Reşat' },
    { id: '1135248585802403901', role: 'viewer', name: 'Qumru' },
    { id: '760895784153251841', role: 'discord_destek_ekibi', name: 'Atom' },
    { id: '1375772029982085184', role: 'discord_destek_ekibi', name: 'Nado' }
]);

const DEFAULT_ROLE_CONFIG = Object.freeze({
    kurucu: { permissionGroup: 'owner', permissionLevel: 100 },
    admin: { permissionGroup: 'admin', permissionLevel: 100 },
    yonetici: { permissionGroup: 'management', permissionLevel: 90 },
    genel_sorumlu: { permissionGroup: 'management', permissionLevel: 80 },
    discord_yoneticisi: { permissionGroup: 'management', permissionLevel: 75 },
    kidemli_discord_moderatoru: { permissionGroup: 'management', permissionLevel: 100 },
    discord_moderatoru: { permissionGroup: 'moderation', permissionLevel: 50 },
    discord_destek_ekibi: { permissionGroup: 'support', permissionLevel: 25 },
    viewer: { permissionGroup: 'viewer', permissionLevel: 10 },
    pending: { permissionGroup: 'pending', permissionLevel: 0 },
    blocked: { permissionGroup: 'blocked', permissionLevel: -1 }
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
    if (isOwnerIdentity({ discordId })) return 'kurucu';
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
            .eq('discord_id', discordId)
            .eq('active', true),
        'role_cache'
    );
    if (roleRow?.staff_rank) return getRoleConfig(roleRow.staff_rank);

    const profileRow = await maybeSingleSafe(
        supabase
            .from('staff_profiles')
            .select('*')
            .eq('discord_id', discordId)
            .eq('is_active_staff', true),
        'staff_profiles'
    );
    if (profileRow?.staff_rank) return getRoleConfig(profileRow.staff_rank);

    const seeded = SEEDED_ROLE_MEMBERS.find((member) => member.id === discordId);
    if (seeded) {
        await seedRoleCache(discordUser, seeded, avatarUrl);
        return getRoleConfig(seeded.role);
    }

    return getRoleConfig('pending');
}

module.exports = {
    resolveDiscordRole,
    roleDefaults
};
