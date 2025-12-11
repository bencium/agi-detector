import { NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';
import { crawlAllSources } from '@/lib/crawler';

interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  try {
    console.log('[Crawler API] Starting full crawl...');

    const crawledResults = await crawlAllSources();
    console.log(`[Crawler API] Successfully crawled ${crawledResults.length} articles`);

    const savedResults: CrawlResult[] = [];

    for (const result of crawledResults) {
      try {
        // Check if article already exists
        const existing = await query<{ id: string }>(
          `SELECT id FROM "CrawlResult" WHERE url = $1 AND title = $2 LIMIT 1`,
          [result.url, result.title]
        );

        if (existing.length === 0) {
          const saved = await insert<CrawlResult>(
            `INSERT INTO "CrawlResult" (id, url, title, content, metadata)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)
             RETURNING id, url, title, content, timestamp, metadata`,
            [result.url, result.title, result.content, JSON.stringify(result.metadata)]
          );

          if (saved) {
            savedResults.push(saved);
          }
        } else {
          console.log(`[Crawler API] Skipping duplicate: ${result.title}`);
        }
      } catch (err) {
        console.error(`[Crawler API] Failed to save article: ${result.title}`, err);
      }
    }

    console.log(`[Crawler API] Saved ${savedResults.length} new articles (${crawledResults.length - savedResults.length} duplicates skipped)`);

    return NextResponse.json({
      success: true,
      data: savedResults,
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
