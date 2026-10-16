import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getInventory, type Item } from "@/lib/steam";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

async function stillOwns(steamId: string, items: Item[]) {
  const inv = await getInventory(steamId, true);
  const have = new Set(inv.filter((i) => i.tradable).map((i) => i.assetid));
  return items.every((i) => have.has(i.assetid));
}

/**
 * action:
 *  - accept: владелец лота принимает предложение. Проверяем, что предметы обеих сторон всё ещё на месте.
 *  - decline: владелец лота отклоняет.
 *  - cancel: автор предложения отзывает его.
 *  - done: каждая сторона отдельно подтверждает завершение; второе подтверждение закрывает лот.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json().catch(() => ({ action: "" }));
  const offer = await db.offer.findUnique({
    where: { id },
    include: { listing: { include: { items: true } }, user: true, items: true },
  });
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = offer.listing.userId === user.id;
  const isAuthor = offer.userId === user.id;

  if (action === "cancel") {
    if (!isAuthor || offer.status !== "PENDING") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const changed = await db.offer.updateMany({ where: { id: offer.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) return NextResponse.json({ error: "closed" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === "done") {
    if (!isOwner && !isAuthor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (offer.status !== "ACCEPTED") return NextResponse.json({ error: "closed" }, { status: 409 });
    const result = await db.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: offer.id },
        data: isOwner ? { ownerConfirmedAt: new Date() } : { authorConfirmedAt: new Date() },
      });
      const confirmed = await tx.offer.findUniqueOrThrow({ where: { id: offer.id } });
      if (!confirmed.ownerConfirmedAt || !confirmed.authorConfirmedAt) return { completed: false };

      await tx.offer.update({ where: { id: offer.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.listing.updateMany({ where: { id: offer.listingId, status: "RESERVED" }, data: { status: "CLOSED" } });
      await tx.activeListingItem.deleteMany({ where: { listingId: offer.listingId } });
      return { completed: true };
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (!isOwner) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (action === "decline") {
    if (offer.status !== "PENDING") return NextResponse.json({ error: "closed" }, { status: 409 });
    const changed = await db.offer.updateMany({ where: { id: offer.id, status: "PENDING" }, data: { status: "DECLINED" } });
    if (changed.count !== 1) return NextResponse.json({ error: "closed" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    if (offer.status !== "PENDING" || offer.listing.status !== "ACTIVE") {
      return NextResponse.json({ error: "closed", message: "Предложение или лот уже закрыты" }, { status: 409 });
    }
    const mine = storedItems(offer.listing.items, offer.listing.itemsJson);
    const theirs = storedItems(offer.items, offer.itemsJson);

    let ok = false;
    try {
      ok = (await stillOwns(user.steamId, mine)) && (await stillOwns(offer.user.steamId, theirs));
    } catch {
      return NextResponse.json({ error: "inventory", message: "Не удалось проверить инвентари. Попробуйте позже." }, { status: 502 });
    }
    if (!ok) {
      await db.offer.updateMany({ where: { id: offer.id, status: "PENDING" }, data: { status: "INVALID" } });
      return NextResponse.json(
        { error: "items_gone", message: "Часть предметов уже не в инвентаре. Предложение отмечено как недействительное." },
        { status: 409 },
      );
    }

    // Принятое предложение закрепляет лот, остальные ожидающие отклоняются
    try {
      await db.$transaction(async (tx) => {
        const reserved = await tx.listing.updateMany({
          where: { id: offer.listingId, status: "ACTIVE" },
          data: { status: "RESERVED" },
        });
        if (reserved.count !== 1) throw new Error("offer_conflict");

        const accepted = await tx.offer.updateMany({
          where: { id: offer.id, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
        if (accepted.count !== 1) throw new Error("offer_conflict");
        await tx.offer.updateMany({
          where: { listingId: offer.listingId, status: "PENDING", id: { not: offer.id } },
          data: { status: "DECLINED" },
        });
      });
    } catch {
      return NextResponse.json({ error: "closed", message: "Другое предложение уже принято" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
