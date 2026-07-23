import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EnrollmentPage({
  params,
}: {
  params: { enrollmentId: string };
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("bruker")) redirect("/no-access");

  const supabase = createServerSupabaseClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, course_version_id, course_versions(courses(title))")
    .eq("id", params.enrollmentId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!enrollment) redirect("/learn");

  const [{ data: aus }, { data: completion }] = await Promise.all([
    supabase
      .from("assignable_units")
      .select("id, au_index, launch_url, move_on")
      .eq("course_version_id", enrollment.course_version_id)
      .order("au_index"),
    supabase
      .from("course_completion")
      .select("satisfied, certificate_id, certificates(cert_uuid)")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
  ]);

  const courseVersion = enrollment.course_versions as unknown as {
    courses: { title: string } | null;
  } | null;
  const certUuid = (completion?.certificates as unknown as { cert_uuid: string } | null)?.cert_uuid;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/learn" className="text-sm text-blue-700 underline">
        &larr; Mine kurs
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{courseVersion?.courses?.title ?? "Kurs"}</h1>

      {completion?.satisfied && certUuid && (
        <a
          href={`/api/certificates/${certUuid}/download`}
          className="mt-4 inline-block rounded border border-green-700 px-3 py-1 text-sm text-green-700"
        >
          Last ned kursbevis
        </a>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {(aus ?? []).map((au) => (
          <li key={au.id} className="flex items-center justify-between rounded border p-4">
            <span>Modul {au.au_index + 1}</span>
            <Link
              href={`/learn/play/${au.id}`}
              className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
            >
              Start
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
