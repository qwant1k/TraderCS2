import { NextResponse } from "next/server";
import { buildFeed } from "@/lib/feed";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await buildFeed(user));
  } catch {
    return NextResponse.json(
      { error: "unavailable", message: "Не удалось загрузить новые обмены" },
      { status: 500 },
    );
  }
}
