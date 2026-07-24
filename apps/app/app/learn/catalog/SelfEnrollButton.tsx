"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelfEnrollButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enrollments/self-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? res.statusText);
        return;
      }
      const body = await res.json();
      router.push(`/learn/${body.enrollmentId}`);
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
        className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Meld meg på
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
