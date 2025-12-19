import { NextRequest, NextResponse } from 'next/server';
import { query, isDbEnabled } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'metrics' });
  if (limited) return limited;

  try {
    const [counts, lastCrawl, lastAnalysis, lastJob] = await Promise.all([
      query<{ crawl: string; analysis: string }>(`
        SELECT
          (SELECT COUNT(*) FROM "CrawlResult")::text AS crawl,
          (SELECT COUNT(*) FROM "AnalysisResult")::text AS analysis
      `),
      query<{ timestamp: Date }>(`SELECT timestamp FROM "CrawlResult" ORDER BY timestamp DESC LIMIT 1`),
      query<{ timestamp: Date }>(`SELECT timestamp FROM "AnalysisResult" ORDER BY timestamp DESC LIMIT 1`),
      query<{ id: string; status: string; "processedArticles": number; "totalArticles": number }>(
        `SELECT id, status, "processedArticles", "totalArticles"
         FROM "AnalysisJob"
         ORDER BY "startedAt" DESC
         LIMIT 1`
      )
    ]);

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          crawlResults: Number(counts[0]?.crawl || 0),
          analyses: Number(counts[0]?.analysis || 0)
        },
        latest: {
          crawl: lastCrawl[0]?.timestamp || null,
          analysis: lastAnalysis[0]?.timestamp || null
        },
        analysisJob: lastJob[0] || null
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
