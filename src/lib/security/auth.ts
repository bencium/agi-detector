export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function validateApiKeyHeader(headers: Headers, expectedKey?: string): AuthResult {
  if (!expectedKey) {
    return { ok: false, status: 503, error: 'LOCAL_API_KEY not configured' };
  }

  const apiKey = headers.get('x-api-key');
  if (!apiKey) {
    return { ok: false, status: 401, error: 'API key required' };
  }

  if (apiKey !== expectedKey) {
    return { ok: false, status: 401, error: 'Invalid API key' };
  }

  return { ok: true };
}
