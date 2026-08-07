import { NextResponse } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
};

const globalStore = globalThis as unknown as {
  __rateLimitStore?: Map<string, RateLimitEntry>;
};

const store = globalStore.__rateLimitStore ?? new Map<string, RateLimitEntry>();
globalStore.__rateLimitStore = store;

// Periodically drop expired entries so the map cannot grow unbounded in a
// long-lived process (previously nothing ever evicted them).
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

function sweepExpiredEntries(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// Test hooks (same convention as brave-search's _clearBraveCache)
export function _clearRateLimitStore(): void {
  store.clear();
  lastSweepAt = 0;
}

export function _rateLimitStoreSize(): number {
  return store.size;
}

function getClientKey(req: Request, keyPrefix?: string): string {
  const headers = req.headers;
  const apiKey = headers.get('x-api-key') || 'no-key';
  const forwardedFor = headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown-ip';
  const prefix = keyPrefix ? `${keyPrefix}:` : '';
  return `${prefix}${apiKey}:${ip}`;
}

export function enforceRateLimit(req: Request, options: RateLimitOptions): NextResponse | null {
  const key = getClientKey(req, options.keyPrefix);
  const now = Date.now();
  sweepExpiredEntries(now);
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (entry.count >= options.max) {
    const retryAfter = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        retryAfterSeconds: retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString()
        }
      }
    );
  }

  entry.count += 1;
  store.set(key, entry);
  return null;
}
