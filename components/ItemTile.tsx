"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { FeedItemView } from "@/lib/feedTypes";
import { fmtFloat, WEAR_RANGES } from "@/lib/wear";

type Props = {
  item: FeedItemView;
  size: "inventory" | "trade" | "mini";
  highlight?: "none" | "selected" | "wanted";
  wantedCount?: number;
  busy?: boolean;
  onClick?: () => void;
  ariaPressed?: boolean;
};

const RARITY_COLORS: Record<string, string> = {
  Covert: "#B5534F",
  Classified: "#94589F",
  Restricted: "#6E5FAE",
  "Mil-Spec Grade": "#4E68A8",
  "Mil-Spec": "#4E68A8",
  "Industrial Grade": "#6A8BB0",
  Industrial: "#6A8BB0",
  "Consumer Grade": "#8C9097",
  Consumer: "#8C9097",
  Contraband: "#A88A3E",
  Extraordinary: "#9C7A3C",
};

function rarityColor(item: FeedItemView) {
  if (item.type?.includes("Knife") || item.type?.includes("Gloves") || item.hash.includes("★")) return "#9C7A3C";
  return (item.rarity && RARITY_COLORS[item.rarity]) || item.color || "#8C9097";
}

function wearCode(item: FeedItemView) {
  if (item.wear) return WEAR_RANGES.find((wear) => wear.name === item.wear)?.key;
  if (item.float != null) return WEAR_RANGES.find((wear) => item.float! < wear.to)?.key ?? "BS";
  return undefined;
}

function skinName(item: FeedItemView) {
  const separator = item.name.indexOf(" | ");
  return separator >= 0 ? item.name.slice(separator + 3) : item.name;
}

const usd = (value?: number) => value == null ? "—" : `$${value.toFixed(2)}`;

export default function ItemTile({
  item,
  size,
  highlight = "none",
  wantedCount = 0,
  busy = false,
  onClick,
  ariaPressed,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const color = rarityColor(item);
  const code = wearCode(item);
  const className = `item-tile item-tile-${size} item-tile-${highlight}${busy ? " is-busy" : ""}`;
  const style = { "--rarity-color": color } as CSSProperties;
  const label = `${item.name}${item.wear ? `, ${item.wear}` : ""}`;
  const content = (
    <>
      <span className="item-tile-image">
        {wantedCount > 0 && <span className="item-tile-wanted">Ищут · {wantedCount}</span>}
        {item.stattrak && <span className="item-tile-stattrak">ST™</span>}
        {busy && <span className="item-tile-busy">В лоте</span>}
        {!imageFailed && item.icon ? (
          <Image
            src={item.icon}
            alt=""
            fill
            sizes={size === "inventory" ? "(max-width: 600px) 45vw, 160px" : "140px"}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="item-tile-placeholder">Нет изображения</span>
        )}
        {code && <span className="item-tile-wear">{code}</span>}
      </span>
      <span className="item-tile-rarity" />
      <span className="item-tile-copy">
        <span className="item-tile-weapon">{item.weapon || item.type || "CS2"}</span>
        <strong title={item.name}>{skinName(item)}</strong>
        <span className="item-tile-meta">
          <span>{item.float != null ? fmtFloat(item.float) : code || "—"}</span>
          <span>{usd(item.priceUsd)}</span>
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={onClick}
        aria-pressed={ariaPressed}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return <div className={className} style={style} aria-label={label}>{content}</div>;
}
