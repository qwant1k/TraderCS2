"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { Item } from "@/lib/steam";
import type { PriceSet } from "@/lib/prices";
import { fmtFloat } from "@/lib/wear";
import ItemCard from "./ItemCard";
import ItemQuickActions from "./ItemQuickActions";

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  stagingTitle: string;
  stagingHint: string;
  children?: ReactNode; // редактор под выбранными предметами (варианты, сообщение, кнопка)
};

type Sort = "price_desc" | "price_asc" | "float_asc" | "float_desc" | "name";

const usd = (n?: number) => (n == null ? "—" : `$${n.toFixed(2)}`);
const priceOf = (p?: PriceSet) => {
  const v = [p?.steam, p?.skinport].filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};

export default function InventoryBrowser({ selected, onChange, max = 10, stagingTitle, stagingHint, children }: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceSet>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [wear, setWear] = useState("");
  const [type, setType] = useState("");
  const [stOnly, setStOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("price_desc");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [stagingOpen, setStagingOpen] = useState(selected.length > 0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [stagingDragOver, setStagingDragOver] = useState(false);
  const previousSelectedCount = useRef(selected.length);
  const stagingDragDepth = useRef(0);

  useEffect(() => {
    if (selected.length === 0) setStagingOpen(false);
    else if (selected.length > previousSelectedCount.current) setStagingOpen(true);
    previousSelectedCount.current = selected.length;
  }, [selected.length]);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setItems(null);
    const r = await fetch(`/api/inventory${refresh ? "?refresh=1" : ""}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.message || "Не удалось загрузить инвентарь");
      setItems([]);
      return;
    }
    setItems(j.items);
    setPrices(j.prices);
    setBusyIds(new Set(j.busy ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const focused = useMemo(() => items?.find((i) => i.assetid === focusId) ?? null, [items, focusId]);

  // Цена Steam для открытой карточки подгружается по запросу
  useEffect(() => {
    if (!focused || prices[focused.hash]?.steam != null) return;
    let alive = true;
    fetch(`/api/prices?hash=${encodeURIComponent(focused.hash)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.prices) setPrices((p) => ({ ...p, ...j.prices }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [focused, prices]);

  const options = useMemo(() => {
    const uniq = (f: (i: Item) => string | undefined) => Array.from(new Set((items ?? []).map(f).filter(Boolean) as string[])).sort();
    return { rarity: uniq((i) => i.rarity), wear: uniq((i) => i.wear), type: uniq((i) => i.type) };
  }, [items]);

  const shown = useMemo(() => {
    const list = (items ?? []).filter(
      (i) =>
        i.name.toLowerCase().includes(q.toLowerCase()) &&
        (!rarity || i.rarity === rarity) &&
        (!wear || i.wear === wear) &&
        (!type || i.type === type) &&
        (!stOnly || i.stattrak),
    );
    const price = (i: Item) => priceOf(prices[i.hash]) ?? -1;
    const fl = (i: Item, d: number) => i.float ?? d;
    list.sort((a, b) => {
      switch (sort) {
        case "price_asc": return price(a) - price(b);
        case "float_asc": return fl(a, 9) - fl(b, 9);
        case "float_desc": return fl(b, -1) - fl(a, -1);
        case "name": return a.name.localeCompare(b.name);
        default: return price(b) - price(a);
      }
    });
    return list;
  }, [items, prices, q, rarity, wear, type, stOnly, sort]);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.assetid, i])), [items]);
  const stagedItems = selected.map((id) => byId.get(id)).filter(Boolean) as Item[];
  const total = stagedItems.reduce((s, i) => s + (priceOf(prices[i.hash]) ?? 0), 0);

  function toggle(id: string) {
    if (busyIds.has(id)) return;
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  function startItemDrag(event: DragEvent<HTMLDivElement>, id: string) {
    if (busyIds.has(id)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  }

  function enterStaging(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("text/plain")) return;
    event.preventDefault();
    stagingDragDepth.current += 1;
    setStagingDragOver(true);
  }

  function leaveStaging() {
    stagingDragDepth.current = Math.max(0, stagingDragDepth.current - 1);
    if (stagingDragDepth.current === 0) setStagingDragOver(false);
  }

  function dropOnStaging(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    stagingDragDepth.current = 0;
    setStagingDragOver(false);
    setDraggingId(null);
    if (!byId.has(id) || busyIds.has(id) || selected.includes(id) || selected.length >= max) return;
    onChange([...selected, id]);
  }

  return (
    <div>
      {/* Поле «ожидают предложений»: сюда попадают предметы, добавленные в обмен */}
      <section
        className={`card staging ${stagingOpen ? "open" : "collapsed"} ${stagingDragOver ? "drag-over" : ""}`}
        onDragEnter={enterStaging}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("text/plain")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={leaveStaging}
        onDrop={dropOnStaging}
      >
        <button
          className="staging-toggle"
          type="button"
          onClick={() => setStagingOpen((open) => !open)}
          aria-expanded={stagingOpen}
          aria-controls="staging-content"
        >
          <span className="staging-heading">
            <strong>{stagingTitle}</strong>
            <span className="muted">
              {selected.length === 0 ? "Добавьте предмет из инвентаря — блок раскроется автоматически" : stagingHint}
            </span>
          </span>
          <span className="staging-summary">
            {selected.length}/{max}
            {selected.length > 0 && <> · ориентир ≈ {usd(total)}</>}
            <span className="staging-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </span>
          </span>
        </button>
        {stagingDragOver && <div className="staging-drop-label">Отпустите, чтобы добавить в предложение</div>}
        <div className="staging-content" id="staging-content" hidden={!stagingOpen}>
          {stagedItems.length === 0 ? (
            <div className="empty">Пока пусто. Выберите предмет ниже и нажмите «Добавить в обмен».</div>
          ) : (
            <div className="chips">
              {stagedItems.map((it) => (
                <div className="chip" key={it.assetid} style={it.color ? ({ "--rc": it.color } as CSSProperties) : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.icon} alt="" />
                  <div>
                    <div className="cn" style={it.color ? { color: it.color } : undefined}>{it.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {it.float != null ? `float ${fmtFloat(it.float)}` : it.wear ?? ""} · {usd(priceOf(prices[it.hash]))}
                    </div>
                  </div>
                  <button onClick={() => toggle(it.assetid)} aria-label="Убрать">×</button>
                </div>
              ))}
            </div>
          )}
          {children}
        </div>
      </section>

      <div className="toolbar">
        <input placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">Любая редкость</option>
          {options.rarity.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={wear} onChange={(e) => setWear(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">Любой износ</option>
          {options.wear.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">Любой тип</option>
          {options.type.map((o) => <option key={o}>{o}</option>)}
        </select>
        <label className="chk"><input type="checkbox" checked={stOnly} onChange={(e) => setStOnly(e.target.checked)} /> StatTrak™</label>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ maxWidth: 190 }}>
          <option value="price_desc">Сначала дорогие</option>
          <option value="price_asc">Сначала дешёвые</option>
          <option value="float_asc">Флоат по возрастанию</option>
          <option value="float_desc">Флоат по убыванию</option>
          <option value="name">По названию</option>
        </select>
        <button className="btn secondary" type="button" onClick={() => load(true)}>Обновить</button>
        <span className="muted">{shown.length} из {items?.length ?? 0}</span>
      </div>

      {error && <div className="msg err">{error}</div>}
      {items === null && <div className="muted">Загружаю инвентарь…</div>}
      {items && items.length === 0 && !error && <div className="muted">Нет предметов, доступных для обмена.</div>}

      <div className={`inv-layout ${focused ? "with-card" : ""}`}>
        <div className="grid">
          {shown.map((it) => {
            const p = prices[it.hash];
            const isSel = selected.includes(it.assetid);
            const isBusy = busyIds.has(it.assetid);
            return (
              <div
                key={it.assetid}
                className={`item pick ${isSel ? "sel" : ""} ${focusId === it.assetid ? "focus" : ""} ${isBusy ? "busy" : ""} ${draggingId === it.assetid ? "dragging" : ""}`}
                onClick={() => setFocusId(it.assetid)}
                draggable={!isBusy}
                onDragStart={(event) => startItemDrag(event, it.assetid)}
                onDragEnd={() => {
                  stagingDragDepth.current = 0;
                  setStagingDragOver(false);
                  setDraggingId(null);
                }}
                title={it.hash}
                style={it.color ? ({ "--rc": it.color } as CSSProperties) : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.icon} alt="" loading="lazy" />
                <div className="n" style={it.color ? { color: it.color } : undefined}>{it.name}</div>
                <div className="p">
                  {isBusy ? "В лоте" : it.float != null ? `float ${fmtFloat(it.float).slice(0, 7)}` : it.wear ?? ""}
                </div>
                <div className="p">Steam {usd(p?.steam)} · SP {usd(p?.skinport)}</div>
                <ItemQuickActions
                  item={it}
                  selected={isSel}
                  disabled={isBusy}
                  onToggle={() => toggle(it.assetid)}
                />
              </div>
            );
          })}
        </div>

        {focused && (
          <aside className="side">
            <ItemCard
              item={focused}
              prices={prices[focused.hash]}
              selected={selected.includes(focused.assetid)}
              busy={busyIds.has(focused.assetid)}
              onToggle={() => toggle(focused.assetid)}
              onClose={() => setFocusId(null)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
