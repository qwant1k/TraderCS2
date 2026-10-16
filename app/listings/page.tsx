import Link from "next/link";
import { db } from "@/lib/db";
import ItemGrid from "@/components/ItemGrid";
import Avatar from "@/components/Avatar";
import type { Item } from "@/lib/steam";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = await searchParams;
  const q = (query.q || "").trim().toLowerCase();
  const rows = await db.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, items: true, _count: { select: { offers: true } } },
  });
  const listings = rows.filter((l) => {
    if (!q) return true;
    const items = storedItems(l.items, l.itemsJson);
    return items.some((i) => i.name.toLowerCase().includes(q)) || (l.wanted || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <h1>Лоты</h1>
      <form className="row" style={{ marginBottom: 14 }}>
        <input name="q" defaultValue={query.q} placeholder="Поиск по предметам" style={{ maxWidth: 320 }} />
        <button className="btn secondary" type="submit">Найти</button>
      </form>
      {listings.length === 0 && <div className="muted">Лотов пока нет.</div>}
      {listings.map((l) => {
        const items = storedItems(l.items, l.itemsJson);
        return (
          <div className="card" key={l.id}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="row">
                <Avatar src={l.user.avatar} name={l.user.name} size={26} />
                <Link href={`/u/${l.user.steamId}`}><strong>{l.user.name}</strong></Link>
                <span className={`tag ${l.type === "OPEN" ? "open" : "want"}`}>{l.type === "OPEN" ? "Открыт для предложений" : "Хочет конкретное"}</span>
                <span className="muted">Предложений: {l._count.offers}</span>
              </div>
              <Link className="btn" href={`/listings/${l.id}`}>Открыть</Link>
            </div>
            {l.wanted && <p><span className="muted">Хочет:</span> {l.wanted}</p>}
            <ItemGrid items={items} />
          </div>
        );
      })}
    </div>
  );
}
