const { createClient } = require('@supabase/supabase-js');

// SECTION: SUPABASE_CLIENT
// PURPOSE: Server-side Supabase client using service role key. Required for admin API routes
// that bypass RLS. Anon key is NOT acceptable here — RLS will silently return empty data
// or throw permission errors on protected tables (role_cache, staff_profiles, etc.).

const supabaseUrl = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    '[supabaseClient] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required. ' +
    'Set it in Vercel Dashboard → Settings → Environment Variables.'
  );
}

// Admin API routes MUST use service role key to bypass RLS.
// If SUPABASE_SERVICE_ROLE_KEY is not set, admin endpoints will silently return
// empty data or throw 403/500 due to RLS policies on role_cache / staff_profiles.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error(
    '[supabaseClient] SUPABASE_SERVICE_ROLE_KEY is required for server-side admin API routes. ' +
    'Anon key will NOT work here — RLS will block access to protected tables. ' +
    'Set SUPABASE_SERVICE_ROLE_KEY in Vercel Dashboard → Settings → Environment Variables.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = { supabase };
