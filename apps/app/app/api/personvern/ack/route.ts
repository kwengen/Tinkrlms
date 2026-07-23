import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export async function POST() {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Service role + upsert, not a plain session-client UPDATE: there is no
  // INSERT policy on profiles for regular users (only handle_new_user(),
  // SECURITY DEFINER, is meant to create that row), and a user whose
  // auth.users row predates that trigger has no profiles row at all — a
  // plain UPDATE against a missing row "succeeds" with zero rows affected,
  // silently discarding the acknowledgment while looking fine to the
  // caller. Upsert here is safe: userId comes from the verified session,
  // never from client input.
  const admin = getServiceRoleSupabaseClient();
  const { error } = await admin.from("profiles").upsert(
    {
      user_id: user.id,
      privacy_notice_ack_at: new Date().toISOString(),
      privacy_notice_version: CURRENT_PRIVACY_NOTICE_VERSION,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
