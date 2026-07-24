import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ArchiveButton } from "./ArchiveButton";

const STATUS_LABELS: Record<string, string> = {
  archived: "Arkivert",
  planned: "Planlagt",
  completed: "Fullført",
  expired: "Utløpt",
  active: "Aktiv",
};

// Same derivation as /api/assignments GET (tillegg v2 §1) — status is never
// stored, so both the API and this page compute it independently from the
// same underlying fields.
function deriveStatus(
  a: { archived_at: string | null; available_from: string | null; due_at: string | null },
  stats: { total: number; satisfied: number },
): string {
  const now = Date.now();
  if (a.archived_at) return "archived";
  if (a.available_from && new Date(a.available_from).getTime() > now) return "planned";
  if (stats.total > 0 && stats.satisfied === stats.total) return "completed";
  if (a.due_at && new Date(a.due_at).getTime() < now) return "expired";
  return "active";
}

export default async function AssignmentsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("org_ansvarlig") && !ctx.roles.includes("kurs_ansvarlig")) redirect("/no-access");

  // assignments_select_org (RLS) scopes this to the caller's own org already.
  const supabase = createServerSupabaseClient();
  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, target_type, target_label, due_at, available_from, archived_at, created_at, course_versions(version_label, courses(title))",
    )
    .order("created_at", { ascending: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: enrollmentRows } =
    assignmentIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("assignment_id, course_completion(satisfied)")
          .in("assignment_id", assignmentIds)
      : { data: [] as { assignment_id: string | null; course_completion: { satisfied: boolean } | null }[] };

  const statsByAssignment = new Map<string, { total: number; satisfied: number }>();
  for (const row of enrollmentRows ?? []) {
    if (!row.assignment_id) continue;
    const stats = statsByAssignment.get(row.assignment_id) ?? { total: 0, satisfied: 0 };
    stats.total++;
    const completion = row.course_completion as unknown as { satisfied: boolean } | null;
    if (completion?.satisfied) stats.satisfied++;
    statsByAssignment.set(row.assignment_id, stats);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/org" className="text-sm text-blue-700 underline">
        &larr; Min organisasjon
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Tildelinger</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Kurs</th>
            <th className="py-2">Mål</th>
            <th className="py-2">Status</th>
            <th className="py-2">Antall</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {(assignments ?? []).map((a) => {
            const cv = a.course_versions as unknown as {
              version_label: string;
              courses: { title: string } | null;
            } | null;
            const stats = statsByAssignment.get(a.id) ?? { total: 0, satisfied: 0 };
            const status = deriveStatus(a, stats);
            return (
              <tr key={a.id} className="border-b">
                <td className="py-2">
                  {cv?.courses?.title ?? "Ukjent"} ({cv?.version_label})
                </td>
                <td className="py-2">
                  {a.target_type === "whole_org" ? "Hele org" : "Brukere"}
                  {a.target_label ? ` — ${a.target_label}` : ""}
                </td>
                <td className="py-2">{STATUS_LABELS[status]}</td>
                <td className="py-2">{stats.total}</td>
                <td className="py-2">{!a.archived_at && <ArchiveButton assignmentId={a.id} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(assignments ?? []).length === 0 && (
        <p className="mt-4 text-sm text-gray-400">Ingen tildelinger ennå.</p>
      )}
    </main>
  );
}
