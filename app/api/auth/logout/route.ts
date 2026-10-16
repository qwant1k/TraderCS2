import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { appBase } from "@/lib/steam";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(`${appBase()}/`, { status: 303 });
}
