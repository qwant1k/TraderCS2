import { db } from "./db";
import { fetchFloatFromService } from "./inspect";
import { parseInventory } from "./parse";
import { fetchWithTimeout } from "./http";

export const STEAM_ID_BASE = BigInt("76561197960265728");
export const APP_CS2 = 730;
export const CONTEXT_CS2 = 2;

export type Sticker = { name: string; icon: string | null };

export type Item = {
  assetid: string;
  appid: number;
  contextid: string;
  name: string;
  hash: string; // market_hash_name
  icon: string; // полный URL картинки
  color: string | null; // цвет редкости
  tradable: boolean;
  marketable: boolean;
  // Подробности (могут отсутствовать у старых записей кэша)
  wear?: string; // Factory New … Battle-Scarred
  rarity?: string;
  type?: string; // Rifle, Pistol, Knife…
  weapon?: string;
  stattrak?: boolean;
  souvenir?: boolean;
  float?: number;
  seed?: number;
  stickers?: Sticker[];
  inspect?: string; // готовая inspect-ссылка для запуска в игре
};

export function appBase() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (!/^https?:$/.test(url.protocol)) throw new Error("APP_URL должен использовать http или https");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("В production APP_URL должен использовать https");
  }
  return url.origin;
}

export function steamAccountId(steamId64: string) {
  return (BigInt(steamId64) - STEAM_ID_BASE).toString();
}

// ---------- OpenID ----------

export function openIdLoginUrl(state: string) {
  const base = appBase();
  const returnTo = `${base}/api/auth/steam/callback?state=${encodeURIComponent(state)}`;
  const p = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": base,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${p.toString()}`;
}

/** Проверяет ответ Steam и возвращает SteamID64 или null. */
export async function verifyOpenId(params: URLSearchParams, state: string): Promise<string | null> {
  const returnTo = params.get("openid.return_to") || "";
  if (returnTo !== `${appBase()}/api/auth/steam/callback?state=${encodeURIComponent(state)}`) return null;

  const claimed = params.get("openid.claimed_id") || "";
  const m = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!m) return null;

  const body = new URLSearchParams();
  params.forEach((v, k) => {
    if (k.startsWith("openid.")) body.set(k, v);
  });
  body.set("openid.mode", "check_authentication");

  const res = await fetchWithTimeout("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  }, 8_000);
  const text = await res.text();
  return /is_valid\s*:\s*true/.test(text) ? m[1] : null;
}

// ---------- Профиль ----------

export async function fetchProfile(steamId: string): Promise<{ name: string; avatar: string | null }> {
  const key = process.env.STEAM_API_KEY;
  try {
    if (key) {
      const r = await fetchWithTimeout(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
        { cache: "no-store" }, 8_000,
      );
      const j = await r.json();
      const p = j?.response?.players?.[0];
      if (p) return { name: p.personaname, avatar: p.avatarfull ?? null };
    }
    const r = await fetchWithTimeout(`https://steamcommunity.com/profiles/${steamId}?xml=1`, { cache: "no-store" }, 8_000);
    const x = await r.text();
    const name = x.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1];
    const avatar = x.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1];
    if (name) return { name, avatar: avatar ?? null };
  } catch {
    /* падаем на значение по умолчанию */
  }
  return { name: `Steam ${steamId.slice(-6)}`, avatar: null };
}

// ---------- Инвентарь ----------

const INV_TTL_MS = 5 * 60 * 1000;

export class InventoryError extends Error {
  code: "private" | "rate_limited" | "unavailable";
  constructor(code: "private" | "rate_limited" | "unavailable", msg: string) {
    super(msg);
    this.code = code;
  }
}

async function loadFromSteam(steamId: string): Promise<Item[]> {
  const url = `https://steamcommunity.com/inventory/${steamId}/${APP_CS2}/${CONTEXT_CS2}?l=english&count=2000`;
  const res = await fetchWithTimeout(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 TradeGG" } }, 10_000);
  if (res.status === 403) throw new InventoryError("private", "Инвентарь закрыт. Откройте его в настройках приватности Steam.");
  if (res.status === 429) throw new InventoryError("rate_limited", "Steam временно ограничил запросы. Повторите через минуту.");
  if (!res.ok) throw new InventoryError("unavailable", `Steam вернул ошибку ${res.status}`);
  const { items, needService } = parseInventory(await res.json(), steamId);

  // Необязательный внешний сервис осмотра для старых ссылок (FLOAT_API_URL), с ограничением объёма
  if (process.env.FLOAT_API_URL && needService.length > 0) {
    const batch = needService.slice(0, 60);
    for (let i = 0; i < batch.length; i += 5) {
      await Promise.all(
        batch.slice(i, i + 5).map(async ({ item, link }) => {
          const r = await fetchFloatFromService(link);
          if (r.float != null) item.float = r.float;
          if (r.seed != null) item.seed = r.seed;
        }),
      );
    }
  }
  return items;
}


export async function getInventory(steamId: string, force = false): Promise<Item[]> {
  const cached = await db.inventoryCache.findUnique({ where: { steamId } });
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < INV_TTL_MS;
  if (cached && fresh && !force) return JSON.parse(cached.json);
  try {
    const items = await loadFromSteam(steamId);
    await db.inventoryCache.upsert({
      where: { steamId },
      create: { steamId, json: JSON.stringify(items), fetchedAt: new Date() },
      update: { json: JSON.stringify(items), fetchedAt: new Date() },
    });
    return items;
  } catch (e) {
    if (cached && e instanceof InventoryError && e.code === "rate_limited") return JSON.parse(cached.json);
    throw e;
  }
}

/** Берёт из свежего инвентаря только те предметы, которые реально есть и обмениваются. */
export async function pickOwnedItems(steamId: string, assetIds: string[]): Promise<Item[] | null> {
  const inv = await getInventory(steamId, true);
  const byId = new Map(inv.map((i) => [i.assetid, i]));
  const out: Item[] = [];
  for (const id of new Set(assetIds)) {
    const it = byId.get(id);
    if (!it || !it.tradable) return null;
    out.push(it);
  }
  return out;
}

// ---------- Трейд-ссылка ----------

const TRADE_URL_RE = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=(\d+)&token=([A-Za-z0-9_-]+)$/;

export function parseTradeUrl(url: string): { partner: string; token: string } | null {
  const m = url.trim().match(TRADE_URL_RE);
  return m ? { partner: m[1], token: m[2] } : null;
}

/** Проверяет, что ссылка принадлежит именно этому SteamID. */
export function tradeUrlMatches(url: string, steamId: string) {
  const p = parseTradeUrl(url);
  return !!p && p.partner === steamAccountId(steamId);
}
