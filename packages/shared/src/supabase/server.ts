import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Service-role Supabase client — bypasses RLS. Server-only (API routes /
 * Edge Functions). Never bundle this into client code: guard against
 * accidental import in a browser bundle.
 */
export function createServiceRoleSupabaseClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error(
      "createServiceRoleSupabaseClient must never run in a browser context",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
