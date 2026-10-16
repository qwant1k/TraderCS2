"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderNav({ authenticated, incomingCount }: { authenticated: boolean; incomingCount: number }) {
  const pathname = usePathname();
  const links = authenticated
    ? [
        { href: "/", label: "Главная", active: pathname === "/" },
        { href: "/listings", label: "Все лоты", active: pathname.startsWith("/listings") },
        { href: "/matches", label: "Подбор пар", active: pathname.startsWith("/matches") },
        { href: "/my#listings", label: "Мои лоты", active: pathname === "/my" },
        { href: "/my#offers", label: "Предложения", active: pathname === "/my", badge: incomingCount },
      ]
    : [
        { href: "/", label: "Главная", active: pathname === "/" },
        { href: "/listings", label: "Все лоты", active: pathname.startsWith("/listings") },
      ];

  return (
    <nav aria-label="Основная навигация">
      {links.map((link) => (
        <Link href={link.href} key={link.href} data-active={link.active || undefined}>
          {link.label}
          {!!link.badge && <span className="nav-badge" aria-label={`${link.badge} входящих предложений`}>{link.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
