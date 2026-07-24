"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArchiveButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Arkivere denne tildelingen? Dette kan ikke angres.")) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/archive`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(`Nettverksfeil: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={submitting}
        className="rounded border px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
      >
        Arkiver
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
