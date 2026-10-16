import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { fetchWithTimeout, readLimited, UpstreamError } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate";

export const dynamic = "force-dynamic";

const INSPECT_RE = /^steam:\/\/rungame\/730\/\d+\/+csgo_econ_action_preview(?:%20|\s|\+)[A-Za-z0-9%+_-]{10,500}$/;

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rate = takeRateLimit(`screenshot:${user.id}`, 10, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const inspect = req.nextUrl.searchParams.get("inspect") ?? "";
  if (!INSPECT_RE.test(inspect)) return NextResponse.json({ error: "inspect" }, { status: 400 });

  const template = process.env.SCREENSHOT_API_URL || process.env.NEXT_PUBLIC_SCREENSHOT_API_URL;
  if (!template || !template.includes("{inspect}")) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let upstream: URL;
  try {
    upstream = new URL(template.replace("{inspect}", encodeURIComponent(inspect)));
  } catch {
    return NextResponse.json({ error: "configuration" }, { status: 500 });
  }
  if (upstream.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && upstream.hostname === "localhost")) {
    return NextResponse.json({ error: "configuration" }, { status: 500 });
  }

  try {
    const response = await fetchWithTimeout(upstream, { cache: "no-store" }, 15_000);
    if (!response.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const type = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
    if (!type.startsWith("image/")) {
      response.body?.cancel().catch(() => undefined);
      return NextResponse.json({ error: "type" }, { status: 415 });
    }
    const data = await readLimited(response, 8_000_000);
    return new NextResponse(data, {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const status = error instanceof UpstreamError && error.code === "too_large" ? 413 : 502;
    return NextResponse.json({ error: error instanceof UpstreamError ? error.code : "upstream" }, { status });
  }
}
