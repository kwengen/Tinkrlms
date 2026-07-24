import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUserContext } from "@/lib/auth";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

const requestSchema = z.object({ course_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { course_id } = parsed.data;

  // Service role, not the session client (tillegg v2 §6): a plain bruker has
  // no write policy on enrollments at all — self-enroll's authorization
  // check is right here (catalog enabled for this org), not RLS.
  const admin = getServiceRoleSupabaseClient();

  const { data: catalogEntry } = await admin
    .from("org_course_catalog")
    .select("enabled")
    .eq("org_id", ctx.orgId)
    .eq("course_id", course_id)
    .maybeSingle();
  if (!catalogEntry?.enabled) {
    return NextResponse.json({ error: "Course is not enabled for self-enrollment in your organization" }, { status: 403 });
  }

  const { data: activeVersion } = await admin
    .from("course_active_versions")
    .select("course_version_id")
    .eq("course_id", course_id)
    .maybeSingle();
  if (!activeVersion) {
    return NextResponse.json({ error: "Course has no version yet" }, { status: 404 });
  }

  // Idempotent find-or-create (tillegg §4/§6): a double-click or retry never
  // creates a second row, and assignment_id is left untouched either way
  // (self-enroll never sets it — see enrollments_org_user_course_version_key).
  const { data: existing } = await admin
    .from("enrollments")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .eq("course_version_id", activeVersion.course_version_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ enrollmentId: existing.id });
  }

  const { data: created, error } = await admin
    .from("enrollments")
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      course_version_id: activeVersion.course_version_id,
    })
    .select("id")
    .single();
  if (error || !created) {
    // A concurrent self-enroll request could race between the check above
    // and this insert; the unique constraint on
    // (org_id, user_id, course_version_id) would reject the loser here —
    // re-select rather than surface it as a user-facing error.
    const { data: raceWinner } = await admin
      .from("enrollments")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.userId)
      .eq("course_version_id", activeVersion.course_version_id)
      .maybeSingle();
    if (raceWinner) return NextResponse.json({ enrollmentId: raceWinner.id });
    return NextResponse.json({ error: error?.message ?? "Failed to enroll" }, { status: 500 });
  }

  return NextResponse.json({ enrollmentId: created.id });
}
