import axios from 'axios';

export type BraveWebDoc = {
  title: string;
  url: string;
  snippet?: string;
};

type BraveAPIResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
};

type SearchOptions = {
  count?: number; // 1-20
  freshness?: 'pd' | 'pw' | 'pm' | 'py'; // past day/week/month/year
  country?: string; // e.g., 'us'
};

// Simple in-memory TTL cache
const cache = new Map<string, { data: BraveWebDoc[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

function cacheKey(q: string, opts: SearchOptions): string {
  return JSON.stringify({ q, ...opts });
}

export async function braveWebSearch(q: string, opts: SearchOptions = {}): Promise<BraveWebDoc[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];

  const key = cacheKey(q, opts);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.data;

  const params: Record<string, string | number> = {
    q,
    count: Math.min(Math.max(opts.count ?? 5, 1), 20),
  };
  if (opts.freshness) params.freshness = opts.freshness;
  if (opts.country) params.country = opts.country;

  const resp = await axios.get<BraveAPIResponse>(BRAVE_ENDPOINT, {
    params,
    headers: { 'X-Subscription-Token': apiKey },
    timeout: 10000,
    validateStatus: s => s < 500,
  });

  const docs: BraveWebDoc[] = (resp.data.web?.results || [])
    .filter(r => r.title && r.url)
    .map(r => ({ title: r.title!, url: r.url!, snippet: r.description }));

  cache.set(key, { data: docs, ts: now });
  return docs;
}

export function _clearBraveCache() {
  cache.clear();
}

