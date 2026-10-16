import { db } from "./db";

export type Stats = {
  completed: number; // завершённые обмены (оба участника)
  activeListings: number;
  offersSent: number;
};

export type TrustStep = { key: string; label: string; done: boolean };

export type Trust = {
  level: 0 | 1 | 2 | 3;
  title: string;
  steps: TrustStep[];
  progress: number; // 0..1
  limits: { listings: number; offersPerDay: number };
};

// Завершённый обмен: лот закрыт владельцем с принятым предложением.
export async function userStats(userId: string): Promise<Stats> {
  const [asOwner, asAuthor, activeListings, offersSent] = await Promise.all([
    db.offer.count({ where: { status: "COMPLETED", listing: { userId } } }),
    db.offer.count({ where: { userId, status: "COMPLETED" } }),
    db.listing.count({ where: { userId, status: { in: ["ACTIVE", "RESERVED"] } } }),
    db.offer.count({ where: { userId } }),
  ]);
  return { completed: asOwner + asAuthor, activeListings, offersSent };
}

export function trustFor(
  u: {
    email: string | null;
    emailVerifiedAt: Date | null;
    tradeUrl: string | null;
    discord: string | null;
    telegram: string | null;
    socialVerifiedAt: Date | null;
  },
  completed: number,
): Trust {
  const hasSocial = !!(u.discord || u.telegram);
  const verifiedEmail = !!(u.email && u.emailVerifiedAt);
  const steps: TrustStep[] = [
    { key: "steam", label: "Вход через Steam", done: true },
    { key: "email", label: "Почта подтверждена", done: verifiedEmail },
    { key: "trade", label: "Трейд-ссылка добавлена", done: !!u.tradeUrl },
    { key: "social", label: "Discord или Telegram добавлен", done: hasSocial },
    { key: "trades", label: "3 завершённых обмена", done: completed >= 3 },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  let level: 0 | 1 | 2 | 3 = 0;
  if (u.tradeUrl) level = 1;
  if (level >= 1 && completed >= 3) level = 2;
  if (level >= 2 && completed >= 10) level = 3;

  const titles = ["Новичок", "Участник", "Проверенный", "Надёжный трейдер"];
  const limits = [
    { listings: 2, offersPerDay: 5 },
    { listings: 5, offersPerDay: 20 },
    { listings: 10, offersPerDay: 40 },
    { listings: 20, offersPerDay: 80 },
  ][level];

  return { level, title: titles[level], steps, progress: doneCount / steps.length, limits };
}
