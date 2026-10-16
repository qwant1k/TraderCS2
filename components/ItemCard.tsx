"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Viewer3D from "./Viewer3D";
import type { Item } from "@/lib/steam";
import type { PriceSet } from "@/lib/prices";
import { WEAR_RANGES, fmtFloat, wearOf } from "@/lib/wear";

const usd = (n?: number) => (n == null ? "—" : `$${n.toFixed(2)}`);

function ago(ts?: number) {
  if (!ts) return "";
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return m < 1 ? "только что" : `${m} мин назад`;
}

// Шкала флоата с границами износа и маркером предмета
export function FloatBar({ value }: { value: number }) {
  return (
    <div>
      <div style={{ position: "relative", height: 10, borderRadius: 99, overflow: "hidden", display: "flex" }}>
        {WEAR_RANGES.map((w) => (
          <i key={w.key} style={{ width: `${(w.to - w.from) * 100}%`, background: w.color, opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ position: "relative", height: 14 }}>
        <span
          style={{
            position: "absolute", left: `${Math.min(99.5, Math.max(0.5, value * 100))}%`, top: 0,
            transform: "translateX(-50%)", width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "9px solid #fff",
          }}
        />
      </div>
      <div className="muted" style={{ position: "relative", height: 18, fontSize: 11 }}>
        {WEAR_RANGES.map((w) => (
          <span
            key={w.key}
            style={{
              position: "absolute",
              left: `${((w.from + w.to) / 2) * 100}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {w.key}
          </span>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><b>{title}</b><button className="x" onClick={onClose} aria-label="Закрыть">×</button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const Eye = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>);
const Cam = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>);
const Cube = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></svg>);

function Screenshot({ inspect, name }: { inspect: string; name: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  return (
    <div className="shot-stage" aria-busy={status === "loading"}>
      {status === "loading" && <div className="muted shot-state">Готовим скриншот…</div>}
      {status === "error" && (
        <div className="muted shot-state">
          Сервис скриншотов сейчас недоступен или не настроен.
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn small secondary" href={`https://csfloat.com/checker?inspect=${encodeURIComponent(inspect)}`} target="_blank" rel="noopener noreferrer">Открыть в CSFloat</a>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/screenshot?inspect=${encodeURIComponent(inspect)}`}
        alt={`Скриншот ${name}`}
        className={status === "ready" ? "shot ready" : "shot"}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}

// Иконки просмотра поверх картинки: осмотр в игре, скриншот, 3D (как на Lis-Skins)
function Viewer({ item }: { item: Item }) {
  const [modal, setModal] = useState<null | "3d" | "shot">(null);
  const [copied, setCopied] = useState(false);
  const ins = item.inspect;

  async function copy() {
    try { await navigator.clipboard.writeText(ins!); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <div className="viewer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.icon} alt={item.name} />
      <div className="vtools">
        {ins && <a className="vbtn" href={ins} title="Осмотреть в игре" aria-label="Осмотреть в игре"><Eye /></a>}
        {ins && <button className="vbtn" onClick={() => setModal("shot")} title="Скриншот" aria-label="Скриншот"><Cam /></button>}
        <button className="vbtn vbtn-3d" onClick={() => setModal("3d")} title="3D-просмотр" aria-label="3D-просмотр"><Cube /></button>
      </div>
      {modal === "3d" && (
        <Modal title={`3D-просмотр · ${item.name}`} onClose={() => setModal(null)}>
          <Viewer3D item={item} />
          <div className="row modal-foot">
            {ins && <button className="btn small secondary" onClick={copy}>{copied ? "Скопировано" : "Копировать inspect-ссылку"}</button>}
            {ins && <a className="btn small secondary" href={ins}>Осмотреть в CS2</a>}
          </div>
        </Modal>
      )}
      {modal === "shot" && ins && (
        <Modal title={`Скриншот · ${item.name}`} onClose={() => setModal(null)}>
          <Screenshot inspect={ins} name={item.name} />
        </Modal>
      )}
    </div>
  );
}

type Market = {
  history: { t: number; steam: number | null; skinport: number | null }[];
  offered: { id: string; user: string; mine: boolean; type: string }[];
  wanted: { id: string; user: string; mine: boolean; text: string }[];
};

function Spark({ points, color }: { points: { t: number; v: number }[]; color: string }) {
  if (points.length < 2) return null;
  const W = 300, H = 60;
  const t0 = points[0].t, t1 = points[points.length - 1].t || 1;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(((p.t - t0) / (t1 - t0 || 1)) * W).toFixed(1)},${(H - 4 - ((p.v - lo) / span) * (H - 8)).toFixed(1)}`).join(" ");
  return <path d={d} fill="none" stroke={color} strokeWidth="2" />;
}

// Динамика цены и спрос/предложение на сайте
function MarketPanel({ hash }: { hash: string }) {
  const [m, setM] = useState<Market | null>(null);
  useEffect(() => {
    let alive = true;
    setM(null);
    fetch(`/api/item-market?hash=${encodeURIComponent(hash)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setM(j))
      .catch(() => {});
    return () => { alive = false; };
  }, [hash]);
  if (!m) return <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>Загружаю динамику и спрос…</div>;
  const steam = m.history.filter((h) => h.steam != null).map((h) => ({ t: h.t, v: h.steam as number }));
  const sp = m.history.filter((h) => h.skinport != null).map((h) => ({ t: h.t, v: h.skinport as number }));
  const has = steam.length > 1 || sp.length > 1;
  const row = (x: { id: string; user: string; mine: boolean }, extra?: string) => (
    <li key={x.id}><Link href={`/listings/${x.id}`}>{x.user}{x.mine ? " (вы)" : ""}</Link>{extra ? <span className="muted"> — {extra}</span> : null}</li>
  );
  return (
    <div>
      <div className="muted" style={{ margin: "14px 0 6px" }}>Динамика цены</div>
      {has ? (
        <>
          <svg viewBox="0 0 300 60" width="100%" height="60" role="img" aria-label="График цены">
            <Spark points={steam} color="#4da3ff" />
            <Spark points={sp} color="#39ff88" />
          </svg>
          <div className="muted" style={{ fontSize: 11 }}>
            <span style={{ color: "#4da3ff" }}>■</span> Steam · <span style={{ color: "#39ff88" }}>■</span> Skinport · {m.history.length} замеров
          </div>
        </>
      ) : (
        <div className="muted" style={{ fontSize: 12 }}>Истории пока мало: замеры копятся при просмотре карточек, раз в 30 минут.</div>
      )}
      <div className="muted" style={{ margin: "14px 0 6px" }}>Сейчас предлагают ({m.offered.length})</div>
      {m.offered.length ? <ul className="mlist">{m.offered.map((o) => row(o, o.type === "OPEN" ? "открыт для предложений" : undefined))}</ul> : <div className="muted" style={{ fontSize: 12 }}>На сайте никто не выставил.</div>}
      <div className="muted" style={{ margin: "14px 0 6px" }}>Сейчас хотят ({m.wanted.length})</div>
      {m.wanted.length ? <ul className="mlist">{m.wanted.map((w) => row(w, w.text))}</ul> : <div className="muted" style={{ fontSize: 12 }}>Пока никто не ищет.</div>}
    </div>
  );
}

type Props = {
  item: Item;
  prices?: PriceSet;
  selected?: boolean;
  busy?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  popup?: boolean;
};

export default function ItemCard({ item, prices, selected, busy, onToggle, onClose, popup }: Props) {
  useEffect(() => {
    if (popup) document.body.classList.add("popup");
    return () => document.body.classList.remove("popup");
  }, [popup]);

  const wear = item.float != null ? wearOf(item.float) : null;
  const list = [prices?.steam, prices?.skinport].filter((x): x is number => typeof x === "number");
  const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : undefined;


  return (
    <div className={popup ? "icard popup" : "icard"} style={item.color ? ({ ["--rc" as string]: item.color } as React.CSSProperties) : undefined}>
      <div className="icard-img">
        {onClose && <button className="x" onClick={onClose} aria-label="Закрыть">×</button>}
        <Viewer item={item} />
      </div>
      <div className="icard-body">
        <h3 style={item.color ? { color: item.color } : undefined}>{item.name}</h3>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {item.stattrak && <span className="tag want">StatTrak™</span>}
          {item.souvenir && <span className="tag want">Souvenir</span>}
          {item.rarity && <span className="tag">{item.rarity}</span>}
          {item.type && <span className="tag">{item.type}</span>}
          {item.wear && <span className="tag">{item.wear}</span>}
        </div>

        <div className="float-current">
          <div className="kv">
            <span className="muted">Флоат</span>
            <b>{fmtFloat(item.float)}</b>
          </div>
          {item.float != null ? (
            <>
              <FloatBar value={item.float} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Износ по флоату: {wear?.name}</div>
            </>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              Флоат недоступен для этого предмета. Его можно посмотреть в игре по значку глаза на картинке.
            </div>
          )}
        </div>
        {item.seed != null && (
          <div className="kv"><span className="muted">Паттерн (seed)</span><b>{item.seed}</b></div>
        )}

        {item.stickers && item.stickers.length > 0 && (
          <>
            <div className="muted" style={{ margin: "12px 0 6px" }}>Наклейки и брелки</div>
            <div className="row" style={{ gap: 8 }}>
              {item.stickers.map((s, i) => (
                <div key={i} className="sticker" title={s.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.icon && <img src={s.icon} alt={s.name} />}
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="muted" style={{ margin: "14px 0 6px" }}>Цены на площадках (ориентир)</div>
        <table className="ptable">
          <tbody>
            <tr>
              <td>Steam Market</td>
              <td>{usd(prices?.steam)}</td>
              <td>
                <a href={`https://steamcommunity.com/market/listings/${item.appid}/${encodeURIComponent(item.hash)}`} target="_blank" rel="noopener noreferrer">открыть</a>
              </td>
            </tr>
            <tr><td>Skinport</td><td>{usd(prices?.skinport)}</td><td /></tr>
            <tr><td><b>Среднее</b></td><td><b>{usd(avg)}</b></td><td /></tr>
          </tbody>
        </table>
        {prices?.updatedAt && <div className="muted" style={{ fontSize: 11 }}>Обновлено {ago(prices.updatedAt)}. Цены меняются, это не оценка.</div>}

        <MarketPanel hash={item.hash} />

        <div className="row" style={{ marginTop: 14 }}>
          {onToggle && (
            <button className={`btn trade-toggle ${selected ? "secondary" : ""}`} disabled={busy} onClick={onToggle}>
              {busy ? "Уже в лоте" : selected ? "Убрать из обмена" : "Добавить в обмен"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
