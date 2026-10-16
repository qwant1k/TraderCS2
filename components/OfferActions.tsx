"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "accept" | "decline" | "cancel" | "done";

export default function OfferActions({
  offerId,
  actions,
}: {
  offerId: string;
  actions: { action: Action; label: string; style?: "ok" | "bad" | "secondary" }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(j.message || "Действие не выполнено");
    router.refresh();
  }

  return (
    <div>
      <div className="row">
        {actions.map((a) => (
          <button key={a.action} className={`btn ${a.style ?? ""}`} disabled={busy} onClick={() => run(a.action)}>
            {a.label}
          </button>
        ))}
      </div>
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}
