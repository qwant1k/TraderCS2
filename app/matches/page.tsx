import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { findMatches, type MatchRow } from "@/lib/match";
import ItemGrid from "@/components/ItemGrid";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

function Row({ r }: { r: MatchRow }) {
  const firstGive = r.canGive[0];
  const pick = firstGive ? firstGive.mine.slice(0, 1).map((i) => i.assetid) : [];
  const href = `/listings/${r.listing.id}${pick.length ? `?pick=${pick.join(",")}&v=${firstGive.want.id}` : ""}`;
  return (
    <div className="card match-card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <Avatar src={r.listing.user.avatar} name={r.listing.user.name} size={26} />
          <Link href={`/u/${r.listing.user.steamId}`}><strong>{r.listing.user.name}</strong></Link>
          {r.mutual && <span className="tag open">Взаимная пара</span>}
          <span className={`tag ${r.listing.type === "OPEN" ? "open" : "want"}`}>{r.listing.type === "OPEN" ? "Открыт для предложений" : "Хочет конкретное"}</span>
        </div>
        <Link className="btn" href={href}>Предложить обмен</Link>
      </div>
      <div className="cols">
        <div>
          {r.theyHave.length > 0 && (
            <>
              <h4>Подходит под ваши пожелания</h4>
              <ItemGrid items={r.items.filter((i) => r.theyHave.includes(i.assetid))} />
            </>
          )}
          <h4>Отдаёт</h4>
          <ItemGrid items={r.items} />
        </div>
        <div>
          {r.canGive.length > 0 ? (
            r.canGive.map((g) => (
              <div key={g.want.id} style={{ marginBottom: 10 }}>
                <h4>Хочет «{g.want.label}» — у вас есть:</h4>
                <ItemGrid items={g.mine.slice(0, 6)} />
              </div>
            ))
          ) : (
            <>
              <h4>Что вы можете предложить</h4>
              <div className="muted" style={{ fontSize: 13 }}>
                {r.listing.type === "OPEN" ? "Лот открыт для любых предложений." : "Под его пожелания в вашем инвентаре ничего не нашлось."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function MatchesPage() {
  const user = await currentUser();
  if (!user) redirect("/api/auth/steam");
  const { rows, hasInventory, wantsCount } = await findMatches(user);
  const mutual = rows.filter((r) => r.mutual);
  const give = rows.filter((r) => !r.mutual && r.canGive.length > 0);
  const have = rows.filter((r) => !r.mutual && r.canGive.length === 0);

  return (
    <div>
      <h1 style={{ marginTop: 24 }}>Подбор пар</h1>
      <p className="muted" style={{ maxWidth: 760 }}>
        Сравниваем ваш инвентарь с пожеланиями других игроков, а их лоты — с вашими пожеланиями. Свободный текст в подборе не участвует:
        указывайте пожелания через «Предмет», «Категория» или «Любой по цене».
      </p>
      {!hasInventory && <div className="msg">Откройте <Link href="/inventory">инвентарь</Link>, чтобы мы загрузили ваши предметы.</div>}
      {wantsCount === 0 && (
        <div className="msg">У вас нет пожеланий для подбора. Добавьте их в своём лоте при <Link href="/inventory">выставлении</Link>, и здесь появятся лоты с тем, что вы ищете.</div>
      )}

      {rows.length === 0 && <div className="muted" style={{ marginTop: 16 }}>Пока совпадений нет. Загляните позже: новые лоты появляются постоянно.</div>}

      {mutual.length > 0 && (<><h2>Взаимные пары ({mutual.length})</h2>{mutual.map((r) => <Row key={r.listing.id} r={r} />)}</>)}
      {give.length > 0 && (<><h2>Вы можете предложить ({give.length})</h2>{give.map((r) => <Row key={r.listing.id} r={r} />)}</>)}
      {have.length > 0 && (<><h2>Есть то, что вы ищете ({have.length})</h2>{have.map((r) => <Row key={r.listing.id} r={r} />)}</>)}
    </div>
  );
}
