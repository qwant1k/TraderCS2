"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CATEGORIES, wantLabel, type WantKind } from "@/lib/wants";
import { WEAR_RANGES } from "@/lib/wear";

export type WantDraft = {
  kind: WantKind;
  base: string;
  category: string;
  wear: string; // "" (любой) | FN | MW | FT | WW | BS | custom
  floatMin: string;
  floatMax: string;
  stattrak: boolean;
  priceMin: string;
  priceMax: string;
  text: string;
};

export const emptyDraft = (): WantDraft => ({
  kind: "ITEM", base: "", category: "Knife", wear: "", floatMin: "", floatMax: "", stattrak: false, priceMin: "", priceMax: "", text: "",
});

const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function draftToPayload(d: WantDraft) {
  const range = WEAR_RANGES.find((w) => w.key === d.wear);
  const floatMin = range ? range.from : d.wear === "custom" ? n(d.floatMin) : null;
  const floatMax = range ? range.to : d.wear === "custom" ? n(d.floatMax) : null;
  return {
    kind: d.kind,
    base: d.base,
    category: d.category,
    floatMin, floatMax,
    stattrak: d.stattrak || null,
    priceMin: n(d.priceMin),
    priceMax: n(d.priceMax),
    text: d.text,
  };
}

/** Пустое пожелание (ничего не заполнено) не отправляем */
export function draftFilled(d: WantDraft) {
  if (d.kind === "ITEM") return d.base.trim() !== "";
  if (d.kind === "TEXT") return d.text.trim() !== "";
  if (d.kind === "PRICE") return d.priceMin.trim() !== "" || d.priceMax.trim() !== "";
  return true;
}

const KINDS: { key: WantKind; label: string }[] = [
  { key: "ITEM", label: "Предмет" },
  { key: "CATEGORY", label: "Категория" },
  { key: "PRICE", label: "Любой по цене" },
  { key: "TEXT", label: "Свой текст" },
];

export default function WantEditor({ index, value, onChange, onRemove }: {
  index: number; value: WantDraft; onChange: (d: WantDraft) => void; onRemove?: () => void;
}) {
  const listId = useId();
  const searchRef = useRef<HTMLDivElement>(null);
  const suppressNextSearch = useRef(false);
  const [hints, setHints] = useState<{
    name: string; weapon: string; category: string; rarity: string | null; rarityColor: string | null;
    image: string | null; minFloat: number | null; maxFloat: number | null; wears: string[];
    stattrak: boolean; souvenir: boolean;
  }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const set = (patch: Partial<WantDraft>) => onChange({ ...value, ...patch });

  // Подсказки названий из каталога
  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      setHints([]);
      return;
    }
    if (value.kind !== "ITEM" || value.base.trim().length < 1) {
      setHints([]);
      setSearchOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/catalog?q=${encodeURIComponent(value.base)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j) => {
          setHints(j.items ?? []);
          setSearchOpen(true);
          setActive(-1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value.kind, value.base]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(name: string) {
    suppressNextSearch.current = true;
    set({ base: name });
    setSearchOpen(false);
    setActive(-1);
  }

  function searchKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen || hints.length === 0) {
      if (event.key === "ArrowDown" && hints.length > 0) setSearchOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(hints.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(hints[active].name);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
    }
  }

  const p = draftToPayload(value);
  const preview = draftFilled(value) ? wantLabel({ ...p, kind: value.kind, base: value.base, text: value.text }) : "";
  const showWear = value.kind === "ITEM" || value.kind === "CATEGORY";

  return (
    <div className="want-ed">
      <div className="row between" style={{ flexWrap: "nowrap" }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="vnum">{index + 1}</span>
          <div className="seg">
            {KINDS.map((k) => (
              <button key={k.key} type="button" className={value.kind === k.key ? "on" : ""} onClick={() => set({ kind: k.key })}>{k.label}</button>
            ))}
          </div>
        </div>
        {onRemove && <button className="btn small secondary" type="button" onClick={onRemove} aria-label="Удалить вариант">×</button>}
      </div>

      {value.kind === "ITEM" && (
        <div className="want-search" ref={searchRef}>
          <input
            value={value.base}
            onChange={(e) => set({ base: e.target.value })}
            onFocus={() => value.base.trim() && setSearchOpen(true)}
            onKeyDown={searchKeys}
            maxLength={120}
            placeholder="Найдите скин: AK-47 | Redline, Karambit | Doppler…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          />
          {loading && <span className="want-search-loader" aria-label="Поиск" />}
          {searchOpen && (
            <div className="want-results" id={listId} role="listbox">
              {hints.map((hint, hintIndex) => (
                <button
                  id={`${listId}-${hintIndex}`}
                  key={hint.name}
                  type="button"
                  role="option"
                  aria-selected={active === hintIndex}
                  className={active === hintIndex ? "active" : ""}
                  onMouseEnter={() => setActive(hintIndex)}
                  onClick={() => choose(hint.name)}
                >
                  <span className="want-result-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {hint.image && <img src={hint.image} alt="" />}
                  </span>
                  <span className="want-result-copy">
                    <strong>{hint.name}</strong>
                    <small>
                      <i style={{ background: hint.rarityColor ?? "#777" }} />
                      {hint.rarity ?? hint.category}
                      {hint.stattrak && <em>StatTrak™</em>}
                      {hint.souvenir && <em>Souvenir</em>}
                    </small>
                  </span>
                  <span className="want-result-float">
                    <b>{hint.weapon}</b>
                    {hint.minFloat != null && hint.maxFloat != null && <small>{hint.minFloat.toFixed(2)}–{hint.maxFloat.toFixed(2)}</small>}
                  </span>
                </button>
              ))}
              {!loading && hints.length === 0 && <div className="want-results-empty">Скин не найден в каталоге CS2</div>}
            </div>
          )}
        </div>
      )}
      {value.kind === "CATEGORY" && (
        <select value={value.category} onChange={(e) => set({ category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>Любой {c.ru}</option>)}
        </select>
      )}
      {value.kind === "TEXT" && (
        <input value={value.text} onChange={(e) => set({ text: e.target.value })} maxLength={200} placeholder="Опишите словами. Такой вариант не участвует в автоподборе" />
      )}

      {value.kind !== "TEXT" && (
        <div className="want-row">
          {showWear && (
            <select value={value.wear} onChange={(e) => set({ wear: e.target.value })} aria-label="Износ">
              <option value="">Любой износ</option>
              {WEAR_RANGES.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
              <option value="custom">Свой диапазон флоата</option>
            </select>
          )}
          {showWear && value.wear === "custom" && (
            <>
              <input className="num" value={value.floatMin} onChange={(e) => set({ floatMin: e.target.value })} placeholder="float от" inputMode="decimal" />
              <input className="num" value={value.floatMax} onChange={(e) => set({ floatMax: e.target.value })} placeholder="до" inputMode="decimal" />
            </>
          )}
          <input className="num" value={value.priceMin} onChange={(e) => set({ priceMin: e.target.value })} placeholder="$ от" inputMode="decimal" />
          <input className="num" value={value.priceMax} onChange={(e) => set({ priceMax: e.target.value })} placeholder="$ до" inputMode="decimal" />
          {showWear && (
            <label className="chk"><input type="checkbox" checked={value.stattrak} onChange={(e) => set({ stattrak: e.target.checked })} /> StatTrak™</label>
          )}
        </div>
      )}
      {preview && <div className="muted" style={{ fontSize: 12 }}>Будет показано: <b>{preview}</b></div>}
    </div>
  );
}
