import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { takeRateLimit } from "@/lib/rate";
import { appBase } from "@/lib/steam";
import { createEmailVerificationToken } from "@/lib/emailVerification";
import { MailConfigError, sendVerificationEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rate = takeRateLimit(`email-verification:${user.id}`, 3, 15 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Слишком много писем. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "bad_email", message: "Введите корректный адрес почты" }, { status: 400 });
  }
  if (email === user.email && user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, verified: true, message: "Этот адрес уже подтверждён" });
  }

  await db.user.update({
    where: { id: user.id },
    data: { email, ...(email !== user.email ? { emailVerifiedAt: null } : {}) },
  });

  const token = await createEmailVerificationToken(user.id, email);
  const verificationUrl = `${appBase()}/api/profile/email/verify?token=${encodeURIComponent(token)}`;
  try {
    await sendVerificationEmail(email, verificationUrl);
  } catch (error) {
    const message = error instanceof MailConfigError ? error.message : "Не удалось отправить письмо. Попробуйте позже.";
    return NextResponse.json({ error: "mail_unavailable", message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: `Письмо отправлено на ${email}. Ссылка действует 30 минут.` });
}

