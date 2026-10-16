"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryBrowser from "./InventoryBrowser";
import WantEditor, { draftFilled, draftToPayload, emptyDraft, type WantDraft } from "./WantEditor";

const MAX_VARIANTS = 5;

export default function CreateListing() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<"OPEN" | "SPECIFIC">("OPEN");
  const [variants, setVariants] = useState<WantDraft[]>([emptyDraft()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setVariant = (i: number, value: WantDraft) => {
    setVariants((current) => current.map((variant, j) => (j === i ? value : variant)));
  };

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        wants: type === "SPECIFIC" ? variants.filter(draftFilled).map(draftToPayload) : [],
        note,
        assetIds: selected,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.message || "Не удалось создать лот");
    router.push(`/listings/${j.id}`);
  }

  return (
    <InventoryBrowser
      selected={selected}
      onChange={setSelected}
      stagingTitle="Ожидают предложений"
      stagingHint="Предметы, которые вы отдаёте. Когда опубликуете, другие игроки смогут присылать предложения."
    >
      <div className="staging-form">
        <div className={`listing-type-switch ${type === "SPECIFIC" ? "specific" : "open"}`} role="group" aria-label="Тип обмена">
          <span className="listing-type-indicator" aria-hidden="true" />
          <button type="button" className={type === "OPEN" ? "active" : ""} aria-pressed={type === "OPEN"} onClick={() => setType("OPEN")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="9" /></svg>
            <span><b>Открыт для предложений</b><small>Рассмотрю любые варианты</small></span>
          </button>
          <button type="button" className={type === "SPECIFIC" ? "active" : ""} aria-pressed={type === "SPECIFIC"} onClick={() => setType("SPECIFIC")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4M8.5 11l1.7 1.7 3.5-3.7" /></svg>
            <span><b>Хочу конкретное</b><small>Укажу нужные предметы</small></span>
          </button>
        </div>

        {type === "SPECIFIC" && (
          <div className="listing-wants">
            <label>Что хотите получить. Можно несколько вариантов: подойдёт любой из них</label>
            {variants.map((variant, i) => (
              <WantEditor
                key={i}
                index={i}
                value={variant}
                onChange={(value) => setVariant(i, value)}
                onRemove={variants.length > 1 ? () => setVariants((current) => current.filter((_, j) => j !== i)) : undefined}
              />
            ))}
            {variants.length < MAX_VARIANTS && (
              <button className="btn secondary" type="button" onClick={() => setVariants((current) => [...current, emptyDraft()])}>
                + Добавить вариант
              </button>
            )}
          </div>
        )}

        <label>Комментарий (необязательно)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />

        {error && <div className="msg err">{error}</div>}
        <p style={{ marginBottom: 0 }}>
          <button className="btn" disabled={busy || selected.length === 0} onClick={submit}>
            {busy ? "Публикую…" : "Выставить на обмен"}
          </button>
        </p>
      </div>
    </InventoryBrowser>
  );
}
