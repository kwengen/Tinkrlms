import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  courseVersionId: z.string().uuid(),
  targetType: z.enum(["users", "groups", "whole_org"]),
  userIds: z.array(z.string().uuid()).optional(),
  targetLabel: z.string().optional(),
  isMandatory: z.boolean().optional(),
  visibleInDashboard: z.boolean().optional(),
  availableFrom: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

async function requireOrgAnsvarlig(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { ok: false as const, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("org_id")
    .eq("user_id", caller.id)
    .eq("role", "org_ansvarlig");
  const orgId = roleRows?.[0]?.org_id;
  if (!orgId) return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { ok: true as const, caller, orgId };
}

// Derived status (tillegg v2 §1) — never stored. "Fullført" requires ALL
// linked enrollments satisfied; the doc's "eller terskelverdi" (configurable
// threshold) option isn't built — flagging, not guessing a fraction.
function deriveStatus(
  a: { archived_at: string | null; available_from: string | null; due_at: string | null },
  stats: { total: number; satisfied: number },
): string {
  const now = Date.now();
  if (a.archived_at) return "archived";
  if (a.available_from && new Date(a.available_from).getTime() > now) return "planned";
  if (stats.total > 0 && stats.satisfied === stats.total) return "completed";
  if (a.due_at && new Date(a.due_at).getTime() < now) return "expired";
  return "active";
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const auth = await requireOrgAnsvarlig(supabase);
  if (!auth.ok) return auth.response;

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: enrollmentRows } =
    assignmentIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("assignment_id, course_completion(satisfied)")
          .in("assignment_id", assignmentIds)
      : { data: [] as { assignment_id: string | null; course_completion: { satisfied: boolean } | null }[] };

  const statsByAssignment = new Map<string, { total: number; satisfied: number }>();
  for (const row of enrollmentRows ?? []) {
    if (!row.assignment_id) continue;
    const stats = statsByAssignment.get(row.assignment_id) ?? { total: 0, satisfied: 0 };
    stats.total++;
    const completion = row.course_completion as unknown as { satisfied: boolean } | null;
    if (completion?.satisfied) stats.satisfied++;
    statsByAssignment.set(row.assignment_id, stats);
  }

  const result = (assignments ?? []).map((a) => {
    const stats = statsByAssignment.get(a.id) ?? { total: 0, satisfied: 0 };
    return { ...a, status: deriveStatus(a, stats), targetCount: stats.total };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const auth = await requireOrgAnsvarlig(supabase);
  if (!auth.ok) return auth.response;

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;

  if (fields.targetType === "groups") {
    // Tillegg §1: groups is reserved for Phase 2 — groups don't exist yet.
    return NextResponse.json({ error: "Group targeting is not available yet" }, { status: 400 });
  }

  let targetUserIds: string[];
  if (fields.targetType === "whole_org") {
    const { data: members } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("org_id", auth.orgId)
      .eq("role", "bruker");
    targetUserIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  } else {
    if (!fields.userIds || fields.userIds.length === 0) {
      return NextResponse.json({ error: "userIds is required for targetType 'users'" }, { status: 400 });
    }
    const { data: memberRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("org_id", auth.orgId)
      .in("user_id", fields.userIds);
    const memberIds = new Set((memberRows ?? []).map((r) => r.user_id));
    const notInOrg = fields.userIds.filter((id) => !memberIds.has(id));
    if (notInOrg.length > 0) {
      return NextResponse.json({ error: "Some userIds are not members of your organization", notInOrg }, { status: 400 });
    }
    targetUserIds = [...new Set(fields.userIds)];
  }

  const { data: assignment, error: insertError } = await supabase
    .from("assignments")
    .insert({
      org_id: auth.orgId,
      course_version_id: fields.courseVersionId,
      created_by: auth.caller.id,
      target_type: fields.targetType,
      target_label: fields.targetLabel ?? null,
      is_mandatory: fields.isMandatory ?? true,
      visible_in_dashboard: fields.visibleInDashboard ?? true,
      available_from: fields.availableFrom ?? null,
      due_at: fields.dueAt ?? null,
    })
    .select("*")
    .single();
  if (insertError || !assignment) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create assignment" }, { status: 500 });
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ assignment, overlappingUsers: [] });
  }

  // Atomic per-user create-or-link (tillegg §1/§4) — see assign_enrollments()'s
  // own comment for why overlap is reported, not blocked.
  const { data: linkResults, error: linkError } = await supabase.rpc("assign_enrollments", {
    p_assignment_id: assignment.id,
    p_user_ids: targetUserIds,
  });
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const overlappingUsers = (linkResults ?? [])
    .filter((r) => r.had_other_assignment)
    .map((r) => r.user_id);

  return NextResponse.json({ assignment, overlappingUsers });
}
