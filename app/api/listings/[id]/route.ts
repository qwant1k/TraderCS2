import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Отмена лота владельцем: все ожидающие предложения тоже отменяются
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing || listing.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (listing.status !== "ACTIVE") return NextResponse.json({ error: "closed" }, { status: 409 });

  const cancelled = await db.$transaction(async (tx) => {
    const changed = await tx.listing.updateMany({ where: { id: listing.id, userId: user.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) return false;
    await tx.offer.updateMany({ where: { listingId: listing.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.activeListingItem.deleteMany({ where: { listingId: listing.id } });
    return true;
  });
  if (!cancelled) return NextResponse.json({ error: "closed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
