import { NextRequest, NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';
import { crawlAllSources } from '@/lib/crawler';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { upsertEvidenceClaims } from '@/lib/evidence/storage';
import { setLastCrawlRunAt } from '@/lib/state/appState';

interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 2, keyPrefix: 'crawl' });
  if (limited) return limited;

  try {
    console.log('[Crawler API] Starting full crawl...');

    const crawledResults = await crawlAllSources();
    console.log(`[Crawler API] Successfully crawled ${crawledResults.length} articles`);
    await setLastCrawlRunAt(new Date().toISOString());

    const savedResults: CrawlResult[] = [];

    for (const result of crawledResults) {
      try {
        // Check if article already exists
        const contentHash = (result.metadata as Record<string, unknown> | null)?.contentHash as string | undefined;
        const existing = await query<{ id: string }>(
          `SELECT id FROM "CrawlResult"
           WHERE url = $1
              OR ( $2 IS NOT NULL AND metadata->>'contentHash' = $2 )
           LIMIT 1`,
          [result.url, contentHash || null]
        );

        if (existing.length === 0) {
          const saved = await insert<CrawlResult>(
            `INSERT INTO "CrawlResult" (id, url, title, content, metadata)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)
             RETURNING id, url, title, content, timestamp, metadata`,
            [result.url, result.title, result.content, JSON.stringify(result.metadata)]
          );

          if (saved) {
            const meta = result.metadata as Record<string, any> | null;
            const claims = meta?.evidence?.claims || [];
            const canonicalUrl = meta?.canonicalUrl as string | undefined;
            await upsertEvidenceClaims({
              crawlId: saved.id,
              claims,
              url: saved.url,
              canonicalUrl
            });
            savedResults.push(saved);
          }
        } else {
          console.log(`[Crawler API] Skipping duplicate: ${result.title}`);
        }
      } catch (err) {
        console.error(`[Crawler API] Failed to save article: ${result.title}`, err);
      }
    }

    const totalCrawled = crawledResults.length;
    const savedCount = savedResults.length;
    const duplicates = totalCrawled - savedCount;
    console.log(`[Crawler API] Saved ${savedCount} new articles (${duplicates} duplicates skipped)`);

    return NextResponse.json({
      success: true,
      data: savedResults,
      meta: {
        totalCrawled,
        savedCount,
        duplicates
      },
      message: `Successfully crawled and saved ${savedResults.length} articles`
    });
  } catch (error) {
    console.error('Crawling error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to crawl sources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
