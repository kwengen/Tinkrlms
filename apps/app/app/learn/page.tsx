import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function LearnPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("bruker")) redirect("/no-access");

  const supabase = createServerSupabaseClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, course_version_id, course_versions(version_label, courses(title))")
    .eq("user_id", ctx.userId)
    .eq("status", "active");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mine kurs</h1>
        <SignOutButton />
      </div>
      <p className="mt-2 text-gray-600">Innlogget som {ctx.fullName ?? ctx.email}.</p>
      <Link href="/learn/catalog" className="mt-2 inline-block text-sm text-blue-700 underline">
        Kurskatalog (meld deg på flere kurs)
      </Link>

      <ul className="mt-6 flex flex-col gap-2">
        {(enrollments ?? []).map((e) => {
          const courseVersion = e.course_versions as unknown as {
            version_label: string;
            courses: { title: string } | null;
          } | null;
          return (
            <li key={e.id} className="rounded border p-4">
              <Link href={`/learn/${e.id}`} className="font-medium text-blue-700 underline">
                {courseVersion?.courses?.title ?? "Ukjent kurs"}
              </Link>
              <span className="ml-2 text-sm text-gray-500">({courseVersion?.version_label})</span>
            </li>
          );
        })}
        {(enrollments ?? []).length === 0 && (
          <li className="text-sm text-gray-400">Du er ikke meldt på noen kurs ennå.</li>
        )}
      </ul>
    </main>
  );
}
