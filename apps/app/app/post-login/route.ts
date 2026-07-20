import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@tinkr/shared";

// Where each role lands, in priority order (a user can hold roles at
// multiple "levels" in theory — platform staff always wins over org roles).
const ROLE_LANDING: Array<{ roles: Role[]; path: string }> = [
  { roles: ["superadmin", "kundeadmin"], path: "/admin" },
  { roles: ["org_ansvarlig", "kurs_ansvarlig"], path: "/org" },
  { roles: ["bruker"], path: "/learn" },
];

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // user_roles_select_own (RLS) lets a user read only their own rows here.
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const heldRoles = new Set((roles ?? []).map((r) => r.role as Role));

  for (const { roles: candidateRoles, path } of ROLE_LANDING) {
    if (candidateRoles.some((r) => heldRoles.has(r))) {
      return NextResponse.redirect(new URL(path, request.url));
    }
  }

  return NextResponse.redirect(new URL("/no-access", request.url));
}
