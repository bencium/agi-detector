import { NextResponse } from 'next/server';
import { query, queryOne, isDbEnabled } from '@/lib/db';

export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'DATABASE_URL not set (no-DB mode).' },
      { status: 503 }
    );
  }

  try {
    // Simple connectivity check
    const ping = await queryOne<{ ok: number }>('SELECT 1 as ok');

    // Basic stats
    const [crawlCount, analysisCount, trendCount] = await Promise.all([
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "CrawlResult"'),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "AnalysisResult"'),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "TrendAnalysis"')
    ]);

    // Recent timestamps
    const latestCrawl = await queryOne<{ timestamp: Date }>(
      'SELECT timestamp FROM "CrawlResult" ORDER BY timestamp DESC LIMIT 1'
    );
    const latestAnalysis = await queryOne<{ timestamp: Date }>(
      'SELECT timestamp FROM "AnalysisResult" ORDER BY timestamp DESC LIMIT 1'
    );

    return NextResponse.json({
      success: true,
      data: {
        ping,
        counts: {
          crawlResults: Number(crawlCount?.count || 0),
          analyses: Number(analysisCount?.count || 0),
          trends: Number(trendCount?.count || 0)
        },
        latest: {
          crawl: latestCrawl?.timestamp ?? null,
          analysis: latestAnalysis?.timestamp ?? null
        }
      }
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    return NextResponse.json({
      success: false,
      error: err?.message || 'DB health check failed',
      code: err?.code
    }, { status: 500 });
  }
}
