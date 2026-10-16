import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { currentUser } from "@/lib/session";
import Avatar from "@/components/Avatar";
import HeaderNav from "@/components/HeaderNav";
import { db } from "@/lib/db";
import { trustFor, userStats } from "@/lib/trust";

const manrope = Manrope({ subsets: ["cyrillic", "latin"], variable: "--font-manrope", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["cyrillic", "latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "TradeGG — обмен скинов",
  description: "Обмен предметов Steam между игроками без купли-продажи",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [trust, incomingCount] = user
    ? await Promise.all([
        userStats(user.id).then((stats) => trustFor(user, stats.completed)),
        db.offer.count({ where: { status: "PENDING", listing: { userId: user.id } } }),
      ])
    : [null, 0];
  return (
    <html lang="ru" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="logo">
              <i />
              <span>Trade<b>GG</b></span>
            </Link>
            <HeaderNav authenticated={!!user} incomingCount={incomingCount} />
            {user ? (
              <div className="user">
                <Link href={`/u/${user.steamId}`} className="header-profile">
                  <span className="header-profile-copy"><strong>{user.name}</strong><small>Уровень доверия {trust?.level ?? 0}</small></span>
                  <Avatar src={user.avatar} name={user.name} size={30} />
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button className="header-logout" type="submit">Выйти</button>
                </form>
              </div>
            ) : (
              <a className="btn" href="/api/auth/steam">Войти через Steam</a>
            )}
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
