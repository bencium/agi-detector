import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled, query } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { ensureEvidenceClaimsForCrawl } from '@/lib/evidence/storage';

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 2, keyPrefix: 'backfill-evidence' });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 200), 1), 1000);

    const rows = await query<{
      id: string;
      url: string;
      title: string;
      content: string;
      metadata: Record<string, unknown> | null;
    }>(`
      SELECT cr.id, cr.url, cr.title, cr.content, cr.metadata
      FROM "CrawlResult" cr
      LEFT JOIN "EvidenceClaim" ec ON ec."crawlId" = cr.id
      WHERE ec.id IS NULL
      ORDER BY cr.timestamp DESC
      LIMIT $1
    `, [limit]);

    let insertedClaims = 0;
    let processed = 0;

    for (const row of rows) {
      const claims = await ensureEvidenceClaimsForCrawl({
        crawlId: row.id,
        content: row.content,
        metadata: (row.metadata as Record<string, any> | null) || null,
        url: row.url,
        canonicalUrl: (row.metadata as Record<string, any> | null)?.canonicalUrl as string | undefined
      });
      if (claims.length > 0) insertedClaims += claims.length;
      processed += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        insertedClaims
      }
    });
  } catch (error) {
    console.error('Backfill evidence error:', error);
    return NextResponse.json({ success: false, error: 'Failed to backfill evidence' }, { status: 500 });
  }
}
