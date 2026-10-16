import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { catalogScore, catalogSearchKey } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Подсказки названий предметов: GET /api/catalog?q=redline
export async function GET(req: NextRequest) {
  const q = catalogSearchKey((req.nextUrl.searchParams.get("q") ?? "").slice(0, 80));
  if (q.length < 1) return NextResponse.json({ items: [] });
  const words = q.split(/\s+/);
  const variants = await db.skinCatalog.findMany({
    where: { AND: words.map((word) => ({ searchKey: { contains: word } })) },
    select: {
      baseKey: true, name: true, weapon: true, category: true, rarity: true,
      rarityColor: true, image: true, minFloat: true, maxFloat: true,
      wearsJson: true, stattrak: true, souvenir: true,
    },
    take: 120,
  });

  const grouped = new Map<string, {
    name: string; weapon: string; category: string; rarity: string | null;
    rarityColor: string | null; image: string | null; minFloat: number | null;
    maxFloat: number | null; wears: string[]; stattrak: boolean; souvenir: boolean;
  }>();
  for (const skin of variants) {
    const current = grouped.get(skin.baseKey);
    if (current) {
      current.stattrak ||= skin.stattrak;
      current.souvenir ||= skin.souvenir;
      continue;
    }
    grouped.set(skin.baseKey, {
      name: skin.name,
      weapon: skin.weapon,
      category: skin.category,
      rarity: skin.rarity,
      rarityColor: skin.rarityColor,
      image: skin.image,
      minFloat: skin.minFloat,
      maxFloat: skin.maxFloat,
      wears: JSON.parse(skin.wearsJson) as string[],
      stattrak: skin.stattrak,
      souvenir: skin.souvenir,
    });
  }

  const items = Array.from(grouped.values())
    .sort((a, b) => catalogScore(a.name, a.weapon, q) - catalogScore(b.name, b.weapon, q) || a.name.localeCompare(b.name))
    .slice(0, 24);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=60" } });
}
