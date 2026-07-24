import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SelfEnrollButton } from "./SelfEnrollButton";

export default async function CatalogPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("bruker")) redirect("/no-access");
  if (!ctx.orgId) redirect("/no-access");

  const supabase = createServerSupabaseClient();

  const { data: catalogRows } = await supabase
    .from("org_course_catalog")
    .select("course_id, sort_order, courses(title, description)")
    .eq("org_id", ctx.orgId)
    .eq("enabled", true);

  const sorted = [...(catalogRows ?? [])].sort((a, b) => {
    if (a.sort_order === b.sort_order) return 0;
    if (a.sort_order === null) return 1;
    if (b.sort_order === null) return -1;
    return a.sort_order - b.sort_order;
  });

  const courseIds = sorted.map((r) => r.course_id as string);
  const { data: activeVersions } =
    courseIds.length > 0
      ? await supabase
          .from("course_active_versions")
          .select("course_id, course_version_id, version_label")
          .in("course_id", courseIds)
      : { data: [] as { course_id: string; course_version_id: string; version_label: string }[] };
  const versionByCourseId = new Map((activeVersions ?? []).map((v) => [v.course_id, v]));

  const versionIds = [...versionByCourseId.values()].map((v) => v.course_version_id);
  const { data: myEnrollments } =
    versionIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("id, course_version_id")
          .eq("user_id", ctx.userId)
          .in("course_version_id", versionIds)
      : { data: [] as { id: string; course_version_id: string }[] };
  const enrollmentByVersionId = new Map((myEnrollments ?? []).map((e) => [e.course_version_id, e]));

  const courses = sorted.map((row) => {
    const course = row.courses as unknown as { title: string; description: string | null } | null;
    const version = versionByCourseId.get(row.course_id);
    const enrollment = version ? enrollmentByVersionId.get(version.course_version_id) : undefined;
    return {
      courseId: row.course_id as string,
      title: course?.title ?? "Ukjent kurs",
      description: course?.description ?? null,
      enrollmentId: enrollment?.id ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/learn" className="text-sm text-blue-700 underline">
        &larr; Mine kurs
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Kurskatalog</h1>
      <ul className="mt-6 flex flex-col gap-2">
        {courses.map((c) => (
          <li key={c.courseId} className="flex items-center justify-between rounded border p-4">
            <div>
              <p className="font-medium">{c.title}</p>
              {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
            </div>
            {c.enrollmentId ? (
              <Link
                href={`/learn/${c.enrollmentId}`}
                className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
              >
                Gå til kurs
              </Link>
            ) : (
              <SelfEnrollButton courseId={c.courseId} />
            )}
          </li>
        ))}
      </ul>
      {courses.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">Ingen kurs tilgjengelig for selvpåmelding ennå.</p>
      )}
    </main>
  );
}
