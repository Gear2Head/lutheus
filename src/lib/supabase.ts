import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jxhzhaqqtlynbnntwpyu.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache systems to prevent duplicate overhead and maintain top performance
let cachedStaff: any[] | null = null;
let cachedPenalties: any[] | null = null;

// Dispatch a global event indicating that Supabase sync just completed
export function dispatchSync() {
  if (typeof window !== 'undefined') {
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    window.dispatchEvent(new CustomEvent('supabase-sync-time', { detail: timeStr }));
  }
}

// Normalization function for penalties (supports camelCase and snake_case)
export function normalizePenalty(row: any): any {
  if (!row) return row;
  return {
    id: row.id || '#unknown',
    icon: row.icon ?? row.type ?? 'MUTE',
    avatar: row.avatar ?? row.avatar_url ?? 'https://i.pravatar.cc/150?img=1',
    staff: row.staff ?? row.staff_name ?? 'Yetkili',
    reason: row.reason ?? '—',
    duration: row.duration ?? 'Kalıcı',
    date: row.date ?? row.created_at ?? '—',
    status: row.status ?? 'DOĞRU',
    isWarning: row.isWarning !== undefined ? row.isWarning : (row.is_warning !== undefined ? row.is_warning : false),
    isActive: row.isActive !== undefined ? row.isActive : (row.is_active !== undefined ? row.is_active : false)
  };
}

// Normalization function for staff (supports camelCase and snake_case)
export function normalizeStaff(row: any): any {
  if (!row) return row;
  return {
    id: row.id || '000000000000000000',
    user: row.user ?? row.username ?? row.staff_name ?? 'unknown',
    avatar: row.avatar ?? row.avatar_url ?? 'https://i.pravatar.cc/150?img=1',
    total: row.total ?? 0,
    correct: row.correct ?? 0,
    incorrect: row.incorrect ?? 0,
    accuracy: row.accuracy ?? 100,
    status: row.status ?? 'GÜVENİLİR',
    role: row.role ?? 'DISCORD MODERATÖR',
    roleGroup: row.roleGroup ?? row.role_group ?? 'ACTIVE',
    cukScore: row.cukScore ?? row.cuk_score ?? 0
  };
}

// Clean helper to check if Supabase is properly configured and reachable
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('penalties').select('id').limit(1);
    if (error) {
      console.warn("Supabase check error (likely table doesn't exist yet):", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase unreachable:", err);
    return false;
  }
}

/**
 * Robustly fetch staff performance data.
 * Falls back to mock data if table querying fails or if table is empty.
 * Proactively seeds if empty.
 */
export async function getStaffData(fallbackData: any[]): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*');
    
    if (error) {
      console.warn("Could not query 'staff' table, falling back to local dataset. Error:", error.message);
      dispatchSync();
      return fallbackData.map(normalizeStaff);
    }
    
    if (data && data.length > 0) {
      dispatchSync();
      return data.map(normalizeStaff);
    }
    
    // Proactively seed 'staff' table with mock data if it is empty and connection works
    try {
      console.log("Supabase table 'staff' is empty. Seeding mock users...");
      const dbFormat = fallbackData.map(s => ({
        id: s.id,
        user: s.user,
        avatar: s.avatar,
        total: s.total,
        correct: s.correct,
        incorrect: s.incorrect,
        accuracy: s.accuracy,
        status: s.status,
        role: s.role,
        role_group: s.roleGroup,
        roleGroup: s.roleGroup,
        cuk_score: s.cukScore || 0,
        cukScore: s.cukScore || 0
      }));
      await supabase.from('staff').insert(dbFormat);
    } catch (seedErr) {
      console.warn("Failed seeding 'staff' table:", seedErr);
    }
    
    dispatchSync();
    return fallbackData.map(normalizeStaff);
  } catch (err) {
    console.warn("Failed fetching staff from DB, utilizing default dataset.", err);
    dispatchSync();
    return fallbackData.map(normalizeStaff);
  }
}

/**
 * Robustly fetch penalty logs.
 * Falls back to local curated data if DB queries fail.
 * Proactively seeds if empty.
 */
export async function getPenaltiesData(fallbackData: any[]): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('penalties')
      .select('*');
    
    if (error) {
      console.warn("Could not query 'penalties' table, falling back to local dataset. Error:", error.message);
      dispatchSync();
      return fallbackData.map(normalizePenalty);
    }
    
    if (data && data.length > 0) {
      dispatchSync();
      return data.map(normalizePenalty);
    }
    
    // Proactively seed 'penalties' table with mock data if it is empty and connection works
    try {
      console.log("Supabase table 'penalties' is empty. Seeding mock penalties...");
      const dbFormat = fallbackData.map(p => ({
        id: p.id,
        icon: p.icon,
        avatar: p.avatar,
        staff: p.staff,
        reason: p.reason,
        duration: p.duration,
        date: p.date,
        status: p.status,
        is_warning: p.isWarning,
        is_active: p.isActive,
        isWarning: p.isWarning,
        isActive: p.isActive
      }));
      await supabase.from('penalties').insert(dbFormat);
    } catch (seedErr) {
      console.warn("Failed seeding 'penalties' table:", seedErr);
    }
    
    dispatchSync();
    return fallbackData.map(normalizePenalty);
  } catch (err) {
    console.warn("Failed fetching penalties from DB, utilizing default dataset.", err);
    dispatchSync();
    return fallbackData.map(normalizePenalty);
  }
}

/**
 * Insert or sync a penalty record back into Supabase if it exists.
 */
export async function addPenaltyRecord(penalty: any) {
  try {
    const dbFriendly = {
      id: penalty.id,
      icon: penalty.icon,
      avatar: penalty.avatar,
      staff: penalty.staff,
      reason: penalty.reason,
      duration: penalty.duration,
      date: penalty.date,
      status: penalty.status,
      is_warning: penalty.isWarning ?? false,
      is_active: penalty.isActive ?? false,
      isWarning: penalty.isWarning ?? false,
      isActive: penalty.isActive ?? false
    };
    
    const { data, error } = await supabase
      .from('penalties')
      .insert([dbFriendly])
      .select();
    
    if (error) throw error;
    // Update stats for the staff member
    if (penalty.staff) {
      await updateStaffStats(penalty.staff);
    }
    return data;
  } catch (err) {
    console.warn("Could not post penalty to Supabase. DB offline or table missing:", err);
    return null;
  }
}

/**
 * Calculates and updates staff statistics dynamically.
 */
export async function updateStaffStats(staffName: string) {
  try {
    if (!staffName) return;

    // 1. Fetch all penalties of this staff
    const { data: penalties, error: pError } = await supabase
      .from('penalties')
      .select('*')
      .eq('staff', staffName);

    if (pError || !penalties) {
      console.warn("Failed to retrieve penalties of staff for stats recalculation:", pError?.message);
      return;
    }

    // 2. Compute metrics
    const total = penalties.length;
    const correct = penalties.filter(p => (p.status || '').toUpperCase() === 'DOĞRU').length;
    const incorrect = penalties.filter(p => (p.status || '').toUpperCase() === 'HATALI').length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
    
    // CUK Score formula: (2 * correct) - (3 * incorrect)
    const cukScore = (correct * 2) - (incorrect * 3);
    
    // Status can be: GÜVENİLİR (accuracy >= 85), İZLEMEDE (accuracy >= 65 and < 85), RİSKLİ (accuracy < 65)
    let statsStatus = 'GÜVENİLİR';
    if (accuracy < 65) statsStatus = 'RİSKLİ';
    else if (accuracy < 85) statsStatus = 'İZLEMEDE';

    // 3. Update staff table
    // Fetch staff list first to find ID matched with name
    const { data: staffList, error: sError } = await supabase
      .from('staff')
      .select('*');

    if (sError || !staffList) {
      console.warn("Failed to retrieve staff list for stats mismatch update:", sError?.message);
      return;
    }

    const match = staffList.find(s => 
      (s.user || '').toLowerCase() === staffName.toLowerCase() ||
      (s.username || '').toLowerCase() === staffName.toLowerCase() ||
      (s.staff_name || '').toLowerCase() === staffName.toLowerCase()
    );

    if (match) {
      const payload = {
        total,
        correct,
        incorrect,
        accuracy,
        cuk_score: cukScore,
        cukScore: cukScore,
        status: statsStatus
      };

      const { error: updateError } = await supabase
        .from('staff')
        .update(payload)
        .eq('id', match.id);

      if (updateError) {
        console.warn("Failed to update staff metrics in DB table:", updateError.message);
      } else {
        console.log(`Successfully updated Supabase metrics for staff: ${staffName}`);
        dispatchSync();
      }
    } else {
      console.warn(`No matching staff record found for name: ${staffName} to sync stats.`);
    }
  } catch (err) {
    console.warn("Error running automated staff stats calculator:", err);
  }
}
