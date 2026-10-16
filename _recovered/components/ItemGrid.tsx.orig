import type { CSSProperties } from "react";
import type { Item } from "@/lib/steam";
import { fmtFloat } from "@/lib/wear";
import ItemQuickActions from "./ItemQuickActions";

// Показ предметов без выбора (серверный компонент). Цвет редкости идёт из данных Steam.
// links=false внутри ссылок-карточек, чтобы не вкладывать <a> в <a>
export default function ItemGrid({ items, links = true }: { items: Item[]; links?: boolean }) {
  return (
    <div className="grid">
      {items.map((it) => (
        <div
          className="item"
          key={it.assetid}
          title={it.hash}
          style={it.color ? ({ "--rc": it.color } as CSSProperties) : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.icon} alt="" loading="lazy" />
          <div className="n" style={it.color ? { color: it.color } : undefined}>{it.name}</div>
          {it.float != null && <div className="p">float {fmtFloat(it.float).slice(0, 8)}</div>}
          {links && <ItemQuickActions item={it} />}
        </div>
      ))}
    </div>
  );
}
