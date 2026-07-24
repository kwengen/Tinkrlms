import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  enabled: z.boolean(),
  sortOrder: z.number().int().nullable().optional(),
  // Only used by kundeadmin/superadmin, who manage more than one org;
  // org_ansvarlig's own org is always used instead, regardless of this field.
  orgId: z.string().uuid().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;

  const { data: orgAnsvarligRows } = await supabase
    .from("user_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "org_ansvarlig");
  const orgId = orgAnsvarligRows?.[0]?.org_id ?? fields.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  // org_course_catalog_write_* (RLS) enforces the caller actually has write
  // access to this org — no separate check needed here.
  const { data: upserted, error } = await supabase
    .from("org_course_catalog")
    .upsert(
      {
        org_id: orgId,
        course_id: params.courseId,
        enabled: fields.enabled,
        sort_order: fields.sortOrder ?? null,
        ...(fields.enabled
          ? { enabled_by: user.id, enabled_at: now }
          : { disabled_by: user.id, disabled_at: now }),
      },
      { onConflict: "org_id,course_id" },
    )
    .select("*")
    .single();
  if (error || !upserted) {
    return NextResponse.json({ error: error?.message ?? "Failed to update catalog entry" }, { status: 500 });
  }

  return NextResponse.json(upserted);
}
