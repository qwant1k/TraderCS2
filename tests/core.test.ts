import test from "node:test";
import assert from "node:assert/strict";
import { openIdLoginUrl, parseTradeUrl, steamAccountId, tradeUrlMatches } from "../lib/steam";
import { trustFor } from "../lib/trust";
import { readLimited, UpstreamError } from "../lib/http";
import { catalogScore, catalogSearchKey } from "../lib/catalog";

test("поиск каталога нормализует название и приоритизирует начало", () => {
  assert.equal(catalogSearchKey("★ StatTrak™ AK-47 | Redline"), "ak-47 | redline");
  assert.ok(catalogScore("AK-47 | Redline", "AK-47", "ak-47") < catalogScore("M4A4 | The Emperor", "M4A4", "ak-47"));
  assert.ok(catalogScore("AK-47 | Redline", "AK-47", "ak red") < catalogScore("AK-47 | Predator", "AK-47", "ak red"));
});

test("trade URL принимается только для владельца SteamID", () => {
  const steamId = "76561198000000000";
  const partner = steamAccountId(steamId);
  const url = `https://steamcommunity.com/tradeoffer/new/?partner=${partner}&token=Abc_123-x`;
  assert.deepEqual(parseTradeUrl(url), { partner, token: "Abc_123-x" });
  assert.equal(tradeUrlMatches(url, steamId), true);
  assert.equal(tradeUrlMatches(url, "76561198000000001"), false);
  assert.equal(parseTradeUrl("https://example.com/trade"), null);
});

test("Steam OpenID return_to привязан к одноразовому state", () => {
  const login = new URL(openIdLoginUrl("test-state"));
  const returnTo = new URL(login.searchParams.get("openid.return_to")!);
  assert.equal(returnTo.pathname, "/api/auth/steam/callback");
  assert.equal(returnTo.searchParams.get("state"), "test-state");
});

test("неподтверждённые контакты не повышают доверие", () => {
  const unverified = trustFor({
    email: "user@example.com", emailVerifiedAt: null, tradeUrl: "steam", discord: "user", telegram: null, socialVerifiedAt: null,
  }, 0);
  assert.equal(unverified.level, 1);

  const verified = trustFor({
    email: "user@example.com", emailVerifiedAt: new Date(), tradeUrl: "steam", discord: "user", telegram: null, socialVerifiedAt: new Date(),
  }, 3);
  assert.equal(verified.level, 2);

  const veteran = trustFor({
    email: null, emailVerifiedAt: null, tradeUrl: "steam", discord: null, telegram: null, socialVerifiedAt: null,
  }, 10);
  assert.equal(veteran.level, 3);
});

test("ограниченное чтение отклоняет слишком большой ответ", async () => {
  const response = new Response(new Uint8Array(16), { headers: { "content-length": "16" } });
  await assert.rejects(() => readLimited(response, 8), (error) => error instanceof UpstreamError && error.code === "too_large");
});
