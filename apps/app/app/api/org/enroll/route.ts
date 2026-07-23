import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  courseVersionId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerRoles } = await supabase
    .from("user_roles")
    .select("org_id")
    .eq("user_id", caller.id)
    .eq("role", "org_ansvarlig");
  const orgId = callerRoles?.[0]?.org_id;
  if (!orgId) {
    // Kurstildeling er org_ansvarlig-only (bestilling §6) — kurs_ansvarlig
    // has read access to results but no write policy on enrollments.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { courseVersionId, userIds } = parsed.data;

  // Guard against enrolling a user_id that isn't actually a member of this
  // org: enrollments_write_org_ansvarlig (RLS) only checks the ENROLLMENT
  // row's org_id, not that user_id itself belongs there — an org_ansvarlig
  // could otherwise cross-tenant-enroll an arbitrary existing user id.
  const { data: memberRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("org_id", orgId)
    .in("user_id", userIds);
  const memberIds = new Set((memberRows ?? []).map((r) => r.user_id));

  const results: { userId: string; status: "enrolled" | "already_enrolled" | "not_in_org" | "error" }[] = [];

  for (const userId of userIds) {
    if (!memberIds.has(userId)) {
      results.push({ userId, status: "not_in_org" });
      continue;
    }

    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_version_id", courseVersionId)
      .eq("status", "active")
      .maybeSingle();
    if (existing) {
      results.push({ userId, status: "already_enrolled" });
      continue;
    }

    const { error } = await supabase.from("enrollments").insert({
      org_id: orgId,
      user_id: userId,
      course_version_id: courseVersionId,
      assigned_by: caller.id,
    });
    results.push({ userId, status: error ? "error" : "enrolled" });
  }

  return NextResponse.json({ results });
}
