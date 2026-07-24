"use client";

import { useState } from "react";

export function EnrollForm({
  courses,
  users,
}: {
  courses: { id: string; label: string }[];
  users: { id: string; label: string }[];
}) {
  const [courseVersionId, setCourseVersionId] = useState(courses[0]?.id ?? "");
  const [wholeOrg, setWholeOrg] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [availableFrom, setAvailableFrom] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { kind: "ok"; overlappingUsers: string[] } | { kind: "error"; message: string } | null
  >(null);

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
    setResult(null);
    if (!courseVersionId || (!wholeOrg && selectedUserIds.size === 0)) {
      setResult({ kind: "error", message: "Velg kurs, og enten «hele organisasjonen» eller minst én bruker." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseVersionId,
          targetType: wholeOrg ? "whole_org" : "users",
          ...(wholeOrg ? {} : { userIds: [...selectedUserIds] }),
          ...(availableFrom ? { availableFrom: new Date(availableFrom).toISOString() } : {}),
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({ kind: "error", message: body.error?.message ?? body.error ?? res.statusText });
        return;
      }
      const body = await res.json();
      setResult({ kind: "ok", overlappingUsers: body.overlappingUsers ?? [] });
      setSelectedUserIds(new Set());
    } catch (e) {
      setResult({ kind: "error", message: `Nettverksfeil: ${String(e)}` });
    } finally {
      setSubmitting(false);
    }
  }

  if (courses.length === 0) {
    return <p className="mt-6 text-sm text-gray-400">Ingen kurs i katalogen ennå.</p>;
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wholeOrg} onChange={(e) => setWholeOrg(e.target.checked)} />
        Hele organisasjonen (fanger også opp nye brukere som legges til senere)
      </label>

      {!wholeOrg &&
        (users.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen brukere i organisasjonen ennå.</p>
        ) : (
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
        ))}

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Tilgjengelig fra (valgfritt)
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Frist (valgfritt)
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
      >
        {wholeOrg ? "Meld på hele organisasjonen" : `Meld på ${selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}`}
      </button>

      {result?.kind === "error" && <p className="text-sm text-red-700">{result.message}</p>}
      {result?.kind === "ok" && (
        <div className="text-sm">
          <p className="text-green-700">Tildeling opprettet.</p>
          {result.overlappingUsers.length > 0 && (
            <p className="mt-1 text-amber-700">
              {result.overlappingUsers.length} bruker(e) hadde allerede en annen tildeling for dette kurset — de
              er nå koblet til denne i stedet (siste tildeling gjelder).
            </p>
          )}
        </div>
      )}
    </form>
  );
}
