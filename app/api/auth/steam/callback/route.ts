import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { appBase, fetchProfile, verifyOpenId } from "@/lib/steam";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const expectedState = req.cookies.get("tg_auth_state")?.value ?? "";
  const steamId = state && state === expectedState ? await verifyOpenId(req.nextUrl.searchParams, state) : null;
  if (!steamId) {
    const response = NextResponse.redirect(`${appBase()}/?error=auth`);
    response.cookies.set("tg_auth_state", "", { path: "/api/auth/steam/callback", maxAge: 0 });
    return response;
  }

  const profile = await fetchProfile(steamId);
  const user = await db.user.upsert({
    where: { steamId },
    create: { steamId, name: profile.name, avatar: profile.avatar },
    update: { name: profile.name, avatar: profile.avatar },
  });
  await createSession(user.id);

  // Без трейд-ссылки обмен невозможен, ведём в профиль
  const next = user.tradeUrl ? "/inventory" : "/settings?setup=1";
  const response = NextResponse.redirect(`${appBase()}${next}`);
  response.cookies.set("tg_auth_state", "", { path: "/api/auth/steam/callback", maxAge: 0 });
  return response;
}
