import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appBase } from "@/lib/steam";
import { readEmailVerificationToken } from "@/lib/emailVerification";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const payload = await readEmailVerificationToken(token);
  if (payload === "expired") return NextResponse.redirect(`${appBase()}/settings?email=expired`);
  if (!payload) return NextResponse.redirect(`${appBase()}/settings?email=invalid`);

  const changed = await db.user.updateMany({
    where: { id: payload.userId, email: payload.email },
    data: { emailVerifiedAt: new Date() },
  });
  return NextResponse.redirect(`${appBase()}/settings?email=${changed.count === 1 ? "verified" : "changed"}`);
}

