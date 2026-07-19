"use client";

import { useEffect, useState } from "react";

export function PlayerFrame({ auId }: { auId: string }) {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ready"; url: string } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cmi5/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auId }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({ kind: "error", message: body.error ?? res.statusText });
          return;
        }
        const body = await res.json();
        setState({ kind: "ready", url: body.playerLaunchUrl });
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [auId]);

  if (state.kind === "loading") {
    return <p className="p-8 text-sm text-gray-500">Starter kurset …</p>;
  }
  if (state.kind === "error") {
    return <p className="p-8 text-sm text-red-700">Kunne ikke starte kurset: {state.message}</p>;
  }

  return (
    <iframe
      src={state.url}
      title="Kursinnhold"
      className="h-screen w-full border-0"
      // The trust boundary this sandbox enforces is documented in
      // docs/INTEGRATION-cmi5-contract.md and bestilling §3 — this iframe
      // holds no Supabase session, only the player origin does the same,
      // and neither ever gets access to app.tinkrakademiet.no's cookies.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
