import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EnrollForm } from "./EnrollForm";

export default async function EnrollPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("org_ansvarlig") || !ctx.orgId) redirect("/no-access");
  const orgId = ctx.orgId;

  const supabase = createServerSupabaseClient();

  const [{ data: courseVersions }, { data: orgUsers }] = await Promise.all([
    supabase
      .from("course_versions")
      .select("id, version_label, courses(title)")
      .order("version_label"),
    supabase
      .from("user_roles")
      .select("user_id, role, profiles(full_name)")
      .eq("org_id", orgId)
      .neq("role", "org_ansvarlig"),
  ]);

  const courses = (courseVersions ?? []).map((cv) => {
    const course = cv.courses as unknown as { title: string } | null;
    return {
      id: cv.id as string,
      label: `${course?.title ?? "Ukjent kurs"} (${cv.version_label})`,
    };
  });

  const seenUserIds = new Set<string>();
  const users = (orgUsers ?? [])
    .filter((row) => {
      if (seenUserIds.has(row.user_id)) return false;
      seenUserIds.add(row.user_id);
      return true;
    })
    .map((row) => ({
      id: row.user_id as string,
      label: (row.profiles as unknown as { full_name: string | null } | null)?.full_name ?? row.user_id,
    }));

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/org" className="text-sm text-blue-700 underline">
        &larr; Min organisasjon
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Meld på kurs</h1>
      <p className="mt-1 text-sm text-gray-600">
        Velg kurs og hvilke brukere i organisasjonen som skal meldes på.
      </p>
      <EnrollForm courses={courses} users={users} />
    </main>
  );
}
