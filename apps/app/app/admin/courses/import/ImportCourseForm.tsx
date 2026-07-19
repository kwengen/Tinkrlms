"use client";

import { useState } from "react";

type Target = "new" | "existing";

export function ImportCourseForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [target, setTarget] = useState<Target>(courses.length > 0 ? "existing" : "new");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "ok"; auCount: number; blockCount: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setResult({ kind: "idle" });

    const body = new FormData();
    body.set("package", file);
    body.set("versionLabel", versionLabel);
    if (target === "new") {
      body.set("title", title);
    } else {
      body.set("courseId", courseId);
    }

    const res = await fetch("/api/admin/import-course", { method: "POST", body });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setResult({ kind: "error", message: data.error ?? res.statusText });
      return;
    }
    const data = await res.json();
    setResult({ kind: "ok", auCount: data.auCount, blockCount: data.blockCount });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setTarget("new")}
          className={`rounded px-3 py-1 ${target === "new" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
        >
          Nytt kurs
        </button>
        <button
          type="button"
          onClick={() => setTarget("existing")}
          disabled={courses.length === 0}
          className={`rounded px-3 py-1 disabled:opacity-40 ${target === "existing" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
        >
          Ny versjon av eksisterende
        </button>
      </div>

      {target === "new" ? (
        <input
          type="text"
          required
          placeholder="Kurstittel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border px-3 py-2"
        />
      ) : (
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded border px-3 py-2"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}

      <input
        type="text"
        required
        placeholder="Versjonsetikett (f.eks. v1)"
        value={versionLabel}
        onChange={(e) => setVersionLabel(e.target.value)}
        className="rounded border px-3 py-2"
      />

      <input
        type="file"
        accept=".zip"
        required
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="submit"
        disabled={submitting || !file}
        className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
      >
        Importer
      </button>

      {result.kind === "ok" && (
        <p className="text-sm text-green-700">
          Importert: {result.blockCount} blokker, {result.auCount} AU-er.
        </p>
      )}
      {result.kind === "error" && <p className="text-sm text-red-700">{result.message}</p>}
    </form>
  );
}
