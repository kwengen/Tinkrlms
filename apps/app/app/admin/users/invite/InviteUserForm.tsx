"use client";

import { useState } from "react";
import type { Role } from "@tinkr/shared";

const ORG_ANSVARLIG_ASSIGNABLE_ROLES: Role[] = ["kurs_ansvarlig", "bruker"];
const SUPERADMIN_ASSIGNABLE_ROLES: Role[] = [
  "superadmin",
  "kundeadmin",
  "org_ansvarlig",
  "kurs_ansvarlig",
  "bruker",
];

export function InviteUserForm({
  isSuperadmin,
  organizations,
}: {
  isSuperadmin: boolean;
  organizations: { id: string; name: string }[];
}) {
  const assignableRoles = isSuperadmin
    ? SUPERADMIN_ASSIGNABLE_ROLES
    : ORG_ANSVARLIG_ASSIGNABLE_ROLES;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>(assignableRoles[0] ?? "bruker");
  const [orgId, setOrgId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { kind: "idle" } | { kind: "ok"; email: string } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const needsOrg = isSuperadmin && role !== "superadmin" && role !== "kundeadmin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult({ kind: "idle" });

    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        role,
        ...(needsOrg ? { org_id: orgId } : {}),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setResult({ kind: "error", message: body.error?.message ?? body.error ?? res.statusText });
      return;
    }
    setResult({ kind: "ok", email });
    setEmail("");
    setFullName("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <input
        type="email"
        required
        placeholder="e-post"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border px-3 py-2"
      />
      <input
        type="text"
        required
        placeholder="fullt navn"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="rounded border px-3 py-2"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="rounded border px-3 py-2"
      >
        {assignableRoles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {needsOrg && (
        <select
          required
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="rounded border px-3 py-2"
        >
          <option value="" disabled>
            Velg organisasjon
          </option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
      >
        Send invitasjon
      </button>

      {result.kind === "ok" && (
        <p className="text-sm text-green-700">Invitasjon sendt til {result.email}.</p>
      )}
      {result.kind === "error" && <p className="text-sm text-red-700">{result.message}</p>}
    </form>
  );
}
