import { NextResponse } from 'next/server';
import { query, isDbEnabled } from '@/lib/db';
import { ensureAnalysisScoreSchema } from '@/lib/scoring/schema';
import { getLastCrawlRunAt } from '@/lib/state/appState';
import { enforceCriticalEvidenceGate, type Severity } from '@/lib/severity';

interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

interface AnalysisResult {
  id: string;
  crawlId: string;
  score: number;
  modelScore?: number | null;
  heuristicScore?: number | null;
  scoreBreakdown?: Record<string, unknown> | null;
  confidence: number;
  indicators: string[];
  severity: string | null;
  explanation: string | null;
  timestamp: Date;
  url: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
}

export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured',
      dbEnabled: false
    }, { status: 503 });
  }

  try {
    await ensureAnalysisScoreSchema();
    // Fetch crawl results
    const crawlResults = await query<CrawlResult>(`
      SELECT id, url, title, content, timestamp, metadata
      FROM "CrawlResult"
      ORDER BY timestamp DESC
      LIMIT 1000
    `);

    // Get source counts from metadata
    const sourceStats: Record<string, number> = {};
    crawlResults.forEach(result => {
      try {
        const metadata = result.metadata;
        if (metadata && typeof metadata === 'object' && 'source' in metadata) {
          const source = metadata.source as string;
          sourceStats[source] = (sourceStats[source] || 0) + 1;
        }
      } catch {
        // Skip malformed metadata
      }
    });

    // Get analyses with joined crawl data
    const analyses = await query<AnalysisResult>(`
      SELECT
        ar.id,
        ar."crawlId",
        ar.score,
        ar."modelScore",
        ar."heuristicScore",
        ar."scoreBreakdown",
        ar.confidence,
        ar.indicators,
        ar.severity,
        ar.explanation,
        ar.timestamp,
        cr.url,
        cr.title,
        cr.metadata
      FROM "AnalysisResult" ar
      LEFT JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      ORDER BY ar.timestamp DESC
      LIMIT 1000
    `);

    // Transform analyses to match expected format
    const formattedAnalyses = analyses.map(a => {
      const metadata = a.metadata as Record<string, any> | null;
      const claims = metadata?.evidence?.claims as Array<{ benchmark?: string; delta?: number }> | undefined;
      const hasDelta = Array.isArray(claims)
        ? claims.some((claim) => Boolean(claim.benchmark) && typeof claim.delta === 'number')
        : false;
      const severity = a.severity
        ? enforceCriticalEvidenceGate(a.severity as Severity, hasDelta)
        : a.severity;

      return {
        id: a.id,
        crawlId: a.crawlId,
        score: a.score,
        modelScore: a.modelScore || undefined,
        heuristicScore: a.heuristicScore || undefined,
        scoreBreakdown: a.scoreBreakdown || undefined,
        confidence: a.confidence,
        indicators: a.indicators,
        severity,
        explanation: a.explanation,
        timestamp: a.timestamp,
        crawl: a.url ? { url: a.url, title: a.title, metadata: a.metadata } : null
      };
    });

    const latestCrawl = crawlResults.length > 0 ? crawlResults[0] : null;
    const lastCrawlRunAt = await getLastCrawlRunAt();

    return NextResponse.json({
      success: true,
      dbEnabled: true,
      data: {
        crawlResults,
        analyses: formattedAnalyses,
        sourceStats,
        latestCrawlTime: latestCrawl?.timestamp || null,
        lastCrawlRunAt,
        totalArticles: crawlResults.length,
        totalAnalyses: analyses.length
      }
    });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data'
    }, { status: 500 });
  }
}
