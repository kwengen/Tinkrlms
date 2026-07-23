"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AckButton({ next }: { next: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/personvern/ack", { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      setError("Kunne ikke lagre. Prøv igjen.");
      return;
    }
    router.push(next);
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleClick}
        disabled={submitting}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Jeg har lest personvernerklæringen
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
