"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Mode = "magic-link" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("magic-link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ kind: "idle" });
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent" });
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ kind: "idle" });
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    window.location.assign("/post-login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <h1 className="text-xl font-semibold">Logg inn — Tinkrakademiet</h1>

      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("magic-link")}
          className={`rounded px-3 py-1 ${mode === "magic-link" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
        >
          Magisk lenke
        </button>
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded px-3 py-1 ${mode === "password" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
        >
          Passord
        </button>
      </div>

      {mode === "magic-link" ? (
        <form onSubmit={handleMagicLink} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          >
            Send magisk lenke
          </button>
        </form>
      ) : (
        <form onSubmit={handlePassword} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <input
            type="password"
            required
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          >
            Logg inn
          </button>
        </form>
      )}

      {status.kind === "sent" && (
        <p className="mt-4 text-sm text-green-700">
          Sjekk innboksen din — vi har sendt en innloggingslenke til {email}.
        </p>
      )}
      {status.kind === "error" && (
        <p className="mt-4 text-sm text-red-700">{status.message}</p>
      )}

      <p className="mt-8 text-xs text-gray-500">
        Ny bruker? Kontoen din opprettes av din organisasjons administrator —
        se etter en invitasjons-e-post.
      </p>
    </main>
  );
}
