import crypto from 'crypto';

const STRIP_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'source',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid'
]);

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (STRIP_PARAMS.has(key.toLowerCase())) {
        params.delete(key);
      }
    }

    const cleanParams = new URLSearchParams();
    Array.from(params.entries())
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
      .forEach(([k, v]) => cleanParams.append(k, v));

    parsed.search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
