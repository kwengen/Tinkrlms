import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Tillegg v2 §10: enough per course for a catalog card's CTA without a
// per-course round trip. "passed"/"failed" from the contract's enrollment
// status enum aren't distinctly tracked at the course_completion level in
// this schema (only completion_state, per-AU, has success='false') — this
// route only ever returns the subset it can honestly derive.
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const supabase = createServerSupabaseClient();

  const { data: catalogRows } = await supabase
    .from("org_course_catalog")
    .select("course_id, sort_order, courses(title, description)")
    .eq("org_id", ctx.orgId)
    .eq("enabled", true);

  const sorted = [...(catalogRows ?? [])].sort((a, b) => {
    if (a.sort_order === b.sort_order) return 0;
    if (a.sort_order === null) return 1;
    if (b.sort_order === null) return -1;
    return a.sort_order - b.sort_order;
  });

  const courseIds = sorted.map((r) => r.course_id as string);
  const { data: activeVersions } =
    courseIds.length > 0
      ? await supabase
          .from("course_active_versions")
          .select("course_id, course_version_id, version_label")
          .in("course_id", courseIds)
      : { data: [] as { course_id: string; course_version_id: string; version_label: string }[] };
  const versionByCourseId = new Map((activeVersions ?? []).map((v) => [v.course_id, v]));

  const versionIds = [...versionByCourseId.values()].map((v) => v.course_version_id);
  const { data: myEnrollments } =
    versionIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("id, course_version_id")
          .eq("user_id", ctx.userId)
          .in("course_version_id", versionIds)
      : { data: [] as { id: string; course_version_id: string }[] };
  const enrollmentByVersionId = new Map((myEnrollments ?? []).map((e) => [e.course_version_id, e]));

  const enrollmentIds = [...enrollmentByVersionId.values()].map((e) => e.id);
  const { data: completions } =
    enrollmentIds.length > 0
      ? await supabase
          .from("course_completion")
          .select("enrollment_id, status, satisfied")
          .in("enrollment_id", enrollmentIds)
      : { data: [] as { enrollment_id: string; status: string; satisfied: boolean }[] };
  const completionByEnrollmentId = new Map((completions ?? []).map((c) => [c.enrollment_id, c]));

  const result = sorted.map((row) => {
    const course = row.courses as unknown as { title: string; description: string | null } | null;
    const version = versionByCourseId.get(row.course_id);
    const enrollment = version ? enrollmentByVersionId.get(version.course_version_id) : undefined;
    const completion = enrollment ? completionByEnrollmentId.get(enrollment.id) : undefined;

    let enrollmentStatus: "not_enrolled" | "not_started" | "in_progress" | "completed" = "not_enrolled";
    if (enrollment) {
      if (completion?.status === "in_progress") enrollmentStatus = "in_progress";
      else if (completion?.status === "completed" && completion.satisfied) enrollmentStatus = "completed";
      else enrollmentStatus = "not_started";
    }

    return {
      courseId: row.course_id,
      title: course?.title ?? "Ukjent kurs",
      description: course?.description ?? null,
      activeVersionId: version?.course_version_id ?? null,
      catalogEnabled: true,
      sortOrder: row.sort_order,
      enrollmentStatus,
      enrollmentId: enrollment?.id ?? null,
    };
  });

  return NextResponse.json(result);
}
