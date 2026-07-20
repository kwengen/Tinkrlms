import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ROLES, type Role } from "@tinkr/shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

// org_ansvarlig can only invite people INTO their own org, and only into
// org-scoped roles (not org_ansvarlig/kundeadmin/superadmin) — own call, not
// spelled out verbatim in bestilling §6, but follows from "org_ansvarlig:
// egen orgs brukere" and keeps privilege escalation out of this endpoint.
const ORG_ANSVARLIG_ASSIGNABLE_ROLES: Role[] = ["kurs_ansvarlig", "bruker"];

const requestSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(ROLES),
  // Only superadmin may set this; ignored (and overridden) for org_ansvarlig callers.
  org_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user: caller },
  } = await sessionClient.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerRoles } = await sessionClient
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", caller.id);

  const isSuperadmin = (callerRoles ?? []).some((r) => r.role === "superadmin");
  const orgAnsvarligRow = (callerRoles ?? []).find((r) => r.role === "org_ansvarlig");

  if (!isSuperadmin && !orgAnsvarligRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, full_name, role } = parsed.data;

  let targetOrgId: string | null;
  if (isSuperadmin) {
    if (role === "superadmin" || role === "kundeadmin") {
      targetOrgId = null;
    } else if (!parsed.data.org_id) {
      return NextResponse.json(
        { error: "org_id is required for org-scoped roles" },
        { status: 400 },
      );
    } else {
      targetOrgId = parsed.data.org_id;
    }
  } else {
    // org_ansvarlig: org is forced to their own, role is restricted.
    if (!ORG_ANSVARLIG_ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `org_ansvarlig may only assign: ${ORG_ANSVARLIG_ASSIGNABLE_ROLES.join(", ")}` },
        { status: 403 },
      );
    }
    targetOrgId = orgAnsvarligRow!.org_id;
  }

  const admin = getServiceRoleSupabaseClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name },
      redirectTo: `${process.env.APP_ORIGIN}/auth/callback`,
    },
  );

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Failed to invite user" },
      { status: 400 },
    );
  }

  const newUserId = invited.user.id;

  // handle_new_user() (DB trigger) already created the profiles row with
  // org_id = null; set it here for org-scoped roles (denormalized
  // convenience column — user_roles below is what RLS actually relies on).
  if (targetOrgId) {
    await admin.from("profiles").update({ org_id: targetOrgId }).eq("user_id", newUserId);
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: newUserId, role, org_id: targetOrgId });

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 400 });
  }

  return NextResponse.json({ user_id: newUserId, email, role, org_id: targetOrgId });
}
