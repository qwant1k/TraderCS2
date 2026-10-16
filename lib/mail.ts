import { fetchWithTimeout } from "./http";

export class MailConfigError extends Error {}

export async function sendVerificationEmail(email: string, verificationUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new MailConfigError("Отправка почты ещё не настроена администратором");

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Подтвердите почту в TradeGG",
      text: `Подтвердите адрес электронной почты для TradeGG: ${verificationUrl}\n\nСсылка действует 30 минут. Если вы не запрашивали письмо, просто проигнорируйте его.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;background:#17191e;color:#f1f1f2;border-radius:12px"><h1 style="font-size:24px;margin:0 0 14px">Подтвердите почту</h1><p style="color:#a4a7af;line-height:1.6">Нажмите кнопку, чтобы подтвердить адрес для профиля TradeGG.</p><p style="margin:26px 0"><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#ff8a1f;color:#21160c;text-decoration:none;font-weight:700">Подтвердить почту</a></p><p style="color:#777b85;font-size:12px">Ссылка действует 30 минут. Если вы не запрашивали это письмо, его можно проигнорировать.</p></div>`,
    }),
  }, 10_000);

  if (!response.ok) throw new Error("Почтовый сервис не принял сообщение");
}

