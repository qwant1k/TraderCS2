import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import type { Item } from "@/lib/steam";
import { getPrices } from "@/lib/prices";
import ItemCard from "@/components/ItemCard";

export const dynamic = "force-dynamic";

// Карточка предмета в отдельном окне. Показываем предмет из вашего инвентаря
// или предмет из лота/предложения на сайте. Чужие инвентари не читаются.
export default async function ItemPage({ params, searchParams }: { params: Promise<{ assetid: string }>; searchParams: Promise<{ popup?: string }> }) {
  const [{ assetid }, query] = await Promise.all([params, searchParams]);
  if (!/^\d{1,20}$/.test(assetid)) notFound();
  const user = await currentUser();
  const needle = `"assetid":"${assetid}"`;

  let item: Item | null = null;

  if (user) {
    const cache = await db.inventoryCache.findUnique({ where: { steamId: user.steamId } });
    if (cache) item = (JSON.parse(cache.json) as Item[]).find((i) => i.assetid === assetid) ?? null;
  }
  if (!item) {
    const listing = await db.listing.findFirst({
      where: { OR: [{ items: { some: { assetId: assetid } } }, { itemsJson: { contains: needle } }] },
      orderBy: { createdAt: "desc" },
      include: { items: { where: { assetId: assetid } } },
    });
    if (listing?.items[0]) item = JSON.parse(listing.items[0].dataJson) as Item;
    else if (listing) item = (JSON.parse(listing.itemsJson) as Item[]).find((i) => i.assetid === assetid) ?? null;
  }
  if (!item) {
    // Предметы из предложений видят только автор предложения и владелец лота
    const offer = user
      ? await db.offer.findFirst({
          where: {
            AND: [
              { OR: [{ items: { some: { assetId: assetid } } }, { itemsJson: { contains: needle } }] },
              { OR: [{ userId: user.id }, { listing: { userId: user.id } }] },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: { items: { where: { assetId: assetid } } },
        })
      : null;
    if (offer?.items[0]) item = JSON.parse(offer.items[0].dataJson) as Item;
    else if (offer) item = (JSON.parse(offer.itemsJson) as Item[]).find((i) => i.assetid === assetid) ?? null;
  }
  if (!item) notFound();

  const prices = (await getPrices([item.hash], 1))[item.hash];
  const popup = query.popup === "1";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: popup ? 12 : 28 }}>
      <ItemCard item={item} prices={prices} popup={popup} />
    </div>
  );
}
