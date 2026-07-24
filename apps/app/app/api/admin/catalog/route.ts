import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * All courses in the central catalog, alongside this org's
 * org_course_catalog state (enabled/sort_order) if any — courses with no
 * row yet show as disabled/unordered. org_ansvarlig always sees their own
 * org; kundeadmin/superadmin must pass ?orgId= (RLS on org_course_catalog
 * silently returns nothing for an org they can't access, rather than this
 * route needing its own access check).
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: orgAnsvarligRows } = await supabase
    .from("user_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "org_ansvarlig");
  const ownOrgId = orgAnsvarligRows?.[0]?.org_id;

  const queryOrgId = request.nextUrl.searchParams.get("orgId");
  const orgId = ownOrgId ?? queryOrgId;
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const [{ data: courses }, { data: catalogRows }] = await Promise.all([
    supabase.from("courses").select("id, title, description").order("title"),
    supabase.from("org_course_catalog").select("course_id, enabled, sort_order").eq("org_id", orgId),
  ]);

  const catalogByCourseId = new Map((catalogRows ?? []).map((r) => [r.course_id, r]));

  const result = (courses ?? []).map((c) => {
    const entry = catalogByCourseId.get(c.id);
    return {
      courseId: c.id,
      title: c.title,
      description: c.description,
      enabled: entry?.enabled ?? false,
      sortOrder: entry?.sort_order ?? null,
    };
  });

  return NextResponse.json(result);
}
