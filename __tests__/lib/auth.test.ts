import { validateApiKeyHeader } from '@/lib/security/auth';

describe('validateApiKeyHeader', () => {
  it('returns 503 when expected key is missing', () => {
    const result = validateApiKeyHeader(new Headers(), undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });

  it('returns 401 when header missing', () => {
    const result = validateApiKeyHeader(new Headers(), 'secret');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('API key required');
    }
  });

  it('returns 401 when header invalid', () => {
    const headers = new Headers({ 'x-api-key': 'wrong' });
    const result = validateApiKeyHeader(headers, 'secret');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('Invalid API key');
    }
  });

  it('returns ok when header matches', () => {
    const headers = new Headers({ 'x-api-key': 'secret' });
    const result = validateApiKeyHeader(headers, 'secret');
    expect(result.ok).toBe(true);
  });
});
