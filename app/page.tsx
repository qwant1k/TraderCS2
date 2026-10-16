import Link from "next/link";
import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import Avatar from "@/components/Avatar";
import { storedItems } from "@/lib/items";

export const dynamic = "force-dynamic";

const formatCount = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const user = await currentUser();
  const [users, active, done, activeItems, rows] = await Promise.all([
    db.user.count(),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.listing.count({ where: { status: "CLOSED" } }),
    db.listingItem.count({ where: { listing: { status: "ACTIVE" } } }),
    db.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: true, items: true, _count: { select: { offers: true } } },
    }),
  ]);
  const recent = rows.map((listing) => ({ ...listing, displayItems: storedItems(listing.items, listing.itemsJson) }));
  const showcase = recent.flatMap((listing) => listing.displayItems).slice(0, 4);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><i /> P2P-обмен скинами CS2</div>
          <h1>Твой инвентарь.<br /><span>Твои правила обмена.</span></h1>
          <p>
            Находи нужные скины, сравнивай предложения и меняйся напрямую через Steam.
            Без продажи предметов и скрытых комиссий.
          </p>
          {query.error === "auth" && <div className="msg err">Не удалось войти через Steam. Попробуйте ещё раз.</div>}
          <div className="home-actions">
            {user ? (
              <Link className="btn big" href="/inventory">Создать лот <span>→</span></Link>
            ) : (
              <a className="btn big" href="/api/auth/steam">Войти через Steam <span>→</span></a>
            )}
            <Link className="btn secondary big" href="/listings">Смотреть лоты</Link>
          </div>
          <form className="home-search" action="/listings">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input name="q" aria-label="Поиск по лотам" placeholder="Найти AK-47 | Redline, Doppler, нож…" />
            <button type="submit">Найти</button>
          </form>
          <div className="home-assurances">
            <span><i>✓</i> Авторизация Steam</span>
            <span><i>✓</i> Комиссия 0%</span>
            <span><i>✓</i> Цены для сравнения</span>
          </div>
        </div>

        <div className="home-showcase" aria-label="Предметы в активных лотах">
          <div className="home-showcase-head">
            <span><i /> Сейчас в обмене</span>
            <b>{formatCount(activeItems)} предметов</b>
          </div>
          <div className={`home-skin-stack ${showcase.length === 0 ? "empty" : ""}`}>
            {showcase.length > 0 ? showcase.map((item, index) => (
              <div className="home-skin" key={`${item.assetid}-${index}`} style={item.color ? ({ "--skin-color": item.color } as CSSProperties) : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.icon} alt={item.name} />
                <div><small>{item.type ?? "CS2"}</small><strong>{item.name}</strong></div>
              </div>
            )) : (
              <div className="home-showcase-empty">
                <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 39 28 22l8 8 7-7 10 10-15 16H18z" /><circle cx="22" cy="18" r="4" /></svg>
                <strong>Первый лот может быть вашим</strong>
                <span>Добавьте предметы из инвентаря Steam</span>
              </div>
            )}
          </div>
          <div className="home-showcase-foot">
            <span>LIVE</span>
            <p>Новые предложения появляются в реальном времени</p>
          </div>
        </div>
      </section>

      <section className="home-stats" aria-label="Статистика площадки">
        <div><svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8" /></svg><p><b>{formatCount(active)}</b><span>активных лотов</span></p></div>
        <div><svg viewBox="0 0 24 24"><path d="m7 7 3-3m-3 3 3 3M17 17l-3 3m3-3-3-3M8 7h8a3 3 0 0 1 3 3M16 17H8a3 3 0 0 1-3-3" /></svg><p><b>{formatCount(done)}</b><span>обменов завершено</span></p></div>
        <div><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M16 8a3 3 0 0 1 0 6M17 14c2.2.5 4 2.5 4 5" /></svg><p><b>{formatCount(users)}</b><span>игроков на площадке</span></p></div>
        <div><svg viewBox="0 0 24 24"><path d="M12 3v18M17 7.5c0-1.4-2.2-2.5-5-2.5S7 6.1 7 7.5s2.2 2.5 5 2.5 5 1.1 5 2.5-2.2 2.5-5 2.5-5-1.1-5-2.5" /></svg><p><b>0%</b><span>комиссия TradeGG</span></p></div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <div><span>Маркет обменов</span><h2>Свежие лоты игроков</h2><p>Предметы, которые прямо сейчас готовы к обмену.</p></div>
          <Link href="/listings">Все лоты <b>→</b></Link>
        </div>
        {recent.length > 0 ? (
          <div className="home-listings">
            {recent.map((listing) => (
              <Link className="home-listing" key={listing.id} href={`/listings/${listing.id}`}>
                <div className="home-listing-top">
                  <span><Avatar src={listing.user.avatar} name={listing.user.name} size={28} /><b>{listing.user.name}</b></span>
                  <em className={listing.type === "OPEN" ? "open" : "specific"}>{listing.type === "OPEN" ? "Любые предложения" : "Ищет конкретное"}</em>
                </div>
                <div className="home-listing-items">
                  {listing.displayItems.slice(0, 3).map((item) => (
                    <span key={item.assetid} style={item.color ? ({ "--skin-color": item.color } as CSSProperties) : undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.icon} alt={item.name} loading="lazy" />
                    </span>
                  ))}
                  {listing.displayItems.length > 3 && <i>+{listing.displayItems.length - 3}</i>}
                </div>
                <strong className="home-listing-name">
                  {listing.displayItems[0]?.name ?? "Набор предметов"}
                  {listing.displayItems.length > 1 && <small> и ещё {listing.displayItems.length - 1}</small>}
                </strong>
                <div className="home-listing-want">
                  <small>Хочет получить</small>
                  <span>{listing.type === "OPEN" ? "Рассмотрит ваши варианты" : listing.wanted || "Конкретное предложение"}</span>
                </div>
                <div className="home-listing-bottom"><span>{listing._count.offers} предложений</span><b>Открыть лот →</b></div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-empty-listings"><b>Активных лотов пока нет</b><span>Создайте первый и начните обмен.</span><Link className="btn" href={user ? "/inventory" : "/api/auth/steam"}>Создать лот</Link></div>
        )}
      </section>

      <section className="home-modes">
        <div className="home-section-head compact">
          <div><span>Гибкие условия</span><h2>Меняйтесь так, как удобно вам</h2></div>
        </div>
        <div className="home-mode-grid">
          <article className="home-mode featured">
            <div className="home-mode-icon">↔</div><span>Свободный обмен</span><h3>Открыт для предложений</h3>
            <p>Выставьте предмет и получайте любые варианты от других игроков. Решение всегда остаётся за вами.</p>
            <Link href={user ? "/inventory" : "/api/auth/steam"}>Выставить предмет →</Link>
          </article>
          <article className="home-mode">
            <div className="home-mode-icon">⌕</div><span>Точный поиск</span><h3>Хочу конкретное</h3>
            <p>Выберите нужный скин из полного каталога CS2, задайте износ, float, StatTrak™ и диапазон цены.</p>
            <Link href={user ? "/inventory" : "/api/auth/steam"}>Создать пожелание →</Link>
          </article>
          <article className="home-mode">
            <div className="home-mode-icon">◎</div><span>Умный подбор</span><h3>Взаимные совпадения</h3>
            <p>TradeGG сопоставляет ваши пожелания с активными лотами и показывает самые подходящие обмены.</p>
            <Link href={user ? "/matches" : "/api/auth/steam"}>Найти совпадения →</Link>
          </article>
        </div>
      </section>

      <section className="home-how">
        <div className="home-how-copy">
          <span>Четыре простых шага</span><h2>От инвентаря до обмена</h2>
          <p>TradeGG помогает найти вторую сторону и оценить предложение. Сам обмен подтверждается только вами в Steam.</p>
          <Link className="btn secondary" href="/listings">Посмотреть площадку</Link>
        </div>
        <ol>
          <li><i>01</i><div><b>Войдите через Steam</b><span>Без передачи пароля сайту</span></div></li>
          <li><i>02</i><div><b>Выберите предметы</b><span>Кликом или drag-and-drop из инвентаря</span></div></li>
          <li><i>03</i><div><b>Получите предложения</b><span>Сравните предметы, float и цены</span></div></li>
          <li><i>04</i><div><b>Подтвердите обмен</b><span>Финальное действие происходит в Steam</span></div></li>
        </ol>
      </section>

      <section className="home-safety">
        <div className="home-safety-mark"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z" /><path d="m9 12 2 2 4-5" /></svg></div>
        <div><span>Контроль остаётся у вас</span><h2>Предметы не покидают ваш инвентарь до подтверждения</h2><p>TradeGG не хранит скины и не просит ваш пароль. Проверяйте состав обмена в официальном окне Steam перед подтверждением.</p></div>
        <div className="home-safety-list"><span>✓ Прямой Steam Trade</span><span>✓ Публичная история лота</span><span>✓ Проверка владельца</span></div>
      </section>

      <section className="home-final">
        <div><span>ГОТОВЫ К ОБМЕНУ?</span><h2>Превратите лишние скины в те, которые действительно хотите.</h2></div>
        <div className="home-actions">
          <Link className="btn big" href={user ? "/inventory" : "/api/auth/steam"}>{user ? "Создать лот" : "Начать через Steam"} <span>→</span></Link>
          <Link className="btn secondary big" href="/listings">Открыть маркет</Link>
        </div>
      </section>
    </div>
  );
}
