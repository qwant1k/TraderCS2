import type { Item, Sticker } from "./steam";
import { decodeInspect } from "./inspect";

type Tag = { category: string; internal_name?: string; localized_tag_name?: string; color?: string };

function tagOf(tags: Tag[] | undefined, category: string) {
  return tags?.find((t) => t.category === category);
}

function parseStickers(descs: any[] | undefined): Sticker[] {
  const out: Sticker[] = [];
  for (const d of descs ?? []) {
    if (typeof d?.value !== "string") continue;
    if (!/sticker_info|keychain_info/.test(String(d.name)) && !/(Sticker|Charm):/.test(d.value)) continue;
    const icons = Array.from(d.value.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m: any) => m[1] as string);
    const names = /(?:Sticker|Charm):\s*([^<]+)/.exec(d.value)?.[1]?.split(",").map((x: string) => x.trim()).filter(Boolean) ?? [];
    names.forEach((n, i) => out.push({ name: n, icon: icons[i] ?? null }));
  }
  return out;
}

/** Разбирает ответ Steam inventory API. Чистая функция: без сети и базы данных. */
export function parseInventory(j: any, steamId: string): { items: Item[]; needService: { item: Item; link: string }[] } {
  const items: Item[] = [];
  const needService: { item: Item; link: string }[] = [];
  if (!j || !j.assets) return { items, needService };

  const desc = new Map<string, any>();
  for (const d of j.descriptions ?? []) desc.set(`${d.classid}_${d.instanceid}`, d);

  // Новый формат Steam: свойства предметов лежат отдельно (asset_properties), а в ссылке стоят заглушки %propid:N%
  const props = new Map<string, Map<number, any>>();
  for (const ap of j.asset_properties ?? []) {
    const m = new Map<number, any>();
    for (const p of ap.asset_properties ?? []) m.set(Number(p.propertyid), p);
    props.set(String(ap.assetid), m);
  }
  const propVal = (p: any) => p?.string_value ?? p?.int_value ?? p?.float_value;

  for (const a of j.assets) {
    const d = desc.get(`${a.classid}_${a.instanceid}`);
    if (!d) continue;

    const tags = d.tags as Tag[] | undefined;
    const quality = tagOf(tags, "Quality");
    const rarityTag = tagOf(tags, "Rarity");
    const hash: string = d.market_hash_name;
    const rawLink: string | undefined = (d.actions ?? []).find((x: any) => /inspect/i.test(String(x.name)))?.link;
    const ap = props.get(String(a.assetid));
    let link = rawLink?.replace("%owner_steamid%", steamId).replace("%assetid%", String(a.assetid));
    link = link?.replace(/%propid:(\d+)%/g, (_m, id) => {
      const v = propVal(ap?.get(Number(id)));
      return v == null ? "%propid:" + id + "%" : String(v);
    });
    if (link && /%propid:\d+%/.test(link)) link = undefined; // свойств нет: ссылку собрать нельзя
    const meta = decodeInspect(link);
    // Запасной путь: флоат и паттерн из свойств, если ссылку расшифровать не удалось
    const pf = ap && [...ap.values()].find((p) => /wear rating/i.test(String(p.name)));
    const ps = ap && [...ap.values()].find((p) => /pattern template/i.test(String(p.name)));
    if (meta.float == null && pf?.float_value != null) meta.float = parseFloat(pf.float_value);
    if (meta.seed == null && ps?.int_value != null) meta.seed = Number(ps.int_value);

    const item: Item = {
      assetid: String(a.assetid),
      appid: Number(a.appid),
      contextid: String(a.contextid),
      name: d.name,
      hash,
      icon: `https://community.cloudflare.steamstatic.com/economy/image/${d.icon_url}/360fx360f`,
      color: d.name_color ? `#${d.name_color}` : rarityTag?.color ? `#${rarityTag.color}` : null,
      tradable: d.tradable === 1,
      marketable: d.marketable === 1,
      wear: tagOf(tags, "Exterior")?.localized_tag_name,
      rarity: rarityTag?.localized_tag_name,
      type: tagOf(tags, "Type")?.localized_tag_name,
      weapon: tagOf(tags, "Weapon")?.localized_tag_name,
      stattrak: quality?.internal_name === "strange" || hash.startsWith("StatTrak™"),
      souvenir: quality?.internal_name === "tournament" || hash.startsWith("Souvenir"),
      float: meta.float,
      seed: meta.seed,
      stickers: parseStickers(d.descriptions),
      inspect: link,
    };
    items.push(item);
    if (item.float == null && link && item.wear) needService.push({ item, link });
  }
  return { items, needService };
}
