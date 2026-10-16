import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getPrices } from "@/lib/prices";
import { takeRateLimit } from "@/lib/rate";

export const dynamic = "force-dynamic";

const SNAP_EVERY_MS = 30 * 60 * 1000;

// Данные для карточки: динамика цены, кто сейчас предлагает и кто сейчас хочет такой предмет
export async function GET(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("item-market", e);
    return NextResponse.json({ history: [], offered: [], wanted: [], degraded: true });
  }
}

async function handle(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rate = takeRateLimit(`market:${user.id}`, 30, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const hash = (req.nextUrl.searchParams.get("hash") ?? "").slice(0, 200);
  if (!hash) return NextResponse.json({ error: "hash" }, { status: 400 });
  // «Название без износа» для поиска среди пожеланий
  const base = hash.replace(/\s*\([^)]*\)\s*$/, "").replace(/^StatTrak™\s*/, "").replace(/^Souvenir\s*/, "").toLowerCase();

  // Снимок цены: не чаще раза в 30 минут на предмет
  const last = await db.priceSnapshot.findFirst({ where: { hash }, orderBy: { at: "desc" } });
  if (!last || Date.now() - last.at.getTime() > SNAP_EVERY_MS) {
    const p = (await getPrices([hash], 1))[hash];
    if (p && (p.steam != null || p.skinport != null)) {
      await db.$transaction([
        db.priceSnapshot.create({ data: { hash, steam: p.steam ?? null, skinport: p.skinport ?? null } }),
        db.priceSnapshot.deleteMany({ where: { hash, at: { lt: new Date(Date.now() - 90 * 24 * 3600 * 1000) } } }),
      ]);
    }
  }
  const history = await db.priceSnapshot.findMany({ where: { hash }, orderBy: { at: "asc" }, take: 500 });

  const [offeredRows, active] = await Promise.all([
    db.listing.findMany({
      where: { status: "ACTIVE", items: { some: { hash } } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true, steamId: true } } },
    }),
    db.listing.findMany({
    where: { status: "ACTIVE", type: "SPECIFIC" },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true, steamId: true } } },
  }),
  ]);
  const offered = offeredRows
    .map((l) => ({ id: l.id, user: l.user.name, mine: l.userId === user.id, type: l.type }));
  const wanted = active
    .filter((l) => l.type === "SPECIFIC" && base && `${l.wanted ?? ""} ${l.variantsJson}`.toLowerCase().includes(base))
    .slice(0, 10)
    .map((l) => ({ id: l.id, user: l.user.name, mine: l.userId === user.id, text: l.wanted ?? "" }));

  return NextResponse.json({
    history: history.map((h) => ({ t: h.at.getTime(), steam: h.steam, skinport: h.skinport })),
    offered,
    wanted,
  });
}
