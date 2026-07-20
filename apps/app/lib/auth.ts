import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@tinkr/shared";

export interface CurrentUserContext {
  userId: string;
  email: string | undefined;
  fullName: string | null;
  orgId: string | null;
  roles: Role[];
}

/**
 * Server-side helper for pages/route handlers: current user + their roles +
 * denormalized org (see profiles.org_id caveat in the tenancy migration —
 * user_roles remains authoritative, this is just for display).
 * Returns null if there is no session (middleware should already have
 * redirected unauthenticated requests to /login before a page calls this).
 */
export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, org_id").eq("user_id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    email: user.email,
    fullName: profile?.full_name ?? null,
    orgId: profile?.org_id ?? null,
    roles: (roleRows ?? []).map((r) => r.role as Role),
  };
}
