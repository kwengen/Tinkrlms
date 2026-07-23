"use client";

import { useState } from "react";

type ResultStatus = "enrolled" | "already_enrolled" | "not_in_org" | "error";

const STATUS_LABELS: Record<ResultStatus, string> = {
  enrolled: "Meldt på",
  already_enrolled: "Var allerede påmeldt",
  not_in_org: "Ikke medlem av organisasjonen",
  error: "Feil ved påmelding",
};

export function EnrollForm({
  courses,
  users,
}: {
  courses: { id: string; label: string }[];
  users: { id: string; label: string }[];
}) {
  const [courseVersionId, setCourseVersionId] = useState(courses[0]?.id ?? "");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ userId: string; status: ResultStatus }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    if (!courseVersionId || selectedUserIds.size === 0) {
      setError("Velg kurs og minst én bruker.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/org/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseVersionId, userIds: [...selectedUserIds] }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? body.error ?? res.statusText);
      return;
    }
    const body = await res.json();
    setResults(body.results);
    setSelectedUserIds(new Set());
  }

  if (courses.length === 0) {
    return <p className="mt-6 text-sm text-gray-400">Ingen kurs i katalogen ennå.</p>;
  }
  if (users.length === 0) {
    return <p className="mt-6 text-sm text-gray-400">Ingen brukere i organisasjonen ennå.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Kurs
        <select
          value={courseVersionId}
          onChange={(e) => setCourseVersionId(e.target.value)}
          className="rounded border px-3 py-2"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="rounded border p-3">
        <legend className="px-1 text-sm font-medium">Brukere</legend>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedUserIds.has(u.id)}
                onChange={() => toggleUser(u.id)}
              />
              {u.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
      >
        Meld på {selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}
      </button>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {results && (
        <ul className="text-sm">
          {results.map((r) => {
            const user = users.find((u) => u.id === r.userId);
            return (
              <li key={r.userId}>
                {user?.label ?? r.userId}: {STATUS_LABELS[r.status]}
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
