// Структурированные пожелания и проверка «подходит ли предмет». Чистый модуль: работает и на сервере, и в браузере.
import { WEAR_RANGES } from "./wear";

export type WantKind = "ITEM" | "CATEGORY" | "PRICE" | "TEXT";

export type Want = {
  id: string;
  kind: WantKind;
  base?: string | null;
  baseKey?: string | null;
  category?: string | null;
  floatMin?: number | null;
  floatMax?: number | null;
  stattrak?: boolean | null;
  priceMin?: number | null;
  priceMax?: number | null;
  text?: string | null;
  label: string;
};

export type MatchItem = {
  hash: string;
  type?: string | null;
  float?: number | null;
  wear?: string | null;
  stattrak?: boolean | null;
};

// Значения тега Type в инвентаре Steam (английская локаль) и подписи
export const CATEGORIES: { key: string; ru: string }[] = [
  { key: "Knife", ru: "нож" },
  { key: "Gloves", ru: "перчатки" },
  { key: "Rifle", ru: "винтовка" },
  { key: "Sniper Rifle", ru: "снайперская винтовка" },
  { key: "Pistol", ru: "пистолет" },
  { key: "SMG", ru: "пистолет-пулемёт" },
  { key: "Shotgun", ru: "дробовик" },
  { key: "Machinegun", ru: "пулемёт" },
  { key: "Agent", ru: "агент" },
  { key: "Sticker", ru: "наклейка" },
];
const CAT_KEYS = new Set(CATEGORIES.map((c) => c.key));

/** «★ StatTrak™ M9 Bayonet | Night (Field-Tested)» → «m9 bayonet | night» */
export function baseKey(hashOrName: string) {
  return hashOrName
    .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, "")
    .replace(/★/g, "")
    .replace(/StatTrak™/gi, "")
    .replace(/^\s*Souvenir\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Название без износа и StatTrak для показа: «★ M9 Bayonet | Night» */
export function baseName(hash: string) {
  return hash
    .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, "")
    .replace(/StatTrak™\s*/gi, "")
    .replace(/^\s*Souvenir\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const usd = (n: number) => `$${n % 1 === 0 ? n : n.toFixed(2)}`;
function priceLabel(min?: number | null, max?: number | null) {
  if (min != null && max != null) return `${usd(min)}–${usd(max)}`;
  if (min != null) return `от ${usd(min)}`;
  if (max != null) return `до ${usd(max)}`;
  return "";
}
function floatLabel(min?: number | null, max?: number | null) {
  if (min == null && max == null) return "";
  const lo = min ?? 0, hi = max ?? 1;
  const w = WEAR_RANGES.find((r) => r.from === lo && r.to === hi);
  return w ? w.name : `float ${lo}–${hi}`;
}

export function wantLabel(w: Omit<Want, "id" | "label">) {
  const price = priceLabel(w.priceMin, w.priceMax);
  switch (w.kind) {
    case "ITEM": {
      const parts = [`${w.stattrak ? "StatTrak™ " : ""}${w.base ?? ""}`, floatLabel(w.floatMin, w.floatMax), price].filter(Boolean);
      return parts.join(" · ");
    }
    case "CATEGORY": {
      const ru = CATEGORIES.find((c) => c.key === w.category)?.ru ?? w.category;
      return [`Любой ${w.stattrak ? "StatTrak™ " : ""}${ru}`, floatLabel(w.floatMin, w.floatMax), price].filter(Boolean).join(" · ");
    }
    case "PRICE":
      return `Любой предмет · ${price}`;
    default:
      return w.text ?? "";
  }
}

function floatOk(it: MatchItem, min?: number | null, max?: number | null) {
  if (min == null && max == null) return true;
  const lo = min ?? 0, hi = max ?? 1;
  if (it.float != null) return it.float >= lo && it.float <= hi;
  // Флоат неизвестен: подходит, только если весь диапазон износа внутри
  const w = WEAR_RANGES.find((r) => r.name === it.wear);
  return !!w && w.from >= lo && w.to <= hi;
}

function priceOk(price: number | undefined | null, min?: number | null, max?: number | null) {
  if (min == null && max == null) return true;
  if (price == null) return false;
  return (min == null || price >= min) && (max == null || price <= max);
}

/** Подходит ли предмет под пожелание. TEXT никогда не подбирается автоматически. */
export function matchWant(it: MatchItem, price: number | undefined | null, w: Want): boolean {
  const st = it.stattrak ?? /StatTrak™/.test(it.hash);
  if (w.stattrak && !st) return false;
  switch (w.kind) {
    case "ITEM":
      return !!w.baseKey && baseKey(it.hash) === w.baseKey && floatOk(it, w.floatMin, w.floatMax) && priceOk(price, w.priceMin, w.priceMax);
    case "CATEGORY":
      return !!w.category && it.type === w.category && floatOk(it, w.floatMin, w.floatMax) && priceOk(price, w.priceMin, w.priceMax);
    case "PRICE":
      return priceOk(price, w.priceMin, w.priceMax);
    default:
      return false;
  }
}

const num = (v: unknown, lo: number, hi: number) => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/** Проверка пожеланий из запроса. Возвращает готовые записи или текст ошибки. */
export function parseWants(raw: unknown, max = 5, newId: () => string): { wants: Want[] } | { error: string } {
  const list = Array.isArray(raw) ? raw.slice(0, max) : [];
  const out: Want[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const kind = String(r.kind) as WantKind;
    if (!["ITEM", "CATEGORY", "PRICE", "TEXT"].includes(kind)) continue;
    let floatMin = num(r.floatMin, 0, 1), floatMax = num(r.floatMax, 0, 1);
    let priceMin = num(r.priceMin, 0, 1e6), priceMax = num(r.priceMax, 0, 1e6);
    if (floatMin != null && floatMax != null && floatMin > floatMax) [floatMin, floatMax] = [floatMax, floatMin];
    if (priceMin != null && priceMax != null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
    const stattrak = r.stattrak === true ? true : null;
    const w: Omit<Want, "id" | "label"> = { kind, floatMin, floatMax, priceMin, priceMax, stattrak };

    if (kind === "ITEM") {
      const base = typeof r.base === "string" ? baseName(r.base.trim()).slice(0, 120) : "";
      if (!base) return { error: "Укажите предмет в пожелании" };
      w.base = base;
      w.baseKey = baseKey(base);
      if (/StatTrak™/i.test(String(r.base))) w.stattrak = true;
    } else if (kind === "CATEGORY") {
      if (!CAT_KEYS.has(String(r.category))) return { error: "Выберите категорию в пожелании" };
      w.category = String(r.category);
    } else if (kind === "PRICE") {
      if (priceMin == null && priceMax == null) return { error: "Укажите диапазон цены в пожелании «Любой предмет»" };
      w.floatMin = w.floatMax = null;
      w.stattrak = null;
    } else {
      const text = typeof r.text === "string" ? r.text.trim().slice(0, 200) : "";
      if (!text) continue;
      Object.assign(w, { text, floatMin: null, floatMax: null, priceMin: null, priceMax: null, stattrak: null });
    }
    out.push({ ...w, id: newId(), label: wantLabel(w) });
  }
  return { wants: out };
}
