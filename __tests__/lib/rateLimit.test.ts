/**
 * Tests for the in-memory API rate limiter (src/lib/security/rateLimit.ts),
 * including eviction of expired entries.
 *
 * next/server needs fetch globals that jsdom lacks, so NextResponse is stubbed
 * with just enough surface for the limiter's 429 response.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: { get: (name: string) => init?.headers?.[name] ?? null },
      body,
    }),
  },
}));

import {
  enforceRateLimit,
  _clearRateLimitStore,
  _rateLimitStoreSize,
} from '@/lib/security/rateLimit';

function fakeRequest(apiKey = 'test-key', ip = '203.0.113.10'): Request {
  const headers = new Map<string, string>([
    ['x-api-key', apiKey],
    ['x-forwarded-for', ip],
  ]);
  return { headers: { get: (name: string) => headers.get(name) ?? null } } as unknown as Request;
}

describe('enforceRateLimit', () => {
  let nowSpy: jest.SpyInstance<number, []>;
  let now = 1_000_000;

  beforeEach(() => {
    _clearRateLimitStore();
    now = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    _clearRateLimitStore();
  });

  it('allows requests under the limit and returns null', () => {
    const options = { windowMs: 1000, max: 3, keyPrefix: 'test' };
    expect(enforceRateLimit(fakeRequest(), options)).toBeNull();
    expect(enforceRateLimit(fakeRequest(), options)).toBeNull();
    expect(enforceRateLimit(fakeRequest(), options)).toBeNull();
  });

  it('returns a 429 response with Retry-After once the limit is exceeded', () => {
    const options = { windowMs: 10_000, max: 2, keyPrefix: 'test' };
    enforceRateLimit(fakeRequest(), options);
    enforceRateLimit(fakeRequest(), options);

    const limited = enforceRateLimit(fakeRequest(), options);
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('Retry-After')).toBe('10');
  });

  it('resets the window after it expires', () => {
    const options = { windowMs: 1000, max: 1, keyPrefix: 'test' };
    expect(enforceRateLimit(fakeRequest(), options)).toBeNull();
    expect(enforceRateLimit(fakeRequest(), options)).not.toBeNull();

    now += 1001; // window elapsed
    expect(enforceRateLimit(fakeRequest(), options)).toBeNull();
  });

  it('tracks clients separately by api key and key prefix', () => {
    const options = { windowMs: 10_000, max: 1, keyPrefix: 'a' };
    expect(enforceRateLimit(fakeRequest('key-1'), options)).toBeNull();
    expect(enforceRateLimit(fakeRequest('key-2'), options)).toBeNull();
    expect(enforceRateLimit(fakeRequest('key-1'), { ...options, keyPrefix: 'b' })).toBeNull();
    expect(enforceRateLimit(fakeRequest('key-1'), options)).not.toBeNull();
  });

  it('evicts expired entries so the store does not grow unbounded', () => {
    const options = { windowMs: 1000, max: 5, keyPrefix: 'test' };

    for (let i = 0; i < 10; i += 1) {
      enforceRateLimit(fakeRequest('key', `198.51.100.${i}`), options);
    }
    expect(_rateLimitStoreSize()).toBe(10);

    // Advance past both the entries' windows and the sweep interval
    now += 61_000;
    enforceRateLimit(fakeRequest('key', '198.51.100.99'), options);

    // All 10 expired entries were swept; only the new one remains
    expect(_rateLimitStoreSize()).toBe(1);
  });

  it('does not sweep more than once per interval', () => {
    const options = { windowMs: 100, max: 5, keyPrefix: 'test' };

    enforceRateLimit(fakeRequest('key', '198.51.100.1'), options);
    now += 200; // entry expired, but sweep interval (60s) not yet elapsed
    enforceRateLimit(fakeRequest('key', '198.51.100.2'), options);

    // Expired entry is still present because no sweep ran
    expect(_rateLimitStoreSize()).toBe(2);
  });
});
