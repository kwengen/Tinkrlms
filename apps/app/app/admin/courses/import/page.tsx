import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ImportCourseForm } from "./ImportCourseForm";

export default async function ImportCoursePage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("superadmin")) redirect("/no-access");

  const supabase = createServerSupabaseClient();
  const { data: courses } = await supabase.from("courses").select("id, title").order("title");

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Importer cmi5-kurs</h1>
      <ImportCourseForm courses={courses ?? []} />
    </main>
  );
}
