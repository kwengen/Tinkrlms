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

  const [{ data: courseVersions }, { data: orgRoles }] = await Promise.all([
    supabase
      .from("course_versions")
      .select("id, version_label, courses(title)")
      .order("version_label"),
    supabase
      .from("user_roles")
      .select("user_id")
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

  // user_roles and profiles are siblings (both FK to auth.users, not to
  // each other) — PostgREST can't auto-embed across that, so profiles are
  // fetched separately and merged here rather than via .select("profiles(...)").
  const userIds = [...new Set((orgRoles ?? []).map((r) => r.user_id as string))];
  const { data: orgProfiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as { user_id: string; full_name: string | null }[] };
  const fullNameByUserId = new Map((orgProfiles ?? []).map((p) => [p.user_id, p.full_name]));
  const users = userIds.map((id) => ({ id, label: fullNameByUserId.get(id) ?? id }));

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
