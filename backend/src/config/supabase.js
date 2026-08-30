import { createClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================
// This module initializes the Supabase client if credentials
// are available. If credentials are missing, it safely handles
// the missing configuration and allows the server to continue.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseClient = null;
let isConfigured = false;

// Check if Supabase credentials are available
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isConfigured = true;
  } catch (error) {
    console.warn(
      "⚠️  Supabase client initialization failed:",
      error.message
    );
    supabaseClient = null;
    isConfigured = false;
  }
} else {
  console.warn(
    "⚠️  Supabase not configured. Database features will not be available."
  );
  console.warn(
    "   Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable database."
  );
  supabaseClient = null;
  isConfigured = false;
}

// ============================================================
// EXPORTS
// ============================================================

export { supabaseClient, isConfigured };

export const getSupabaseClient = () => {
  if (!isConfigured) {
    console.warn(
      "⚠️  Attempted to use Supabase client, but it is not configured."
    );
    return null;
  }
  return supabaseClient;
};

export const isSupabaseAvailable = () => {
  return isConfigured && supabaseClient !== null;
};
