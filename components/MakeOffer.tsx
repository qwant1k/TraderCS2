"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryBrowser from "./InventoryBrowser";

export default function MakeOffer({ listingId, variants }: { listingId: string; variants: { id: string; text: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [variantId, setVariantId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, variantId, message, assetIds: selected }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.message || "Не удалось отправить предложение");
    router.push("/my");
  }

  return (
    <div>
      <h2>Ваше предложение</h2>
      <InventoryBrowser
        selected={selected}
        onChange={setSelected}
        stagingTitle="Что вы предлагаете"
        stagingHint="Выберите предметы из своего инвентаря."
      >
        <div className="staging-form">
          {variants.length > 0 && (
            <>
              <label>На какой вариант отвечаете</label>
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">Без привязки к варианту</option>
                {variants.map((v, i) => (
                  <option key={v.id} value={v.id}>{i + 1}. {v.text}</option>
                ))}
              </select>
            </>
          )}
          <label>Сообщение (необязательно)</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
          {error && <div className="msg err">{error}</div>}
          <p style={{ marginBottom: 0 }}>
            <button className="btn" disabled={busy || selected.length === 0} onClick={submit}>
              {busy ? "Отправляю…" : "Отправить предложение"}
            </button>
          </p>
        </div>
      </InventoryBrowser>
    </div>
  );
}
