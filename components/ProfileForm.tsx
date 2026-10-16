"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  tradeUrl: string;
  email: string;
  emailVerified: boolean;
  bio: string;
  discord: string;
  telegram: string;
};

export default function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);
  const set = (key: keyof Omit<Initial, "emailVerified">) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((current) => ({ ...current, [key]: event.target.value }));
    if (key === "email") setMailMsg(null);
  };
  const emailVerified = initial.emailVerified && f.email.trim().toLowerCase() === initial.email.trim().toLowerCase();

  async function save() {
    setBusy(true);
    setMsg(null);
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const json = await response.json();
    setBusy(false);
    setMsg(response.ok ? { ok: true, text: "Изменения сохранены" } : { ok: false, text: json.message || "Не удалось сохранить профиль" });
    if (response.ok) router.refresh();
  }

  async function verifyEmail() {
    setMailBusy(true);
    setMailMsg(null);
    const response = await fetch("/api/profile/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.email }),
    });
    const json = await response.json();
    setMailBusy(false);
    setMailMsg({ ok: response.ok, text: json.message || (response.ok ? "Письмо отправлено" : "Не удалось отправить письмо") });
    if (response.ok) router.refresh();
  }

  return (
    <div className="profile-settings">
      <section className="settings-section trade-settings">
        <div className="settings-section-head">
          <div className="settings-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 3-3m-3 3 3 3M17 17l-3 3m3-3-3-3M8 7h8a3 3 0 0 1 3 3M16 17H8a3 3 0 0 1-3-3" /></svg>
          </div>
          <div><h2>Обмен Steam</h2><p>Ссылка нужна, чтобы другой игрок мог открыть предложение обмена.</p></div>
          <a className="settings-help" href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" target="_blank" rel="noopener noreferrer">
            Где взять <span>↗</span>
          </a>
        </div>
        <label htmlFor="trade-url">Трейд-ссылка Steam</label>
        <div className="settings-input-with-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></svg>
          <input id="trade-url" value={f.tradeUrl} onChange={set("tradeUrl")} placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…" />
        </div>
        <p className="settings-note">Ссылка проверяется: она должна принадлежать вашему Steam-аккаунту.</p>
      </section>

      <section className="settings-section email-settings">
        <div className="settings-section-head">
          <div className="settings-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" /></svg>
          </div>
          <div><h2>Электронная почта</h2><p>Для уведомлений и повышения доверия к профилю.</p></div>
          <span className={`settings-status ${emailVerified ? "verified" : "pending"}`}>
            {emailVerified ? "✓ Подтверждена" : "Не подтверждена"}
          </span>
        </div>
        <div className="email-control">
          <input value={f.email} onChange={set("email")} type="email" autoComplete="email" placeholder="name@example.com" />
          <button className="btn secondary" type="button" onClick={verifyEmail} disabled={mailBusy || !f.email.trim() || emailVerified}>
            {mailBusy ? "Отправляю…" : emailVerified ? "Подтверждено" : "Подтвердить почту"}
          </button>
        </div>
        <p className="settings-note">Мы отправим письмо со ссылкой. Ссылка работает 30 минут.</p>
        {mailMsg && <div className={`msg ${mailMsg.ok ? "ok" : "err"}`}>{mailMsg.text}</div>}
      </section>

      <section className="settings-section contacts-settings">
        <div className="settings-section-head">
          <div className="settings-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H9l-4 3z" /></svg>
          </div>
          <div><h2>Контакты</h2><p>Необязательные способы связи. Никакого дополнительного подтверждения.</p></div>
        </div>
        <div className="settings-contact-grid">
          <div><label htmlFor="discord">Discord</label><div className="settings-prefix"><span>#</span><input id="discord" value={f.discord} onChange={set("discord")} placeholder="username" maxLength={64} /></div></div>
          <div><label htmlFor="telegram">Telegram</label><div className="settings-prefix"><span>@</span><input id="telegram" value={f.telegram} onChange={set("telegram")} placeholder="username" maxLength={64} /></div></div>
        </div>
      </section>

      <section className="settings-section bio-settings">
        <div className="settings-section-head compact"><div><h2>О себе</h2><p>Коротко расскажите, что коллекционируете и когда доступны для обмена.</p></div><span>{f.bio.length}/300</span></div>
        <textarea rows={4} value={f.bio} onChange={set("bio")} maxLength={300} placeholder="Например: собираю скины на AK-47, обычно онлайн после 19:00…" />
      </section>

      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <div className="settings-save"><button className="btn big" type="button" onClick={save} disabled={busy}>{busy ? "Сохраняю…" : "Сохранить изменения"}</button></div>
    </div>
  );
}
