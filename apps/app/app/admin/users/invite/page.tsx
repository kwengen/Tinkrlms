import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InviteUserForm } from "./InviteUserForm";

export default async function InviteUserPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const isSuperadmin = ctx.roles.includes("superadmin");
  const isOrgAnsvarlig = ctx.roles.includes("org_ansvarlig");
  if (!isSuperadmin && !isOrgAnsvarlig) redirect("/no-access");

  let organizations: { id: string; name: string }[] = [];
  if (isSuperadmin) {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("organizations").select("id, name").order("name");
    organizations = data ?? [];
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Inviter bruker</h1>
      <InviteUserForm isSuperadmin={isSuperadmin} organizations={organizations} />
    </main>
  );
}
