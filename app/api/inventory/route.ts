import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getInventory, InventoryError } from "@/lib/steam";
import { getPrices } from "@/lib/prices";
import { takeRateLimit } from "@/lib/rate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (refresh) {
    const rate = takeRateLimit(`inventory-refresh:${user.id}`, 6, 60_000);
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  }
  try {
    const items = await getInventory(user.steamId, refresh);
    const tradable = items.filter((i) => i.tradable);
    const prices = await getPrices(tradable.map((i) => i.hash));

    // Предметы, которые уже лежат в активных лотах, нельзя выставить второй раз
    const active = await db.activeListingItem.findMany({ where: { userId: user.id }, select: { assetId: true } });
    const busy = active.map((i) => i.assetId);

    return NextResponse.json({ items: tradable, prices, busy });
  } catch (e) {
    if (e instanceof InventoryError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.code === "private" ? 403 : 502 });
    }
    return NextResponse.json({ error: "unavailable", message: "Не удалось загрузить инвентарь" }, { status: 500 });
  }
}
