import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';

const NEW_STYLE = /\b(\d{4}\.\d{4,5})(v\d+)?\b/; // e.g., 2506.04207 or 2506.04207v1
const OLD_STYLE = /\b([a-z\-]+(?:\.[A-Za-z\-]+)?\/\d{7})(v\d+)?\b/i; // e.g., cs.AI/9901001

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

function deriveArxivUrl(row: { url: string | null; title?: string | null; content?: string | null; metadata?: any }): string | null {
  try {
    const meta = row.metadata || {};
    const src = String(meta?.source || '').toLowerCase();
    const isArxiv = src.includes('arxiv') || (row.url || '').includes('arxiv.org');
    if (!isArxiv) return null;

    // 1) From existing URL
    const fromUrl = (() => {
      if (!row.url) return null;
      const m = row.url.match(/arxiv\.org\/abs\/([^\s?#]+)/i);
      if (m && isValidArxivId(m[1])) return m[1];
      return null;
    })();

    // 2) From metadata.id/title/content patterns
    const candidates = [
      meta?.id,
      row.title,
      row.content,
      meta?.title,
      meta?.description,
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

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }
  try {
    let cursor: string | null = null;
    const batch = 300;
    let scanned = 0;
    let updated = 0;

    while (true) {
      const items = await prisma.crawlResult.findMany({
        orderBy: { id: 'asc' },
        take: batch,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, url: true, title: true, content: true, metadata: true },
      });
      if (items.length === 0) break;
      scanned += items.length;

      const ops = items.map((it) => {
        const nextUrl = deriveArxivUrl(it as any);
        if (!nextUrl) return null;
        return prisma.crawlResult.update({ where: { id: it.id }, data: { url: nextUrl } });
      }).filter(Boolean) as any[];

      if (ops.length > 0) {
        const res = await prisma.$transaction(ops);
        updated += res.length;
      }

      cursor = items[items.length - 1].id;
      if (items.length < batch) break;
    }

    return NextResponse.json({ success: true, scanned, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Fix arXiv URLs failed' }, { status: 500 });
  }
}
