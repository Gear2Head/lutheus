// ============================================================
// Lutheus Supabase REST Client v2
// Direct REST API calls — compatible with Chrome Extension CSP.
// The anon key is safe for client-side use (RLS enforced on DB).
// ============================================================

import { validateCase } from './cukEngine';

export const SUPABASE_URL = 'https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1';
export const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI';

// ---------- Types ----------

export interface SapphireCase {
  case_id: string;
  guild_id: string;
  type: string;
  is_open: boolean;
  punished_user_discord_id: string;
  punished_user_display_name: string;
  punished_user_avatar_url: string;
  author_discord_id: string;
  author_display_name: string;
  author_avatar_url: string;
  reason_raw: string;
  reason_normalized: string;
  duration_raw: string;
  duration_ms: number;
  is_permanent: boolean;
  created_at_sapphire: string;
  expires_at: string;
  cuk_verdict: 'valid' | 'invalid' | 'pending';
  cuk_analysis: { message: string; category: string; score: number } | null;
  source_sync: string;
  case_url?: string;
  ai_validation_status?: string;
  ai_validation_notes?: string;
}

export interface StaffProfile {
  discord_id: string;
  username: string;
  role: string;
  in_game_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  avatar_url?: string;
}

export interface AuditLog {
  id: string;
  actor_discord_id: string;
  action: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ---------- Core fetch ----------

let _userToken: string | null = null;

export function setAuthToken(token: string | null) {
  _userToken = token;
}

function buildHeaders(): Record<string, string> {
  const token = _userToken || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export async function supabaseFetch<T = unknown>(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  queryParams?: string,
  body?: unknown,
): Promise<T | null> {
  const url = `${SUPABASE_URL}/${table}${queryParams ? `?${queryParams}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase ${method} ${table} failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<T>;
}

export function enrichCaseWithCuk(c: SapphireCase): SapphireCase {
  if (!c.cuk_verdict) {
    const analysis = validateCase(c.reason_raw, Math.round((c.duration_ms || 0) / 60000));
    c.cuk_verdict = analysis.valid ? 'valid' : 'invalid';
    c.cuk_analysis = {
      message: analysis.message,
      category: analysis.categoryMatched || 'Diğer',
      score: analysis.score
    };
  }
  return c;
}

// ---------- Cases ----------

export async function getRecentCases(limit = 100): Promise<SapphireCase[]> {
  const data = await supabaseFetch<SapphireCase[]>(
    'sapphire_cases',
    'GET',
    `order=created_at_sapphire.desc&limit=${limit}`,
  );
  return (data || []).map(enrichCaseWithCuk);
}

export async function getCaseById(caseId: string): Promise<SapphireCase | null> {
  const data = await supabaseFetch<SapphireCase[]>(
    'sapphire_cases',
    'GET',
    `case_id=eq.${encodeURIComponent(caseId)}&limit=1`,
  );
  return data?.[0] ? enrichCaseWithCuk(data[0]) : null;
}

export async function updateCaseVerdict(
  caseId: string,
  verdict: 'valid' | 'invalid' | 'pending',
  analysis?: { message: string; category: string; score: number },
): Promise<void> {
  // 1. Update database
  await supabaseFetch(
    'sapphire_cases',
    'PATCH',
    `case_id=eq.${encodeURIComponent(caseId)}`,
    { cuk_verdict: verdict, ...(analysis ? { cuk_analysis: analysis } : {}) },
  );

  // 2. Update local storage cache to prevent F5 reversion
  try {
    const raw = await getLocal<SapphireCase[]>(LOCAL_CASES_KEY);
    if (raw) {
      const updated = raw.map((c) => {
        if (c.case_id === caseId) {
          return {
            ...c,
            cuk_verdict: verdict,
            ...(analysis ? { cuk_analysis: analysis } : {}),
          };
        }
        return c;
      });
      await setLocal(LOCAL_CASES_KEY, updated);
      try {
        localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn("Supabase silent fail:", error);
      }
    }
  } catch (err) {
    console.warn('[Lutheus] Failed to update local cache for case verdict:', err);
  }
}

export async function bulkUpdateVerdict(
  caseIds: string[],
  verdict: 'valid' | 'invalid',
): Promise<void> {
  // 1. Update database
  const ids = caseIds.map((id) => `"${id}"`).join(',');
  await supabaseFetch(
    'sapphire_cases',
    'PATCH',
    `case_id=in.(${ids})`,
    { cuk_verdict: verdict },
  );

  // 2. Update local storage cache to prevent F5 reversion
  try {
    const raw = await getLocal<SapphireCase[]>(LOCAL_CASES_KEY);
    if (raw) {
      const updated = raw.map((c) => {
        if (c.case_id && caseIds.includes(c.case_id)) {
          return { ...c, cuk_verdict: verdict };
        }
        return c;
      });
      await setLocal(LOCAL_CASES_KEY, updated);
      try {
        localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn("Supabase silent fail:", error);
      }
    }
  } catch (err) {
    console.warn('[Lutheus] Failed to update local cache for bulk verdict:', err);
  }
}

// ---------- Staff ----------

interface DbStaffProfile {
  discord_id: string;
  display_name?: string | null;
  username?: string | null;
  staff_rank?: string | null;
  is_active_staff?: boolean;
  created_at?: string | null;
  avatar_url?: string | null;
}

export async function getStaffProfiles(): Promise<StaffProfile[]> {
  const data = await supabaseFetch<DbStaffProfile[]>(
    'staff_profiles',
    'GET',
    'order=discord_id.desc',
  );
  
  if (!data) return [];
  
  return data.map((p) => ({
    discord_id: p.discord_id,
    username: p.display_name || p.username || p.discord_id,
    role: p.staff_rank || 'discord_moderatoru',
    in_game_name: p.display_name || p.username || p.discord_id,
    status: p.is_active_staff ? 'ACTIVE' : 'INACTIVE',
    created_at: p.created_at || new Date().toISOString(),
    avatar_url: p.avatar_url || undefined
  }));
}

export async function updateStaffProfile(
  discordId: string,
  updates: Partial<StaffProfile> & {
    discord_id?: string;
    display_name?: string;
    staff_rank?: string;
    is_active_staff?: boolean;
    access_status?: string;
    source_flags?: string[];
    updated_at?: string;
  },
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.in_game_name !== undefined || updates.username !== undefined || updates.display_name !== undefined) {
    dbUpdates.display_name = updates.in_game_name ?? updates.username ?? updates.display_name;
  }
  if (updates.role !== undefined || updates.staff_rank !== undefined) {
    dbUpdates.staff_rank = updates.role ?? updates.staff_rank;
  }
  if (updates.status !== undefined || updates.is_active_staff !== undefined) {
    dbUpdates.is_active_staff = updates.status !== undefined ? (updates.status === 'ACTIVE') : updates.is_active_staff;
  }
  if (updates.avatar_url !== undefined) {
    dbUpdates.avatar_url = updates.avatar_url;
  }
  if (updates.access_status !== undefined) {
    dbUpdates.access_status = updates.access_status;
  }
  if (updates.source_flags !== undefined) {
    dbUpdates.source_flags = updates.source_flags;
  }
  if (updates.updated_at !== undefined) {
    dbUpdates.updated_at = updates.updated_at;
  }

  // Update staff_profiles table
  await supabaseFetch(
    'staff_profiles',
    'PATCH',
    `discord_id=eq.${encodeURIComponent(discordId)}`,
    dbUpdates,
  );

  // Mirror to role_cache if role or status was modified
  if (updates.role !== undefined || updates.status !== undefined || updates.staff_rank !== undefined || updates.is_active_staff !== undefined) {
    const rcUpdates: Record<string, unknown> = {};
    const resolvedRole = updates.role ?? updates.staff_rank;
    const resolvedActive = updates.status !== undefined ? (updates.status === 'ACTIVE') : updates.is_active_staff;
    if (resolvedRole !== undefined) {
      rcUpdates.staff_rank = resolvedRole;
    }
    if (resolvedActive !== undefined) {
      rcUpdates.active = resolvedActive;
    }
    rcUpdates.updated_at = new Date().toISOString();

    try {
      await supabaseFetch(
        'role_cache',
        'PATCH',
        `discord_id=eq.${encodeURIComponent(discordId)}`,
        rcUpdates,
      );
    } catch (err) {
      console.warn('[Lutheus] Failed to mirror to role_cache:', err);
    }
  }
}

// ---------- Audit ----------

export async function getAuditLogs(limit = 50): Promise<AuditLog[]> {
  const data = await supabaseFetch<AuditLog[]>(
    'audit_logs',
    'GET',
    `order=created_at.desc&limit=${limit}`,
  );
  return data || [];
}

export async function insertAuditLog(
  actorId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await supabaseFetch('audit_logs', 'POST', '', {
    actor_discord_id: actorId,
    action,
    target_id: targetId,
    details,
  });
}

// ---------- Local-first sync queue ----------
// Cases captured locally by the extension are queued in chrome.storage
// and flushed to Supabase either automatically or on demand.

const LOCAL_CASES_KEY = 'cases';
const SYNC_QUEUE_KEY = 'lutheusIngestQueue';

function getLocal<T>(key: string): Promise<T | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) =>
      chrome.storage.local.get([key], (r) => resolve((r[key] as T) || null)),
    );
  }
  try {
    const raw = localStorage.getItem(key);
    return Promise.resolve(raw ? JSON.parse(raw) : null);
  } catch {
    return Promise.resolve(null);
  }
}

function setLocal<T>(key: string, value: T): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) =>
      chrome.storage.local.set({ [key]: value }, () => resolve()),
    );
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Supabase silent fail:", error);
  }
  return Promise.resolve();
}

/** Returns all cases that are locally cached by the extension scraper. */
export async function getLocalCases(): Promise<SapphireCase[]> {
  const raw = await getLocal<SapphireCase[]>(LOCAL_CASES_KEY);
  return (raw || []).map(enrichCaseWithCuk);
}

/** Returns count of items pending sync to Supabase. */
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getLocal<unknown[]>(SYNC_QUEUE_KEY);
  return queue?.length || 0;
}

/** Trigger manual sync by messaging the service worker. */
export function triggerManualSync(): Promise<{ synced: number; errors: number }> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'MANUAL_SYNC_FLUSH' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve((response as { synced: number; errors: number }) || { synced: 0, errors: 0 });
          }
        },
      );
    });
  }
  return Promise.resolve({ synced: 0, errors: 0 });
}

/** Fetch cases: merges Supabase and local storage cases, deduplicating by case_id. */
export async function getCases(limit = 100): Promise<SapphireCase[]> {
  let dbCases: SapphireCase[] = [];
  try {
    dbCases = await getRecentCases(limit);
  } catch (err) {
    console.error('[Lutheus Supabase Error Boundary] Supabase unavailable:', err);
    throw err;
  }

  let localCases: SapphireCase[] = [];
  try {
    localCases = await getLocalCases();
  } catch (err) {
    console.warn('[Lutheus] Failed to read local cases:', err);
  }

  // Merge and deduplicate by case_id
  const mergedMap = new Map<string, SapphireCase>();
  const isInvalidId = (id: string) => {
    const cleanId = String(id || '').trim();
    return !cleanId || cleanId === 'RRwean' || cleanId === '#' || cleanId === 'Bilinmeyen' || cleanId === 'Yetkili' || cleanId === 'undefined' || cleanId === 'null';
  };

  for (const c of localCases) {
    if (c && c.case_id && !isInvalidId(c.case_id)) {
      mergedMap.set(c.case_id, c);
    }
  }
  for (const c of dbCases) {
    if (c && c.case_id && !isInvalidId(c.case_id)) {
      mergedMap.set(c.case_id, c);
    }
  }

  // Convert to array and sort by created_at_sapphire desc
  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    const timeA = new Date(a.created_at_sapphire).getTime() || 0;
    const timeB = new Date(b.created_at_sapphire).getTime() || 0;
    return timeB - timeA;
  });

  return sorted.slice(0, limit);
}

/** Purge only cases from both local storage and Supabase database. */
export async function clearAllCasesFromDbAndLocal(): Promise<void> {
  // 1. Clear local cases and queue
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => chrome.storage.local.set({ cases: [] }, () => resolve()));
    await new Promise<void>((resolve) => chrome.storage.local.set({ lutheusIngestQueue: [] }, () => resolve()));
  }
  try {
    localStorage.setItem('cases', '[]');
    localStorage.setItem('lutheusIngestQueue', '[]');
  } catch {
    // localStorage may be unavailable in restricted extension contexts.
  }

  // 2. Clear from Supabase
  await supabaseFetch('sapphire_cases', 'DELETE', 'case_id=neq.0');
}

export interface CaseProof {
  case_id: string;
  proof_url: string | null;
  raw_text: string | null;
  ai_verdict: 'valid' | 'invalid' | null;
  ai_analysis: string | null;
  created_at?: string;
  updated_at?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  additional_proofs?: Array<{
    proof_url: string | null;
    video_url?: string | null;
    thumbnail_url?: string | null;
    raw_text?: string | null;
  }>;
  embedded_from_case_id?: string | null;
  embedded_to_case_ids?: string[];
}

export async function getCaseProof(caseId: string): Promise<CaseProof | null> {
  const data = await supabaseFetch<CaseProof[]>(
    'case_proofs',
    'GET',
    `case_id=eq.${caseId}&select=*`
  );
  return data && data.length > 0 ? data[0] : null;
}

export async function getEmbeddedProofs(caseId: string): Promise<CaseProof[]> {
  // Get proofs that are embedded into this case from other cases
  const data = await supabaseFetch<CaseProof[]>(
    'case_proofs',
    'GET',
    `embedded_to_case_ids=cs.{${caseId}}&select=*`
  );
  return data || [];
}

export async function findRelatedCasesForEmbedding(
  punishedUserId: string,
  authorDiscordId: string,
  afterTimestamp: string
): Promise<SapphireCase[]> {
  // Find cases where the same user was punished by the same moderator after a given timestamp
  const data = await supabaseFetch<SapphireCase[]>(
    'sapphire_cases',
    'GET',
    `punished_user_discord_id=eq.${punishedUserId}&author_discord_id=eq.${authorDiscordId}&created_at_sapphire=gte.${afterTimestamp}&order=created_at_sapphire.asc&limit=10`
  );
  return data || [];
}

