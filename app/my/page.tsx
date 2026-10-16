import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import ItemGrid from "@/components/ItemGrid";
import OfferActions from "@/components/OfferActions";
import TradePanel from "@/components/TradePanel";
import type { Item } from "@/lib/steam";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  ACTIVE: "Активен", RESERVED: "Обмен согласован", CLOSED: "Завершён", CANCELLED: "Отменён",
  PENDING: "Ожидает", ACCEPTED: "Принято", COMPLETED: "Завершено", DECLINED: "Отклонено", INVALID: "Недействительно",
};

export default async function MyPage() {
  const user = await currentUser();
  if (!user) redirect("/api/auth/steam");

  const [listings, offers] = await Promise.all([
    db.listing.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true, _count: { select: { offers: true } } } }),
    db.offer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: true, listing: { include: { user: true, items: true } } },
    }),
  ]);

  return (
    <div>
      <h1>Мои обмены</h1>
      {!user.tradeUrl && (
        <div className="msg err">Без трейд-ссылки обмен не откроется. <Link href="/settings?setup=1">Добавить в настройках</Link></div>
      )}

      <h2>Мои лоты</h2>
      {listings.length === 0 && <div className="muted">Лотов нет. <Link href="/inventory">Выставить предметы</Link></div>}
      {listings.map((l) => (
        <div className="card" key={l.id}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className={`tag ${l.status}`}>{STATUS[l.status]}</span>
            <span className="muted">Предложений: {l._count.offers}</span>
            <Link href={`/listings/${l.id}`}>Открыть</Link>
          </div>
          <ItemGrid items={storedItems(l.items, l.itemsJson)} />
        </div>
      ))}

      <h2>Мои предложения</h2>
      {offers.length === 0 && <div className="muted">Вы ещё ничего не предлагали.</div>}
      {offers.map((o) => {
        const offered = storedItems(o.items, o.itemsJson);
        const requested = storedItems(o.listing.items, o.listing.itemsJson);
        return <div className="card" key={o.id}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span>Лот <Link href={`/listings/${o.listingId}`}>{o.listing.user.name}</Link></span>
            <span className={`tag ${o.status}`}>{STATUS[o.status]}</span>
          </div>
          <ItemGrid items={offered} />
          {o.status === "PENDING" && (
            <div style={{ marginTop: 10 }}>
              <OfferActions offerId={o.id} actions={[{ action: "cancel", label: "Отозвать", style: "secondary" }]} />
            </div>
          )}
          {o.status === "ACCEPTED" && (
            <>
              {o.listing.user.tradeUrl && <TradePanel partnerTradeUrl={o.listing.user.tradeUrl} give={offered} receive={requested} />}
              <div className="msg ok">
                {o.authorConfirmedAt ? "Вы подтвердили обмен. Ожидается подтверждение владельца лота." : "Подтвердите завершение только после фактического обмена в Steam."}
              </div>
              {!o.authorConfirmedAt && <OfferActions offerId={o.id} actions={[{ action: "done", label: "Я завершил обмен в Steam", style: "ok" }]} />}
            </>
          )}
        </div>
      })}
    </div>
  );
}
