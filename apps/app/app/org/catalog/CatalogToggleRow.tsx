"use client";

import { useState } from "react";

export function CatalogToggleRow({
  courseId,
  title,
  enabled: initialEnabled,
  sortOrder: initialSortOrder,
}: {
  courseId: string;
  title: string;
  enabled: boolean;
  sortOrder: number | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sortOrder, setSortOrder] = useState(initialSortOrder?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextEnabled: boolean, nextSortOrder: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          sortOrder: nextSortOrder === "" ? null : Number(nextSortOrder),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? res.statusText);
        return;
      }
      setEnabled(nextEnabled);
      setSortOrder(nextSortOrder);
    } catch (e) {
      setError(`Nettverksfeil: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b">
      <td className="py-2">{title}</td>
      <td className="py-2">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={() => save(enabled, sortOrder)}
          disabled={saving}
          className="w-20 rounded border px-2 py-1"
        />
      </td>
      <td className="py-2">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => save(e.target.checked, sortOrder)}
        />
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  );
}
