// Помощники для подбора пар: средняя цена и каталог названий для подсказок.
// Отдельный модуль, чтобы не менять lib/prices.ts.
import { fetchWithTimeout } from "./http";
import type { PriceSet } from "./prices";
import { baseKey, baseName } from "./wants";

/** Средняя цена по доступным источникам */
export function avgPrice(p?: PriceSet) {
  const v = [p?.steam, p?.skinport].filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

export type CatalogEntry = { name: string; key: string; min: number };
const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; list: CatalogEntry[] } | null = null;

/** Названия предметов без износа (из выгрузки Skinport), с минимальной ценой */
export async function catalog(): Promise<CatalogEntry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.list;
  const byKey = new Map<string, CatalogEntry>();
  try {
    const r = await fetchWithTimeout("https://api.skinport.com/v1/items?app_id=730&currency=USD", {
      headers: { "Accept-Encoding": "br, gzip, deflate" },
      cache: "no-store",
    }, 10_000);
    if (r.ok) {
      const arr = (await r.json()) as { market_hash_name: string; min_price: number | null }[];
      for (const it of arr) {
        if (it.min_price == null) continue;
        const key = baseKey(it.market_hash_name);
        const cur = byKey.get(key);
        if (!cur) byKey.set(key, { name: baseName(it.market_hash_name), key, min: it.min_price });
        else if (it.min_price < cur.min) cur.min = it.min_price;
      }
    }
  } catch {
    /* источник недоступен */
  }
  if (byKey.size > 0 || !cache) {
    cache = { at: Date.now(), list: Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  return cache.list;
}
