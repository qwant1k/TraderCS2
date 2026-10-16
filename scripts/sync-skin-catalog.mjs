import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const SOURCE = process.env.CS2_CATALOG_URL
  || "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";

const text = (value) => typeof value === "string" ? value.trim() : "";
const compact = (value) => text(value).normalize("NFKD").toLowerCase()
  .replace(/★/g, " ")
  .replace(/stattrak(?:™|tm)/gi, " ")
  .replace(/^\s*souvenir\s+/i, "")
  .replace(/[^a-z0-9а-яё|+\-]+/gi, " ")
  .replace(/\s+/g, " ")
  .trim();
const displayName = (value) => text(value)
  .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, "")
  .replace(/StatTrak™\s*/gi, "")
  .replace(/^\s*Souvenir\s+/i, "")
  .replace(/\s+/g, " ")
  .trim();

async function main() {
  const response = await fetch(SOURCE, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Каталог вернул HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length < 1000) {
    throw new Error(`Источник вернул неполный каталог: ${Array.isArray(payload) ? payload.length : "не массив"}`);
  }

  const rows = payload.map((skin) => {
    const name = displayName(skin.name);
    const weapon = text(skin.weapon?.name);
    const pattern = text(skin.pattern?.name);
    const category = text(skin.category?.name);
    return {
      id: text(skin.id),
      baseKey: compact(name),
      name,
      searchKey: compact(`${name} ${weapon} ${pattern} ${category}`),
      weapon,
      weaponId: text(skin.weapon?.id) || null,
      category,
      pattern: pattern || null,
      rarity: text(skin.rarity?.name) || null,
      rarityColor: /^#[0-9a-f]{6}$/i.test(text(skin.rarity?.color)) ? text(skin.rarity.color) : null,
      image: /^https:\/\//i.test(text(skin.image)) ? text(skin.image) : null,
      minFloat: Number.isFinite(skin.min_float) ? skin.min_float : null,
      maxFloat: Number.isFinite(skin.max_float) ? skin.max_float : null,
      paintIndex: skin.paint_index == null ? null : String(skin.paint_index),
      wearsJson: JSON.stringify(Array.isArray(skin.wears) ? skin.wears.map((wear) => text(wear.name)).filter(Boolean) : []),
      stattrak: skin.stattrak === true,
      souvenir: skin.souvenir === true,
    };
  }).filter((skin) => skin.id && skin.name && skin.weapon && skin.baseKey);

  const unique = Array.from(new Map(rows.map((row) => [row.id, row])).values());
  if (unique.length < 1000) throw new Error(`После проверки осталось слишком мало скинов: ${unique.length}`);

  await db.$transaction(async (tx) => {
    await tx.skinCatalog.deleteMany();
    for (let offset = 0; offset < unique.length; offset += 150) {
      await tx.skinCatalog.createMany({ data: unique.slice(offset, offset + 150) });
    }
  }, { timeout: 30_000 });

  const baseSkins = new Set(unique.map((skin) => skin.baseKey)).size;
  console.log(`Каталог синхронизирован: ${unique.length} вариантов, ${baseSkins} уникальных скинов.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
