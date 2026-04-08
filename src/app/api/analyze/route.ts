import { NextRequest, NextResponse } from 'next/server';
import { query, isDbEnabled } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import {
  PipelineCrawlResult,
  analyzeArticle,
  updateTrendSnapshots,
} from '@/lib/analysis/pipeline';

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 503 }
    );
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'analyze' });
  if (limited) return limited;

  try {
    // Get the latest crawl result without analysis
    const latestCrawls = await query<PipelineCrawlResult>(
      `SELECT cr.id, cr.url, cr.title, cr.content, cr.timestamp, cr.metadata
       FROM "CrawlResult" cr
       LEFT JOIN "AnalysisResult" ar ON cr.id = ar."crawlId"
       WHERE ar.id IS NULL
       ORDER BY cr.timestamp DESC
       LIMIT 1`
    );

    const latestCrawl = latestCrawls[0];

    if (!latestCrawl || !latestCrawl.title || !latestCrawl.content) {
      return NextResponse.json(
        { success: false, error: 'No valid content to analyze' },
        { status: 404 }
      );
    }

    const result = await analyzeArticle(latestCrawl, {
      enableSecrecyDetection: true,
    });

    await updateTrendSnapshots();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
}
