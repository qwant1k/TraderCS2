import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout, readLimited, UpstreamError } from "@/lib/http";
import { requestClientKey, takeRateLimit } from "@/lib/rate";

export const dynamic = "force-dynamic";

// Прокси картинок Steam для WebGL-текстур (у CDN Steam нет CORS). Только хосты Steam.
const ALLOWED = /^(community\.(cloudflare|akamai|fastly)\.steamstatic\.com|steamcommunity-a\.akamaihd\.net|cdn\.(cloudflare|akamai)\.steamstatic\.com)$/;

export async function GET(req: NextRequest) {
  const rate = takeRateLimit(`image:${requestClientKey(req.headers)}`, 120, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const u = req.nextUrl.searchParams.get("u") ?? "";
  let url: URL;
  try { url = new URL(u); } catch { return NextResponse.json({ error: "bad url" }, { status: 400 }); }
  if (url.protocol !== "https:" || !ALLOWED.test(url.hostname)) return NextResponse.json({ error: "host" }, { status: 400 });
  try {
    const r = await fetchWithTimeout(url, { cache: "no-store" }, 8_000);
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const finalUrl = new URL(r.url);
    if (finalUrl.protocol !== "https:" || !ALLOWED.test(finalUrl.hostname)) {
      r.body?.cancel().catch(() => undefined);
      return NextResponse.json({ error: "redirect" }, { status: 400 });
    }
    const type = (r.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
    if (!type.startsWith("image/")) {
      r.body?.cancel().catch(() => undefined);
      return NextResponse.json({ error: "type" }, { status: 415 });
    }
    const data = await readLimited(r, 3_000_000);
    return new NextResponse(data, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const status = error instanceof UpstreamError && error.code === "too_large" ? 413 : 502;
    return NextResponse.json({ error: error instanceof UpstreamError ? error.code : "upstream" }, { status });
  }
}
