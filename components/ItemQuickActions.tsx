"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Item } from "@/lib/steam";
import { fmtFloat } from "@/lib/wear";
import Viewer3D from "./Viewer3D";

const Cube = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7 12 12l8.7-5M12 22V12" />
  </svg>
);

type Props = {
  item: Item;
  onToggle?: () => void;
  selected?: boolean;
  disabled?: boolean;
};

export default function ItemQuickActions({ item, onToggle, selected = false, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <div className="item-quick" onClick={stop}>
        <div className="item-quick-actions">
          <button type="button" className="item-quick-btn inspect" onClick={() => setOpen(true)}>
            <Cube /> <span>3D ИНСПЕКТ</span>
          </button>
          {onToggle && (
            <button
              type="button"
              className={`item-quick-btn trade ${selected ? "selected" : ""}`}
              disabled={disabled}
              onClick={onToggle}
            >
              <b>{selected ? "−" : "+"}</b> <span>{selected ? "УБРАТЬ" : "В ОБМЕН"}</span>
            </button>
          )}
        </div>
        <div className={`item-quick-float ${item.float == null ? "empty" : ""}`}>
          <span>FLOAT</span>
          <strong>{item.float == null ? "—" : fmtFloat(item.float)}</strong>
        </div>
      </div>

      {open && createPortal(
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`3D-просмотр · ${item.name}`} onClick={stop}>
            <div className="modal-head">
              <b>3D-просмотр · {item.name}</b>
              <button type="button" className="x" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <Viewer3D item={item} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
