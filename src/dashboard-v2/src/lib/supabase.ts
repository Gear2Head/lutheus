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
  is_public?: boolean;
}

export interface StaffProfile {
  discord_id: string;
  username: string;
  role: string;
  in_game_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  avatar_url?: string;
  last_promoted_at?: string | null;
  management_comments?: string | null;
}

export interface AuditLog {
  id: string;
  actor_discord_id: string;
  action: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ─── Appeal & Ticket types ─────────────────────────────────────────────────

export interface CaseAppeal {
  id: string;
  case_id: string | null;
  user_id: string;
  user_tag: string | null;
  appeal_reason: string;
  /** 'approved' | 'rejected' */
  status: string;
  discord_message_id: string;
  created_at: string;
}

export interface UserTicket {
  id: string;
  ticket_id: string;
  ticket_name: string | null;
  user_id: string | null;
  user_tag: string | null;
  category: string | null;
  assigned_mod_id: string | null;
  message_count: number;
  discord_message_id: string | null;
  closed_at: string | null;
  transcript_url: string | null;
  thread_url: string | null;
  rating: number | null;
  created_at: string | null;
  transcript_json?: any;
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
  customHeaders?: Record<string, string>
): Promise<T | null> {
  const url = `${SUPABASE_URL}/${table}${queryParams ? `?${queryParams}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: { ...buildHeaders(), ...customHeaders },
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

export async function updateCasePublicStatus(caseId: string, isPublic: boolean): Promise<void> {
  await supabaseFetch(
    'sapphire_cases',
    'PATCH',
    `case_id=eq.${encodeURIComponent(caseId)}`,
    { is_public: isPublic },
  );

  try {
    const raw = await getLocal<SapphireCase[]>(LOCAL_CASES_KEY);
    if (raw) {
      const updated = raw.map((c) => {
        if (c.case_id === caseId) {
          return { ...c, is_public: isPublic };
        }
        return c;
      });
      await setLocal(LOCAL_CASES_KEY, updated);
      localStorage.setItem(LOCAL_CASES_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('[Lutheus] Failed to update local cache for case public status:', err);
  }
}

export async function addManualProof(caseId: string, proofUrl: string): Promise<void> {
  // Try to update existing case_proofs or insert a new one
  const existing = await getCaseProof(caseId);
  if (existing) {
    await supabaseFetch(
      'case_proofs',
      'PATCH',
      `case_id=eq.${encodeURIComponent(caseId)}`,
      { proof_url: proofUrl }
    );
  } else {
    await supabaseFetch(
      'case_proofs',
      'POST',
      '',
      {
        case_id: caseId,
        proof_url: proofUrl,
        raw_text: 'Yönetim tarafından manuel girilen kanıt linki',
        ai_verdict: null,
        ai_analysis: null
      }
    );
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

export async function bulkUpdatePublicStatus(
  caseIds: string[],
  isPublic: boolean,
): Promise<void> {
  const ids = caseIds.map((id) => `"${id}"`).join(',');
  await supabaseFetch(
    'sapphire_cases',
    'PATCH',
    `case_id=in.(${ids})`,
    { is_public: isPublic },
  );

  try {
    const raw = await getLocal<SapphireCase[]>(LOCAL_CASES_KEY);
    if (raw) {
      const updated = raw.map((c) => {
        if (c.case_id && caseIds.includes(c.case_id)) {
          return { ...c, is_public: isPublic };
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
    console.warn('[Lutheus] Failed to update local cache for bulk public status:', err);
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
  last_promoted_at?: string | null;
  management_comments?: string | null;
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
    avatar_url: p.avatar_url || undefined,
    last_promoted_at: p.last_promoted_at || null,
    management_comments: p.management_comments || null,
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
  if (updates.last_promoted_at !== undefined) {
    dbUpdates.last_promoted_at = updates.last_promoted_at;
  }
  if (updates.management_comments !== undefined) {
    dbUpdates.management_comments = updates.management_comments;
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

const CASE_PROOF_COLS = 'case_id,proof_url,raw_text,ai_verdict,ai_analysis,created_at,updated_at,additional_proofs,embedded_from_case_id,embedded_to_case_ids';

export async function getCaseProof(caseId: string): Promise<CaseProof | null> {
  // Use explicit column list — video_url / thumbnail_url may not exist yet in the DB
  const data = await supabaseFetch<CaseProof[]>(
    'case_proofs',
    'GET',
    `case_id=eq.${caseId}&select=${CASE_PROOF_COLS}`
  ).catch(() =>
    // Fallback: retry with select=* in case columns were added later
    supabaseFetch<CaseProof[]>('case_proofs', 'GET', `case_id=eq.${caseId}&select=*`)
  );
  return data && data.length > 0 ? data[0] : null;
}

export async function getEmbeddedProofs(caseId: string): Promise<CaseProof[]> {
  // Get proofs that are embedded into this case from other cases
  const data = await supabaseFetch<CaseProof[]>(
    'case_proofs',
    'GET',
    `embedded_to_case_ids=cs.{${caseId}}&select=${CASE_PROOF_COLS}`
  ).catch(() =>
    supabaseFetch<CaseProof[]>('case_proofs', 'GET', `embedded_to_case_ids=cs.{${caseId}}&select=*`)
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

export interface StaffWarning {
  id: string;
  staff_discord_id: string;
  reason: string;
  points: number;
  created_at: string;
  created_by: string;
  management_notes?: string | null;
}

export async function getStaffWarnings(staffDiscordId: string): Promise<StaffWarning[]> {
  const data = await supabaseFetch<StaffWarning[]>(
    'staff_warnings',
    'GET',
    `staff_discord_id=eq.${encodeURIComponent(staffDiscordId)}&order=created_at.desc`,
  );
  return data || [];
}

export async function addStaffWarning(warning: Omit<StaffWarning, 'id' | 'created_at'>): Promise<void> {
  await supabaseFetch(
    'staff_warnings',
    'POST',
    undefined,
    warning,
  );
}

export async function deleteStaffWarning(id: string): Promise<void> {
  await supabaseFetch(
    'staff_warnings',
    'DELETE',
    `id=eq.${encodeURIComponent(id)}`,
  );
}

export async function deleteCase(caseId: string): Promise<void> {
  await supabaseFetch(
    'sapphire_cases',
    'DELETE',
    `case_id=eq.${encodeURIComponent(caseId)}`,
  );
}

export interface StaffMessage {
  id: string;
  staff_discord_id: string;
  message: string;
  created_at: string;
  created_by: string;
  response?: string | null;
  responded_at?: string | null;
  responded_by?: string | null;
}

export async function getStaffMessages(staffDiscordId: string): Promise<StaffMessage[]> {
  const data = await supabaseFetch<StaffMessage[]>(
    'staff_messages',
    'GET',
    `staff_discord_id=eq.${encodeURIComponent(staffDiscordId)}&order=created_at.desc`,
  );
  return data || [];
}

export async function sendStaffMessage(msg: Omit<StaffMessage, 'id' | 'created_at'>): Promise<void> {
  await supabaseFetch(
    'staff_messages',
    'POST',
    undefined,
    msg,
  );
}

export async function replyStaffMessage(id: string, response: string, respondedBy: string): Promise<void> {
  await supabaseFetch(
    'staff_messages',
    'PATCH',
    `id=eq.${encodeURIComponent(id)}`,
    {
      response,
      responded_at: new Date().toISOString(),
      responded_by: respondedBy
    }
  );
}

// ─── Case Appeals ──────────────────────────────────────────────────────────

/**
 * Tüm itiraz kayıtlarını getirir. userId verilirse o kullanıcıya ait kayıtları filtreler.
 */
export async function getAppeals(userId?: string): Promise<CaseAppeal[]> {
  try {
    let params = 'order=created_at.desc&limit=500';
    if (userId) params += `&user_id=eq.${encodeURIComponent(userId)}`;
    const data = await supabaseFetch<CaseAppeal[]>('case_appeals', 'GET', params);
    return data || [];
  } catch (error) {
    console.error("Lutheus DB Error: Failed to fetch case_appeals. This might be due to RLS policies or missing tables.", error);
    throw error;
  }
}

/**
 * Belirli bir ceza ID'sine ait itiraz kaydını getirir.
 */
export async function getAppealByCaseId(caseId: string): Promise<CaseAppeal | null> {
  try {
    const data = await supabaseFetch<CaseAppeal[]>(
      'case_appeals',
      'GET',
      `case_id=eq.${encodeURIComponent(caseId)}&limit=1`,
    );
    return data?.[0] ?? null;
  } catch (error) {
    console.error(`Lutheus DB Error: Failed to fetch appeal for case #${caseId}`, error);
    throw error;
  }
}

/**
 * Genel itiraz metriklerini hesaplar.
 */
export async function getAppealStats(): Promise<{
  total: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}> {
  try {
    const data = await supabaseFetch<CaseAppeal[]>('case_appeals', 'GET', 'order=created_at.desc&limit=2000');
    const appeals = data || [];
    const total = appeals.length;
    const approved = appeals.filter(a => a.status === 'approved').length;
    const rejected = appeals.filter(a => a.status === 'rejected').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, rejected, approvalRate };
  } catch (error) {
    console.error("Lutheus DB Error: Failed to fetch appeal stats.", error);
    throw error;
  }
}

// ─── Hadron User Tickets ────────────────────────────────────────────────────

/**
 * Tüm Hadron biletlerini getirir.
 * userId verilirse o üyenin açtığı biletler;
 * modId verilirse o yetkilinin kapattığı biletler filtrelenir.
 */
export async function getTickets(options?: {
  userId?: string;
  modId?: string;
  limit?: number;
  user_id?: string;
}): Promise<UserTicket[]> {
  try {
    const limit = options?.limit ?? 500;
    let params = `order=ticket_id.desc&limit=${limit}`;
    if (options?.userId) params += `&user_id=eq.${encodeURIComponent(options.userId)}`;
    if (options?.user_id) params += `&user_id=eq.${encodeURIComponent(options.user_id)}`;
    if (options?.modId)  params += `&assigned_mod_id=eq.${encodeURIComponent(options.modId)}`;
    const data = await supabaseFetch<UserTicket[]>('user_tickets', 'GET', params);
    return data || [];
  } catch (error) {
    console.error("Lutheus DB Error: Failed to fetch user_tickets. This might be due to RLS policies or missing tables.", error);
    throw error;
  }
}

// ─── Staff Applications ──────────────────────────────────────────────────────

export interface StaffApplication {
  id: string;
  applicant_id: string;
  status: string;
  form_type: string;
  full_name: string | null;
  discord_tag: string | null;
  email: string | null;
  raw_answers: any;
  created_at: string;
}

export async function getStaffApplications(limit = 500): Promise<StaffApplication[]> {
  try {
    const data = await supabaseFetch<StaffApplication[]>(
      'staff_applications',
      'GET',
      `order=created_at.desc&limit=${limit}`
    );
    return data || [];
  } catch (error) {
    console.error("Lutheus DB Error: Failed to fetch staff_applications.", error);
    throw error;
  }
}

export async function updateStaffApplicationStatus(
  applicantId: string,
  newStatus: string
): Promise<void> {
  try {
    await supabaseFetch(
      'staff_applications',
      'PATCH',
      `applicant_id=eq.${encodeURIComponent(applicantId)}`,
      { status: newStatus }
    );

    // Sync status change back to Google Sheet if Google Script URL is configured
    const scriptUrl = localStorage.getItem('lutheus-google-script-url');
    if (scriptUrl) {
      fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'updateStatus',
          applicantId: applicantId,
          status: newStatus
        })
      }).catch(err => console.error("Google Sheets sync status request failed:", err));
    }
  } catch (error) {
    console.error("Lutheus DB Error: Failed to update staff_application status.", error);
    throw error;
  }
}

export async function upsertStaffApplication(record: Partial<StaffApplication>): Promise<void> {
  try {
    await supabaseFetch(
      'staff_applications',
      'POST',
      '',
      record,
      { 'Prefer': 'resolution=merge-duplicates' }
    );
  } catch (error) {
    console.error("Lutheus DB Error: Failed to upsert staff_application.", error);
    throw error;
  }
}


