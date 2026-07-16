import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Browser/client-side Supabase client. Uses the anon key — RLS is the only
 * authorization boundary here. Never import this with the service role key.
 */
export function createBrowserSupabaseClient(
  url: string,
  anonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
