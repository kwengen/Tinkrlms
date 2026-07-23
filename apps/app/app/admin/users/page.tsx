import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { PseudonymizeButton } from "./PseudonymizeButton";

export default async function AdminUsersPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("superadmin")) redirect("/no-access");

  // Superadmin-only cross-tenant listing — service role by design, same as
  // the invite-user/import-course routes.
  const admin = getServiceRoleSupabaseClient();
  const [{ data: profiles }, { data: roles }, { data: orgs }] = await Promise.all([
    admin.from("profiles").select("user_id, full_name, org_id, pseudonymized_at").order("full_name"),
    admin.from("user_roles").select("user_id, role"),
    admin.from("organizations").select("id, name"),
  ]);

  const orgNameById = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/admin" className="text-sm text-blue-700 underline">
        &larr; Plattformadmin
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Brukere</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Navn</th>
            <th className="py-2">Organisasjon</th>
            <th className="py-2">Roller</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p) => (
            <tr key={p.user_id} className="border-b">
              <td className="py-2">
                {p.pseudonymized_at ? (
                  <span className="text-gray-400">Slettet bruker</span>
                ) : (
                  p.full_name ?? p.user_id
                )}
              </td>
              <td className="py-2">{p.org_id ? orgNameById.get(p.org_id) ?? "Ukjent" : "—"}</td>
              <td className="py-2">{(rolesByUser.get(p.user_id) ?? []).join(", ")}</td>
              <td className="py-2">{!p.pseudonymized_at && <PseudonymizeButton userId={p.user_id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
