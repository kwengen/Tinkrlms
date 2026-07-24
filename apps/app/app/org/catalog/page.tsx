import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CatalogToggleRow } from "./CatalogToggleRow";

export default async function OrgCatalogPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("org_ansvarlig") || !ctx.orgId) redirect("/no-access");
  const orgId = ctx.orgId;

  const supabase = createServerSupabaseClient();
  const [{ data: courses }, { data: catalogRows }] = await Promise.all([
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("org_course_catalog").select("course_id, enabled, sort_order").eq("org_id", orgId),
  ]);
  const catalogByCourseId = new Map((catalogRows ?? []).map((r) => [r.course_id, r]));

  const rows = (courses ?? []).map((c) => {
    const entry = catalogByCourseId.get(c.id);
    return { courseId: c.id, title: c.title, enabled: entry?.enabled ?? false, sortOrder: entry?.sort_order ?? null };
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/org" className="text-sm text-blue-700 underline">
        &larr; Min organisasjon
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Kurskatalog</h1>
      <p className="mt-1 text-sm text-gray-600">
        Kurs merket «Aktivert» kan brukere i organisasjonen melde seg på selv, under «Kurskatalog» i Mine kurs.
        Å deaktivere et kurs fjerner ikke eksisterende påmeldinger eller historikk.
      </p>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Kurs</th>
            <th className="py-2">Rekkefølge</th>
            <th className="py-2">Aktivert</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <CatalogToggleRow key={r.courseId} {...r} />
          ))}
        </tbody>
      </table>
    </main>
  );
}
