import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getPrices } from "@/lib/prices";

export const dynamic = "force-dynamic";

// Цены по запросу (для карточки предмета): не больше 5 названий за раз
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hashes = req.nextUrl.searchParams.getAll("hash").map((h) => h.slice(0, 200)).slice(0, 5);
  if (hashes.length === 0) return NextResponse.json({ prices: {} });
  return NextResponse.json({ prices: await getPrices(hashes, 5) });
}
