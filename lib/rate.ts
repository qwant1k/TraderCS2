type Bucket = { count: number; resetAt: number };

const globalRate = globalThis as unknown as { tradeggRate?: Map<string, Bucket> };
const buckets = globalRate.tradeggRate ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalRate.tradeggRate = buckets;

export function takeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size >= 10_000 && !buckets.has(key)) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size >= 10_000) return { allowed: false, retryAfter: 60 };
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count++;
  return { allowed: true, retryAfter: 0 };
}

export function requestClientKey(headers: Headers) {
  return (headers.get("x-forwarded-for")?.split(",", 1)[0] || headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}
