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
