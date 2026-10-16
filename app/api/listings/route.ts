import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { InventoryError, pickOwnedItems } from "@/lib/steam";
import { trustFor, userStats } from "@/lib/trust";
import { itemRecord } from "@/lib/items";
import { parseWants } from "@/lib/wants";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 10;
const MAX_VARIANTS = 5;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tradeUrl) {
    return NextResponse.json({ error: "no_trade_url", message: "Сначала добавьте трейд-ссылку в профиле" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type === "SPECIFIC" ? "SPECIFIC" : "OPEN";
  const rawWants = type === "SPECIFIC"
    ? (Array.isArray(body.wants)
      ? body.wants
      : (Array.isArray(body.variants) ? body.variants : []).map((text: unknown) => ({ kind: "TEXT", text })))
    : [];
  const parsed = parseWants(rawWants, MAX_VARIANTS, randomUUID);
  if ("error" in parsed) {
    return NextResponse.json({ error: "bad_wants", message: parsed.error }, { status: 400 });
  }
  const wants = parsed.wants;
  const variants = wants.map((want) => ({ id: want.id, text: want.label }));
  const wanted = variants.map((v) => v.text).join(" / ");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds.map(String) : [];

  if (assetIds.length === 0 || assetIds.length > MAX_ITEMS) {
    return NextResponse.json({ error: "bad_items", message: `Выберите от 1 до ${MAX_ITEMS} предметов` }, { status: 400 });
  }
  if (type === "SPECIFIC" && variants.length === 0) {
    return NextResponse.json({ error: "no_wanted", message: "Добавьте хотя бы один вариант: что вы хотите получить" }, { status: 400 });
  }

  const stats = await userStats(user.id);
  const trust = trustFor(user, stats.completed);
  if (stats.activeListings >= trust.limits.listings) {
    return NextResponse.json(
      { error: "limit", message: `Ваш уровень («${trust.title}») позволяет до ${trust.limits.listings} активных лотов. Повысьте уровень доверия в настройках.` },
      { status: 429 },
    );
  }

  // Предмет может лежать только в одном активном лоте
  const busy = await db.activeListingItem.findMany({ where: { userId: user.id }, select: { assetId: true } });
  const busyIds = new Set(busy.map((i) => i.assetId));
  if (assetIds.some((id) => busyIds.has(id))) {
    return NextResponse.json({ error: "busy", message: "Один из предметов уже выставлен в другом лоте" }, { status: 409 });
  }

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
    const listing = await db.listing.create({
      data: {
        userId: user.id,
        type,
        wanted: wanted || null,
        variantsJson: JSON.stringify(variants),
        note: note || null,
        itemsJson: JSON.stringify(items),
        items: { create: items.map(itemRecord) },
        wants: {
          create: wants.map((want) => ({
            id: want.id,
            userId: user.id,
            kind: want.kind,
            base: want.base,
            baseKey: want.baseKey,
            category: want.category,
            floatMin: want.floatMin,
            floatMax: want.floatMax,
            stattrak: want.stattrak,
            priceMin: want.priceMin,
            priceMax: want.priceMax,
            text: want.text,
            label: want.label,
          })),
        },
        activeItems: {
          create: items.map((item) => ({
            userId: user.id,
            assetId: item.assetid,
            appId: item.appid,
            contextId: item.contextid,
          })),
        },
      },
    });
    return NextResponse.json({ id: listing.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "busy", message: "Один из предметов уже находится в активном лоте" }, { status: 409 });
    }
    throw error;
  }
}
