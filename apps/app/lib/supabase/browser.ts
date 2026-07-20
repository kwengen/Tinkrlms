import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@tinkr/shared";

/**
 * Browser client for Client Components. Reads/writes the session via
 * cookies (shared with the server client through @supabase/ssr), so the
 * session survives server-rendered navigations.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
