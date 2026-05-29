const { createClient } = require('@supabase/supabase-js');

// SECTION: SUPABASE_CLIENT
// PURPOSE: Server-side Supabase admin client using service role key.
// Required for admin API routes that bypass RLS.
// Anon key is NOT used here — RLS will silently return empty data or throw permission errors
// on protected tables (role_cache, staff_profiles, google_allowlist, audit_logs).
//
// Node 20 runtime fix: Supabase Realtime requires a WebSocket implementation.
// Node < 22 does not have native WebSocket, so we provide the 'ws' package as transport.
// Without this, createClient throws:
//   "Error: Node.js 20 detected without native WebSocket support"
// We pass ws as transport even though serverless API routes don't use Realtime subscriptions,
// because @supabase/supabase-js initializes RealtimeClient unconditionally at construction time.

let ws;
try {
    ws = require('ws');
} catch (_wsError) {
    // ws package missing — Realtime will fail but DB queries may still work in Node 22+
    console.warn('[supabaseClient] "ws" package not found. Run: npm install ws');
    ws = undefined;
}

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
// Do NOT fall back to anon/publishable key here.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    throw new Error(
        '[supabaseClient] SUPABASE_SERVICE_ROLE_KEY is required for server-side admin API routes. ' +
        'Anon key will NOT work here — RLS will block access to protected tables. ' +
        'Get the value from: Supabase Dashboard → Project Settings → API → service_role key. ' +
        'Add it to: Vercel Dashboard → Settings → Environment Variables ' +
        '(select Production + Preview + Development environments).'
    );
}

const clientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
};

// Provide ws transport to satisfy Realtime initialization on Node < 22
if (ws) {
    clientOptions.realtime = {
        transport: ws
    };
}

const supabase = createClient(supabaseUrl, supabaseKey, clientOptions);

module.exports = { supabase };
