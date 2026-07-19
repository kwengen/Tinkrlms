import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@tinkr/shared";

/**
 * Session-aware server client for Server Components / Route Handlers /
 * Server Actions. Uses the anon key + the caller's cookie-based session —
 * RLS is the authorization boundary, exactly like the browser client.
 * Never pass the service role key to this factory.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — middleware refreshes
            // the session cookie on the next request instead. Safe to ignore.
          }
        },
      },
    },
  );
}
