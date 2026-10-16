import { fetchWithTimeout } from "./http";

// Цены нужны как ориентир. Любой источник может быть недоступен: возвращаем то, что есть.
export type PriceSet = {
  steam?: number;
  skinport?: number;
  updatedAt: number;
};

const TTL_MS = 30 * 60 * 1000;
let skinportCache: { at: number; map: Map<string, number> } | null = null;
const steamCache = new Map<string, { at: number; price?: number }>();

async function skinportMap(): Promise<Map<string, number>> {
  if (skinportCache && Date.now() - skinportCache.at < TTL_MS) return skinportCache.map;
  const map = new Map<string, number>();
  try {
    const r = await fetchWithTimeout("https://api.skinport.com/v1/items?app_id=730&currency=USD", {
      headers: { "Accept-Encoding": "br, gzip, deflate" },
      cache: "no-store",
    }, 10_000);
    if (r.ok) {
      const arr = (await r.json()) as { market_hash_name: string; min_price: number | null }[];
      for (const it of arr) if (it.min_price != null) map.set(it.market_hash_name, it.min_price);
    }
  } catch {
    /* источник недоступен */
  }
  if (map.size > 0 || !skinportCache) skinportCache = { at: Date.now(), map };
  return skinportCache.map;
}

async function steamPrice(hash: string): Promise<number | undefined> {
  const c = steamCache.get(hash);
  if (c && Date.now() - c.at < TTL_MS) return c.price;
  let price: number | undefined;
  try {
    const r = await fetchWithTimeout(
      `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(hash)}`,
      { cache: "no-store" }, 6_000,
    );
    if (r.ok) {
      const j = await r.json();
      const raw: string | undefined = j?.lowest_price || j?.median_price;
      if (raw) price = parseFloat(raw.replace(/[^0-9.]/g, ""));
    }
  } catch {
    /* источник недоступен */
  }
  steamCache.set(hash, { at: Date.now(), price });
  return price;
}

/** Цены для списка предметов. Steam опрашиваем ограниченно, чтобы не поймать лимит. */
export async function getPrices(hashes: string[], steamLimit = 8): Promise<Record<string, PriceSet>> {
  const unique = Array.from(new Set(hashes));
  const sp = await skinportMap();
  const out: Record<string, PriceSet> = {};
  const missing = unique.filter((h) => {
    const cached = steamCache.get(h);
    return !cached || Date.now() - cached.at >= TTL_MS;
  }).slice(0, steamLimit);
  await Promise.all(missing.map((h) => steamPrice(h)));

  for (const h of unique) {
    const set: PriceSet = { updatedAt: Date.now() };
    const s = sp.get(h);
    if (s != null) set.skinport = s;
    const cached = steamCache.get(h);
    if (cached && Date.now() - cached.at < TTL_MS) set.steam = cached.price;
    out[h] = set;
  }
  return out;
}
