import { NextRequest, NextResponse } from 'next/server';
import { query, execute, isDbEnabled } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';

const NEW_STYLE = /\b(\d{4}\.\d{4,5})(v\d+)?\b/;
const OLD_STYLE = /\b([a-z\-]+(?:\.[A-Za-z\-]+)?\/\d{7})(v\d+)?\b/i;

function extractArxivId(text?: string | null): string | null {
  if (!text) return null;
  const t = String(text);
  const m1 = t.match(NEW_STYLE);
  if (m1) return m1[1] + (m1[2] || '');
  const m2 = t.match(OLD_STYLE);
  if (m2) return m2[1] + (m2[2] || '');
  const m3 = t.match(/arxiv\s*:\s*([^\s]+)/i);
  if (m3 && (NEW_STYLE.test(m3[1]) || OLD_STYLE.test(m3[1]))) return m3[1];
  return null;
}

function isValidArxivId(id: string): boolean {
  return NEW_STYLE.test(id) || OLD_STYLE.test(id);
}

interface CrawlRow {
  id: string;
  url: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

function deriveArxivUrl(row: CrawlRow): string | null {
  try {
    const meta = row.metadata || {};
    const src = String(meta?.source || '').toLowerCase();
    const isArxiv = src.includes('arxiv') || (row.url || '').includes('arxiv.org');
    if (!isArxiv) return null;

    const fromUrl = (() => {
      if (!row.url) return null;
      const m = row.url.match(/arxiv\.org\/abs\/([^\s?#]+)/i);
      if (m && isValidArxivId(m[1])) return m[1];
      return null;
    })();

    const candidates = [
      (meta as Record<string, string>)?.id,
      row.title,
      row.content,
      (meta as Record<string, string>)?.title,
      (meta as Record<string, string>)?.description
    ].map(extractArxivId).filter(Boolean) as string[];

    const id = fromUrl || candidates[0] || null;
    if (!id || !isValidArxivId(id)) return null;
    const fixed = `https://arxiv.org/abs/${id}`;
    if (row.url && row.url === fixed) return null;
    return fixed;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 1, keyPrefix: 'fix-arxiv-urls' });
  if (limited) return limited;

  try {
    const batch = 300;
    let scanned = 0;
    let updated = 0;
    let offset = 0;

    while (true) {
      const items = await query<CrawlRow>(`
        SELECT id, url, title, content, metadata
        FROM "CrawlResult"
        ORDER BY id ASC
        LIMIT $1 OFFSET $2
      `, [batch, offset]);

      if (items.length === 0) break;
      scanned += items.length;

      for (const it of items) {
        const nextUrl = deriveArxivUrl(it);
        if (nextUrl) {
          await execute(
            'UPDATE "CrawlResult" SET url = $1 WHERE id = $2',
            [nextUrl, it.id]
          );
          updated++;
        }
      }

      offset += batch;
      if (items.length < batch) break;
    }

    return NextResponse.json({ success: true, scanned, updated });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'Fix arXiv URLs failed' }, { status: 500 });
  }
}
