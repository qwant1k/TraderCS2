import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();
let listingItems = 0;
let offerItems = 0;
let locks = 0;

const record = (item) => ({
  assetId: String(item.assetid),
  appId: Number(item.appid),
  contextId: String(item.contextid),
  hash: String(item.hash ?? item.name ?? ""),
  dataJson: JSON.stringify(item),
});

try {
  const listings = await db.listing.findMany({ include: { items: true } });
  for (const listing of listings) {
    let items;
    try { items = JSON.parse(listing.itemsJson); } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.assetid || !item?.appid || !item?.contextid) continue;
      const data = record(item);
      await db.listingItem.upsert({
        where: { listingId_assetId: { listingId: listing.id, assetId: data.assetId } },
        create: { listingId: listing.id, ...data },
        update: { ...data },
      });
      listingItems++;
      if (listing.status === "ACTIVE" || listing.status === "RESERVED") {
        try {
          await db.activeListingItem.upsert({
            where: { listingId_assetId: { listingId: listing.id, assetId: data.assetId } },
            create: { listingId: listing.id, userId: listing.userId, assetId: data.assetId, appId: data.appId, contextId: data.contextId },
            update: {},
          });
          locks++;
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
          console.warn(`Пропущен занятый asset ${data.assetId} в лоте ${listing.id}`);
        }
      }
    }
  }

  const offers = await db.offer.findMany();
  for (const offer of offers) {
    let items;
    try { items = JSON.parse(offer.itemsJson); } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.assetid || !item?.appid || !item?.contextid) continue;
      const data = record(item);
      await db.offerItem.upsert({
        where: { offerId_assetId: { offerId: offer.id, assetId: data.assetId } },
        create: { offerId: offer.id, ...data },
        update: { ...data },
      });
      offerItems++;
    }
  }
  console.log({ listingItems, offerItems, locks });
} finally {
  await db.$disconnect();
}
