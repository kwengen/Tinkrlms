import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

// A very long ban duration is Supabase Auth's documented way to effectively
// permanently disable a login — there is no literal "forever" value.
const PERMANENT_BAN_DURATION = "876000h"; // 100 years

export async function POST(_request: NextRequest, { params }: { params: { userId: string } }) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user: caller },
  } = await sessionClient.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerRoles } = await sessionClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);
  const isSuperadmin = (callerRoles ?? []).some((r) => r.role === "superadmin");
  if (!isSuperadmin) {
    // Right-to-erasure requests are handled by superadmin only in v1 — this
    // revokes a login and scrubs a profile platform-wide, a more sensitive
    // operation than anything org_ansvarlig is trusted with elsewhere.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = params;
  const admin = getServiceRoleSupabaseClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, pseudonymized_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (profile.pseudonymized_at) {
    return NextResponse.json({ error: "Already pseudonymized" }, { status: 409 });
  }

  // Revoke login + scrub the one PII field auth.users itself holds (email).
  // NOT admin.auth.admin.deleteUser(): enrollments/registrations/etc.
  // reference auth.users(id) WITHOUT cascade (deliberately — bestilling §9's
  // legal-obligation retention need), so a hard delete would fail with a
  // foreign key violation for any user with training history anyway.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@deleted.invalid`,
    user_metadata: {},
    ban_duration: PERMANENT_BAN_DURATION,
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({ full_name: null, pseudonymized_at: new Date().toISOString() })
    .eq("user_id", userId);

  await admin.from("audit_log").insert({
    org_id: profile.org_id,
    actor_user_id: caller.id,
    action: "user_pseudonymized",
    target: userId,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
