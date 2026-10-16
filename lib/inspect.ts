import { decodeHex } from "@csfloat/cs2-inspect-serializer";
import { fetchWithTimeout } from "./http";

export type InspectData = { float?: number; seed?: number; paintIndex?: number; defIndex?: number };

// Новые inspect-ссылки CS2 содержат данные предмета прямо в ссылке (hex после csgo_econ_action_preview).
// Тогда флоат и паттерн читаются локально, без ботов Steam.
const MASKED_RE = /csgo_econ_action_preview(?:%20|\s|\+)+([0-9A-Fa-f]{20,})\s*$/;

export function decodeInspect(link?: string | null): InspectData {
  if (!link) return {};
  const m = MASKED_RE.exec(link);
  if (!m) return {};
  try {
    const d = decodeHex(m[1]);
    const out: InspectData = {};
    if (typeof d.paintwear === "number" && d.paintwear > 0) out.float = d.paintwear;
    if (typeof d.paintseed === "number") out.seed = d.paintseed;
    if (typeof d.paintindex === "number") out.paintIndex = d.paintindex;
    if (typeof d.defindex === "number") out.defIndex = d.defindex;
    return out;
  } catch {
    return {};
  }
}

// Старые ссылки вида ...preview%20S<steamid>A<assetid>D<d> нужен внешний сервис осмотра (необязательно).
// Задайте FLOAT_API_URL (например, свой экземпляр csfloat/inspect) и сайт попробует им воспользоваться.
export async function fetchFloatFromService(link: string): Promise<InspectData> {
  const base = process.env.FLOAT_API_URL;
  if (!base) return {};
  try {
    const r = await fetchWithTimeout(
      `${base.replace(/\/$/, "")}/?url=${encodeURIComponent(link)}`,
      { cache: "no-store" },
      6_000,
    );
    if (!r.ok) return {};
    const j = await r.json();
    const info = j?.iteminfo ?? j;
    const out: InspectData = {};
    if (typeof info?.floatvalue === "number") out.float = info.floatvalue;
    if (typeof info?.paintseed === "number") out.seed = info.paintseed;
    return out;
  } catch {
    return {};
  }
}
