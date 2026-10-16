import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { InventoryError, pickOwnedItems } from "@/lib/steam";
import { trustFor, userStats } from "@/lib/trust";
import { itemRecord } from "@/lib/items";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 10;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tradeUrl) {
    return NextResponse.json({ error: "no_trade_url", message: "Сначала добавьте трейд-ссылку в профиле" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const listingId = String(body.listingId || "");
  const variantIdRaw = typeof body.variantId === "string" ? body.variantId : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
  const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.map(String) : [];

  if (assetIds.length === 0 || assetIds.length > MAX_ITEMS) {
    return NextResponse.json({ error: "bad_items", message: `Выберите от 1 до ${MAX_ITEMS} предметов` }, { status: 400 });
  }

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "closed", message: "Лот уже закрыт" }, { status: 409 });
  }
  if (listing.userId === user.id) {
    return NextResponse.json({ error: "own", message: "Нельзя предлагать обмен на свой лот" }, { status: 400 });
  }

  const listingVariants = JSON.parse(listing.variantsJson || "[]") as { id: string }[];
  const variantId = listingVariants.some((v) => v.id === variantIdRaw) ? variantIdRaw : null;

  const stats = await userStats(user.id);
  const trust = trustFor(user, stats.completed);
  const today = await db.offer.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } });
  if (today >= trust.limits.offersPerDay) {
    return NextResponse.json(
      { error: "limit", message: `Лимит предложений за сутки для уровня «${trust.title}»: ${trust.limits.offersPerDay}. Повысьте уровень доверия в настройках.` },
      { status: 429 },
    );
  }
  const dup = await db.offer.findFirst({ where: { userId: user.id, listingId, status: "PENDING" } });
  if (dup) return NextResponse.json({ error: "dup", message: "Вы уже отправили предложение на этот лот" }, { status: 409 });

  let items;
  try {
    items = await pickOwnedItems(user.steamId, assetIds);
  } catch (e) {
    const msg = e instanceof InventoryError ? e.message : "Не удалось проверить инвентарь";
    return NextResponse.json({ error: "inventory", message: msg }, { status: 502 });
  }
  if (!items) {
    return NextResponse.json({ error: "not_owned", message: "Некоторых предметов нет в инвентаре или они не обмениваются" }, { status: 400 });
  }

  try {
    const offer = await db.$transaction(async (tx) => {
      const current = await tx.listing.findUnique({ where: { id: listingId }, select: { status: true } });
      if (current?.status !== "ACTIVE") throw new Error("listing_closed");
      const existing = await tx.offer.findFirst({ where: { userId: user.id, listingId, status: "PENDING" } });
      if (existing) throw new Error("duplicate_offer");
      return tx.offer.create({
        data: {
          listingId,
          userId: user.id,
          itemsJson: JSON.stringify(items),
          variantId,
          message: message || null,
          items: { create: items.map(itemRecord) },
        },
      });
    });
    return NextResponse.json({ id: offer.id });
  } catch (error) {
    // Лот мог быть зарезервирован, пока Steam проверял инвентарь.
    if (error instanceof Error && (error.message === "listing_closed" || error.message === "duplicate_offer")) {
      return NextResponse.json({ error: "closed", message: "Лот больше не принимает предложения" }, { status: 409 });
    }
    throw error;
  }
}
