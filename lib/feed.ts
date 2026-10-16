import { db } from "./db";
import { ensureListingItems } from "./listingItems";
import { storedItems } from "./items";
import { getPrices } from "./prices";
import { avgPrice } from "./pricing";
import type { Item } from "./steam";
import { trustFor } from "./trust";
import { matchWant, type Want } from "./wants";
import type { FeedItemView, FeedLot, FeedResponse } from "./feedTypes";

const asWant = (want: { kind: string } & Omit<Want, "kind">): Want => ({
  ...want,
  kind: want.kind as Want["kind"],
});

const sumKnown = (values: Array<number | undefined>) => {
  const known = values.filter((value): value is number => value != null);
  return known.length === values.length && known.length > 0
    ? known.reduce((sum, value) => sum + value, 0)
    : undefined;
};

/** Формирует персональную ленту, не обращаясь к Steam за инвентарём. */
export async function buildFeed(user: { id: string; steamId: string }): Promise<FeedResponse> {
  const [cache, rawMyWants, listings] = await Promise.all([
    db.inventoryCache.findUnique({ where: { steamId: user.steamId } }),
    db.want.findMany({
      where: {
        userId: user.id,
        kind: { not: "TEXT" },
        OR: [{ listingId: null }, { listing: { status: "ACTIVE" } }],
      },
    }),
    db.listing.findMany({
      where: { status: "ACTIVE", userId: { not: user.id } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        user: true,
        wants: true,
        items: true,
      },
    }),
  ]);

  await ensureListingItems(listings);

  const myItems: Item[] = cache
    ? (JSON.parse(cache.json) as Item[]).filter((item) => item.tradable)
    : [];
  const myWants = rawMyWants.map(asWant);
  const listingItems = listings.flatMap((listing) => storedItems(listing.items, listing.itemsJson));
  const prices = await getPrices(
    [...myItems, ...listingItems].map((item) => item.hash),
    0,
  );

  const completed = new Map<string, number>();
  const ownerIds = listings.map((listing) => listing.userId);
  if (ownerIds.length > 0) {
    const completedOffers = await db.offer.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ userId: { in: ownerIds } }, { listing: { userId: { in: ownerIds } } }],
      },
      select: { userId: true, listing: { select: { userId: true } } },
    });
    for (const offer of completedOffers) {
      completed.set(offer.userId, (completed.get(offer.userId) ?? 0) + 1);
      completed.set(offer.listing.userId, (completed.get(offer.listing.userId) ?? 0) + 1);
    }
  }

  const wantedByAssetId: Record<string, number> = {};
  const priority: FeedLot[] = [];
  const rest: FeedLot[] = [];

  for (const listing of listings) {
    const wants = listing.wants.filter((want) => want.kind !== "TEXT").map(asWant);
    const matches = wants
      .map((want) => ({
        want,
        mine: myItems.filter((item) => matchWant(item, avgPrice(prices[item.hash]), want)),
      }))
      .filter((match) => match.mine.length > 0);

    const matchedAssetIds = new Set(matches.flatMap((match) => match.mine.map((item) => item.assetid)));
    for (const assetId of matchedAssetIds) {
      wantedByAssetId[assetId] = (wantedByAssetId[assetId] ?? 0) + 1;
    }

    const rawOffers = storedItems(listing.items, listing.itemsJson);
    const offers: FeedItemView[] = rawOffers.map((item) => ({
      ...item,
      priceUsd: avgPrice(prices[item.hash])
        ?? listing.items.find((row) => row.assetId === item.assetid)?.price
        ?? undefined,
    }));
    const theyHave = listing.items.some((item) =>
      myWants.some((want) => matchWant(item, item.price, want)),
    );
    const firstMatch = matches[0];
    const matchedMine = firstMatch?.mine[0];
    const matchedMineView: FeedItemView | undefined = matchedMine
      ? { ...matchedMine, priceUsd: avgPrice(prices[matchedMine.hash]) }
      : undefined;
    const giveUsd = matchedMineView?.priceUsd;
    const getUsd = sumKnown(offers.map((item) => item.priceUsd));
    const ownerTrust = trustFor(listing.user, completed.get(listing.userId) ?? 0);
    const otherWants = firstMatch
      ? wants.filter((want) => want.id !== firstMatch.want.id).map((want) => want.label)
      : [];
    const matchedCondition = firstMatch?.want.label.split(" · ").slice(1).join(" · ");

    const lot: FeedLot = {
      id: listing.id,
      createdAt: listing.createdAt.toISOString(),
      owner: {
        steamId: listing.user.steamId,
        name: listing.user.name,
        avatar: listing.user.avatar,
        trustLevel: ownerTrust.level,
      },
      offers,
      matchedMine: matchedMineView,
      matchedAssetIds: Array.from(matchedAssetIds),
      matchedWishes: Object.fromEntries(
        matches.flatMap((match) => match.mine.map((item) => [item.assetid, match.want.id])),
      ),
      wishVariantId: firstMatch?.want.id,
      altText: otherWants.length > 0
        ? `или ${otherWants.slice(0, 2).join(" / ")}`
        : matchedCondition || undefined,
      wantsText: listing.type === "OPEN"
        ? "Открыт для предложений"
        : listing.wants.map((want) => want.label).filter(Boolean).join(" / ") || listing.wanted || "Хочет конкретное",
      mutual: !!firstMatch && theyHave,
      giveUsd,
      getUsd,
      deltaUsd: giveUsd != null && getUsd != null ? getUsd - giveUsd : undefined,
    };

    if (firstMatch) priority.push(lot);
    else rest.push(lot);
  }

  priority.sort((a, b) => Number(b.mutual) - Number(a.mutual) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  rest.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    priority,
    rest,
    counts: {
      all: priority.length + rest.length,
      wanted: priority.length,
      mutual: priority.filter((lot) => lot.mutual).length,
    },
    wantedByAssetId,
  };
}
