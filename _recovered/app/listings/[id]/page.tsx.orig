import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import ItemGrid from "@/components/ItemGrid";
import MakeOffer from "@/components/MakeOffer";
import OfferActions from "@/components/OfferActions";
import TradePanel from "@/components/TradePanel";
import Avatar from "@/components/Avatar";
import type { Item } from "@/lib/steam";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, listing] = await Promise.all([
    currentUser(),
    db.listing.findUnique({
      where: { id },
      include: { items: true, user: true, offers: { include: { items: true, user: true }, orderBy: { createdAt: "desc" } } },
    }),
  ]);
  if (!listing) notFound();

  const items = storedItems(listing.items, listing.itemsJson);
  const variants = JSON.parse(listing.variantsJson || "[]") as { id: string; text: string }[];
  const variantText = new Map(variants.map((v, i) => [v.id, `${i + 1}. ${v.text}`]));
  const isOwner = user?.id === listing.userId;
  const myPending = user ? listing.offers.some((o) => o.userId === user.id && o.status === "PENDING") : false;

  return (
    <div>
      <div className="row" style={{ marginTop: 28 }}>
        <Avatar src={listing.user.avatar} name={listing.user.name} size={44} />
        <div>
          <div className="muted">Лот от</div>
          <Link href={`/u/${listing.user.steamId}`}><strong style={{ fontSize: 20 }}>{listing.user.name}</strong></Link>
        </div>
      </div>
      <div className="row" style={{ margin: "14px 0" }}>
        <span className={`tag ${listing.status}`}>{listing.status === "ACTIVE" ? "Активен" : listing.status === "RESERVED" ? "Обмен согласован" : listing.status === "CLOSED" ? "Завершён" : "Отменён"}</span>
        <span className={`tag ${listing.type === "OPEN" ? "open" : "want"}`}>{listing.type === "OPEN" ? "Открыт для предложений" : "Хочет конкретное"}</span>
      </div>
      {variants.length > 0 && (
        <div className="card">
          <div className="muted" style={{ marginBottom: 6 }}>
            {variants.length > 1 ? "Подойдёт любой из вариантов:" : "Хочет получить:"}
          </div>
          <ol className="variants">
            {variants.map((v) => <li key={v.id}>{v.text}</li>)}
          </ol>
        </div>
      )}
      {listing.note && <p className="muted">{listing.note}</p>}
      <ItemGrid items={items} />

      {isOwner && (
        <>
          <h2>Предложения ({listing.offers.length})</h2>
          {listing.offers.length === 0 && <div className="muted">Пока никто ничего не предложил.</div>}
          {listing.offers.map((o) => {
            const theirs = storedItems(o.items, o.itemsJson);
            return (
              <div key={o.id}>
                <div className="card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <Link href={`/u/${o.user.steamId}`}><strong>{o.user.name}</strong></Link>
                    <span className={`tag ${o.status}`}>{o.status}</span>
                  </div>
                  {o.variantId && variantText.get(o.variantId) && (
                    <p><span className="tag want">На вариант</span> {variantText.get(o.variantId)}</p>
                  )}
                  {o.message && <p className="muted">{o.message}</p>}
                  <ItemGrid items={theirs} />
                  {o.status === "PENDING" && listing.status === "ACTIVE" && (
                    <div style={{ marginTop: 10 }}>
                      <OfferActions
                        offerId={o.id}
                        actions={[
                          { action: "accept", label: "Принять", style: "ok" },
                          { action: "decline", label: "Отклонить", style: "secondary" },
                        ]}
                      />
                    </div>
                  )}
                  {o.status === "ACCEPTED" && listing.status === "RESERVED" && (
                    <div style={{ marginTop: 10 }}>
                      {o.ownerConfirmedAt
                        ? <div className="msg ok">Вы подтвердили обмен. Ожидается подтверждение второй стороны.</div>
                        : <OfferActions offerId={o.id} actions={[{ action: "done", label: "Я завершил обмен в Steam", style: "ok" }]} />}
                    </div>
                  )}
                </div>
                {o.status === "ACCEPTED" && o.user.tradeUrl && (
                  <TradePanel partnerTradeUrl={o.user.tradeUrl} give={items} receive={theirs} />
                )}
              </div>
            );
          })}
          {listing.status === "ACTIVE" && <CancelListing id={listing.id} />}
        </>
      )}

      {!isOwner && listing.status === "ACTIVE" && (
        user ? (
          user.tradeUrl ? (
            myPending ? <div className="msg">Ваше предложение отправлено. Статус в разделе <Link href="/my">«Мои обмены»</Link>.</div> : <MakeOffer listingId={listing.id} variants={variants} />
          ) : (
            <div className="msg err">Добавьте трейд-ссылку в <Link href="/settings?setup=1">настройках</Link>, чтобы отправлять предложения.</div>
          )
        ) : (
          <p><a className="btn" href="/api/auth/steam">Войти через Steam, чтобы предложить обмен</a></p>
        )
      )}
    </div>
  );
}

function CancelListing({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const user = await currentUser();
        const l = await db.listing.findUnique({ where: { id } });
        if (!user || !l || l.userId !== user.id || l.status !== "ACTIVE") return;
        await db.$transaction(async (tx) => {
          const changed = await tx.listing.updateMany({ where: { id, userId: user.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
          if (changed.count !== 1) return;
          await tx.offer.updateMany({ where: { listingId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
          await tx.activeListingItem.deleteMany({ where: { listingId: id } });
        });
        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/listings/${id}`);
      }}
      style={{ marginTop: 16 }}
    >
      <button className="btn bad" type="submit">Снять лот с публикации</button>
    </form>
  );
}
