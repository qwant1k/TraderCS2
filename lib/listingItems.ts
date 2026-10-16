import { db } from "./db";
import type { Item } from "./steam";
import { getPrices } from "./prices";
import { avgPrice } from "./pricing";
import { baseKey } from "./wants";

/** Строки ListingItem для предметов лота. Цены только из кэша/Skinport, без лишних запросов в Steam. */
export async function listingItemRows(listingId: string, items: Item[]) {
  const prices = await getPrices(items.map((i) => i.hash), 0);
  return items.map((i) => ({
    listingId,
    assetId: i.assetid,
    appId: i.appid,
    contextId: i.contextid,
    hash: i.hash,
    dataJson: JSON.stringify(i),
    baseKey: baseKey(i.hash),
    name: i.name,
    type: i.type ?? null,
    weapon: i.weapon ?? null,
    wear: i.wear ?? null,
    float: i.float ?? null,
    seed: i.seed ?? null,
    stattrak: !!i.stattrak,
    price: avgPrice(prices[i.hash]) ?? null,
  }));
}

/** Лоты, созданные до появления ListingItem: дозаполняем строки из itemsJson */
export async function ensureListingItems<T extends { id: string; itemsJson: string; items: unknown[] }>(listings: T[]) {
  for (const l of listings) {
    if (l.items.length > 0) continue;
    const rows = await listingItemRows(l.id, JSON.parse(l.itemsJson) as Item[]);
    if (rows.length === 0) continue;
    await db.listingItem.createMany({ data: rows });
    l.items = await db.listingItem.findMany({ where: { listingId: l.id } });
  }
}
