import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tradeUrlMatches } from "@/lib/steam";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: {
    tradeUrl?: string;
    email?: string | null;
    emailVerifiedAt?: Date | null;
    bio?: string | null;
    discord?: string | null;
    telegram?: string | null;
  } = {};

  if (typeof body.tradeUrl === "string") {
    const url = body.tradeUrl.trim();
    if (!tradeUrlMatches(url, user.steamId)) {
      return NextResponse.json(
        { error: "bad_trade_url", message: "Это не ваша трейд-ссылка. Скопируйте её из Steam: Инвентарь → Предложения обмена → Кто может отправлять мне предложения." },
        { status: 400 },
      );
    }
    data.tradeUrl = url;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "bad_email", message: "Некорректная почта" }, { status: 400 });
    }
    if (email !== (user.email ?? "")) data.emailVerifiedAt = null;
    data.email = email || null;
  }

  if (typeof body.bio === "string") data.bio = body.bio.trim().slice(0, 300) || null;
  if (typeof body.discord === "string") {
    const d = body.discord.trim().replace(/^@/, "").slice(0, 64);
    data.discord = d || null;
  }
  if (typeof body.telegram === "string") {
    const t = body.telegram.trim().replace(/^@/, "").slice(0, 64);
    data.telegram = t || null;
  }

  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
