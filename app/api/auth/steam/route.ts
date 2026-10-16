import { NextResponse } from "next/server";
import { openIdLoginUrl } from "@/lib/steam";

export const dynamic = "force-dynamic";

export function GET() {
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(openIdLoginUrl(state));
  response.cookies.set("tg_auth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/steam/callback",
    maxAge: 10 * 60,
  });
  return response;
}
