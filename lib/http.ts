export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "too_large" | "bad_type" | "redirect" | "unavailable",
  ) {
    super(message);
  }
}

export async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 8_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamError("Внешний сервис не ответил вовремя", "timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    response.body?.cancel().catch(() => undefined);
    throw new UpstreamError("Ответ внешнего сервиса слишком большой", "too_large");
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new UpstreamError("Ответ внешнего сервиса слишком большой", "too_large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
