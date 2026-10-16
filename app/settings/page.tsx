import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { trustFor, userStats } from "@/lib/trust";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ setup?: string; email?: string }> }) {
  const query = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/api/auth/steam");

  const stats = await userStats(user.id);
  const trust = trustFor(user, stats.completed);

  return (
    <div>
      <h1>Настройки профиля</h1>
      {query.setup && !user.tradeUrl && (
        <div className="msg">Чтобы обмениваться, добавьте трейд-ссылку Steam и подтвердите почту.</div>
      )}
      {query.email === "verified" && <div className="msg ok">Почта успешно подтверждена.</div>}
      {query.email === "expired" && <div className="msg err">Ссылка подтверждения истекла. Отправьте новое письмо.</div>}
      {(query.email === "invalid" || query.email === "changed") && <div className="msg err">Ссылка недействительна или адрес уже был изменён.</div>}

      <div className="two" style={{ alignItems: "start" }}>
        <ProfileForm
          initial={{
            tradeUrl: user.tradeUrl ?? "",
            email: user.email ?? "",
            emailVerified: !!user.emailVerifiedAt,
            bio: user.bio ?? "",
            discord: user.discord ?? "",
            telegram: user.telegram ?? "",
          }}
        />

        <div className="card">
          <div className="row between">
            <strong>Уровень доверия</strong>
            <span className={`level l${trust.level}`}>{trust.level} · {trust.title}</span>
          </div>
          <div className="meter" style={{ margin: "12px 0" }}><i style={{ width: `${Math.round(trust.progress * 100)}%` }} /></div>
          <ul className="checklist">
            {trust.steps.map((s) => (
              <li key={s.key} className={s.done ? "done" : ""}>
                <span className="dot">{s.done ? "✓" : ""}</span>
                {s.label}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            Сейчас вам доступно: до {trust.limits.listings} активных лотов и {trust.limits.offersPerDay} предложений в сутки.
            Адрес вашего публичного профиля: <Link href={`/u/${user.steamId}`}>открыть</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
