import { db } from "./db";
import type { Item } from "./steam";
import { getPrices } from "./prices";
import { avgPrice } from "./pricing";
import { ensureListingItems } from "./listingItems";
import { matchWant, type Want } from "./wants";

export type MatchRow = {
  listing: { id: string; type: string; createdAt: Date; user: { name: string; avatar: string | null; steamId: string } };
  items: Item[];
  /** Ваши предметы, подходящие под их варианты: [вариант, ваши предметы] */
  canGive: { want: Want; mine: Item[] }[];
  /** Их предметы (assetid), подходящие под ваши пожелания */
  theyHave: string[];
  mutual: boolean;
};

const asWant = (w: { kind: string } & Omit<Want, "kind">): Want => ({ ...w, kind: w.kind as Want["kind"] });

/** Подбор пар для пользователя по его инвентарю (из кэша) и его пожеланиям */
export async function findMatches(user: { id: string; steamId: string }) {
  const cache = await db.inventoryCache.findUnique({ where: { steamId: user.steamId } });
  const myItems: Item[] = cache ? (JSON.parse(cache.json) as Item[]).filter((i) => i.tradable) : [];
  const myPrices = await getPrices(myItems.map((i) => i.hash), 0);

  const myWants = (
    await db.want.findMany({
      where: { userId: user.id, kind: { not: "TEXT" }, OR: [{ listingId: null }, { listing: { status: "ACTIVE" } }] },
    })
  ).map(asWant);

  const listings = await db.listing.findMany({
    where: { status: "ACTIVE", userId: { not: user.id } },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { name: true, avatar: true, steamId: true } }, wants: true, items: true },
  });
  await ensureListingItems(listings);

  const rows: MatchRow[] = [];
  for (const l of listings) {
    const wants = l.wants.filter((w) => w.kind !== "TEXT").map(asWant);
    const canGive = wants
      .map((want) => ({ want, mine: myItems.filter((it) => matchWant(it, avgPrice(myPrices[it.hash]), want)) }))
      .filter((g) => g.mine.length > 0);
    const theyHave = l.items.filter((li) => myWants.some((w) => matchWant(li, li.price, w))).map((li) => li.assetId);
    if (canGive.length === 0 && theyHave.length === 0) continue;
    rows.push({
      listing: { id: l.id, type: l.type, createdAt: l.createdAt, user: l.user },
      items: JSON.parse(l.itemsJson) as Item[],
      canGive,
      theyHave,
      mutual: canGive.length > 0 && theyHave.length > 0,
    });
  }
  rows.sort((a, b) => Number(b.mutual) - Number(a.mutual) || b.listing.createdAt.getTime() - a.listing.createdAt.getTime());
  return { rows, hasInventory: !!cache, wantsCount: myWants.length };
}
