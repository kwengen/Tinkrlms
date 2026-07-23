"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PseudonymizeButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        "Dette sperrer innlogging og fjerner navnet til brukeren permanent. Kurshistorikk beholdes. Fortsette?",
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/pseudonymize`, { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? res.statusText);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={submitting}
        className="rounded border border-red-700 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
      >
        Slett/pseudonymiser
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
