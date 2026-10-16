import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { trustFor, userStats } from "@/lib/trust";
import Avatar from "@/components/Avatar";
import ItemGrid from "@/components/ItemGrid";
import type { Item } from "@/lib/steam";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

export default async function PublicProfile({ params }: { params: Promise<{ steamId: string }> }) {
  const { steamId } = await params;
  if (!/^\d{17}$/.test(steamId)) notFound();
  const [viewer, user] = await Promise.all([currentUser(), db.user.findUnique({ where: { steamId } })]);
  if (!user) notFound();

  const [stats, listings] = await Promise.all([
    userStats(user.id),
    db.listing.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { items: true, _count: { select: { offers: true } } },
    }),
  ]);
  const trust = trustFor(user, stats.completed);
  const isMe = viewer?.id === user.id;

  return (
    <div>
      <div className="card profile-head" style={{ marginTop: 28 }}>
        <div className="profile-banner" />
        <div className="profile-body">
          <Avatar src={user.avatar} name={user.name} size={96} />
          <div className="profile-info">
            <h1>{user.name}</h1>
            <div className="row" style={{ marginTop: 8 }}>
              <span className={`level l${trust.level}`}>Уровень {trust.level} · {trust.title}</span>
              <span className="muted">На сайте с {fmt.format(user.createdAt)}</span>
            </div>
            {user.bio && <p style={{ margin: "10px 0 0" }}>{user.bio}</p>}
            <div className="socials" style={{ marginTop: 10 }}>
              <a className="social" href={`https://steamcommunity.com/profiles/${user.steamId}`} target="_blank" rel="noopener noreferrer">Steam</a>
              {user.discord && <span className="social">Discord: {user.discord}</span>}
              {user.telegram && (
                <a className="social" href={`https://t.me/${user.telegram}`} target="_blank" rel="noopener noreferrer">Telegram: @{user.telegram}</a>
              )}
            </div>
          </div>
          {isMe && <Link className="btn secondary" href="/settings">Редактировать</Link>}
        </div>
      </div>

      <section className="stats" style={{ marginTop: 0 }}>
        <div className="stat"><b>{stats.completed}</b><span className="muted">завершённых обменов</span></div>
        <div className="stat"><b>{stats.activeListings}</b><span className="muted">активных лотов</span></div>
        <div className="stat"><b>{stats.offersSent}</b><span className="muted">предложений отправлено</span></div>
      </section>

      <h2>Активные лоты</h2>
      {listings.length === 0 && <div className="muted">Сейчас нет активных лотов.</div>}
      {listings.map((l) => (
        <Link className="card hover" key={l.id} href={`/listings/${l.id}`}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className={`tag ${l.type === "OPEN" ? "open" : "want"}`}>{l.type === "OPEN" ? "Открыт для предложений" : "Хочет конкретное"}</span>
            <span className="muted">Предложений: {l._count.offers}</span>
          </div>
          {l.wanted && <p style={{ margin: "0 0 10px" }}><span className="muted">Хочет:</span> {l.wanted}</p>}
          <ItemGrid links={false} items={storedItems(l.items, l.itemsJson)} />
        </Link>
      ))}
    </div>
  );
}
