import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Database } from "@tinkr/shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AssignmentUpdate = Database["public"]["Tables"]["assignments"]["Update"];

const patchSchema = z.object({
  targetLabel: z.string().optional(),
  isMandatory: z.boolean().optional(),
  visibleInDashboard: z.boolean().optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

// assignments_select_org / assignments_write_org_ansvarlig (RLS) already
// scope these to the caller's own org — no extra role check needed beyond
// authentication itself.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", params.id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(assignment);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;

  const update: AssignmentUpdate = {};
  if (fields.targetLabel !== undefined) update.target_label = fields.targetLabel;
  if (fields.isMandatory !== undefined) update.is_mandatory = fields.isMandatory;
  if (fields.visibleInDashboard !== undefined) update.visible_in_dashboard = fields.visibleInDashboard;
  if (fields.availableFrom !== undefined) update.available_from = fields.availableFrom;
  if (fields.dueAt !== undefined) update.due_at = fields.dueAt;

  const { data: updated, error } = await supabase
    .from("assignments")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}
