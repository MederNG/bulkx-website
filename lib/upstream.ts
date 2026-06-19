/**
 * Server-only helper for talking to the upstream BULK indexer.
 *
 * The browser never calls indexer.bulk.trade directly — it only ever hits our
 * own /api routes. This module centralizes the upstream base URL (so it can be
 * swapped via env), sets a controlled User-Agent, and adds retry/backoff. It is
 * used by the server-side proxy route and the wallet lookup fallback.
 */
const DEFAULT_BASE = "https://indexer.bulk.trade";

export function getUpstreamBase(): string {
  return process.env.BULK_API_BASE?.replace(/\/$/, "") || DEFAULT_BASE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export interface UpstreamOptions {
  revalidate?: number;
  maxRetries?: number;
  /** Skip Next.js data cache entirely (for live polling). */
  noStore?: boolean;
}

export async function upstreamFetch(
  path: string,
  options: UpstreamOptions = {}
): Promise<Response> {
  const { revalidate = 300, maxRetries = 4, noStore = false } = options;
  const url = `${getUpstreamBase()}${path.startsWith("/") ? path : `/${path}`}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { "User-Agent": "AURA-Intelligence/1.0", Accept: "application/json" },
      ...(noStore ? { cache: "no-store" as const } : { next: { revalidate } }),
    });

    if ((res.status !== 429 && res.status < 500) || attempt >= maxRetries) {
      return res;
    }

    const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
    const backoff = Math.min(1000 * 2 ** attempt, 30_000);
    attempt += 1;
    await sleep((retryAfter ?? backoff) + Math.floor(Math.random() * 200));
  }
}

export async function upstreamJson<T>(path: string, options?: UpstreamOptions): Promise<T | null> {
  const res = await upstreamFetch(path, options);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Upstream ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
