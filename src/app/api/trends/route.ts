import { NextResponse } from 'next/server';
import { query, isDbEnabled } from '@/lib/db';
import { z } from 'zod';

const trendsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

interface TrendRow {
  ts: Date;
  avg_score: number;
  max_score: number;
  critical: number;
}

interface HistoricalRow {
  id: string;
  analysisId: string;
  metric: string;
  value: number;
  timestamp: Date;
  score: number;
  confidence: number;
  severity: string | null;
  indicators: string[];
}

interface CriticalAlert {
  id: string;
  score: number;
  severity: string;
  timestamp: Date;
  title: string;
  url: string;
  metadata: Record<string, unknown> | null;
}

export async function GET(request: Request) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = trendsQuerySchema.safeParse({
      period: searchParams.get('period') || undefined,
      limit: searchParams.get('limit') || undefined
    });

    if (!validatedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: validatedQuery.error.errors },
        { status: 400 }
      );
    }

    const { period, limit } = validatedQuery.data;
    const granularity = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'day';
    const windowDays = period === 'monthly' ? 365 : period === 'weekly' ? 180 : 30;

    let trends: Array<{ timestamp: Date; avgScore: number; maxScore: number; criticalAlerts: number }> = [];

    try {
      // Aggregate from HistoricalData
      const rows = await query<TrendRow>(`
        SELECT
          date_trunc('${granularity}', hd."timestamp") AS ts,
          AVG(hd."value") AS avg_score,
          MAX(hd."value") AS max_score,
          SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
        FROM "HistoricalData" hd
        JOIN "AnalysisResult" ar ON ar."id" = hd."analysisId"
        WHERE hd."metric" = 'score'
          AND hd."timestamp" >= NOW() - INTERVAL '${windowDays} days'
        GROUP BY ts
        ORDER BY ts DESC
        LIMIT $1
      `, [limit]);

      trends = rows.map(r => ({
        timestamp: new Date(r.ts),
        avgScore: Number(r.avg_score) || 0,
        maxScore: Number(r.max_score) || 0,
        criticalAlerts: Number(r.critical) || 0
      }));
    } catch (aggErr) {
      console.warn('[Trends] HistoricalData aggregation failed, trying AnalysisResult:', aggErr);

      try {
        const rows2 = await query<TrendRow>(`
          SELECT
            date_trunc('${granularity}', ar."timestamp") AS ts,
            AVG(ar."score") AS avg_score,
            MAX(ar."score") AS max_score,
            SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
          FROM "AnalysisResult" ar
          WHERE ar."timestamp" >= NOW() - INTERVAL '${windowDays} days'
          GROUP BY ts
          ORDER BY ts DESC
          LIMIT $1
        `, [limit]);

        trends = rows2.map(r => ({
          timestamp: new Date(r.ts),
          avgScore: Number(r.avg_score) || 0,
          maxScore: Number(r.max_score) || 0,
          criticalAlerts: Number(r.critical) || 0
        }));
      } catch (agg2Err) {
        console.warn('[Trends] AnalysisResult aggregation failed, falling back to snapshots:', agg2Err);

        const snapshots = await query<{
          timestamp: Date;
          avgScore: number;
          maxScore: number;
          criticalAlerts: number;
        }>(`
          SELECT timestamp, "avgScore", "maxScore", "criticalAlerts"
          FROM "TrendAnalysis"
          WHERE period = $1
          ORDER BY timestamp DESC
          LIMIT $2
        `, [period, limit]);

        trends = snapshots.map(s => ({
          timestamp: s.timestamp,
          avgScore: s.avgScore,
          maxScore: s.maxScore,
          criticalAlerts: s.criticalAlerts
        }));
      }
    }

    // Get historical data for visualization
    const historicalData = await query<HistoricalRow>(`
      SELECT
        hd.id,
        hd."analysisId",
        hd.metric,
        hd.value,
        hd.timestamp,
        ar.score,
        ar.confidence,
        ar.severity,
        ar.indicators
      FROM "HistoricalData" hd
      JOIN "AnalysisResult" ar ON ar.id = hd."analysisId"
      ORDER BY hd.timestamp DESC
      LIMIT $1
    `, [limit * 10]);

    // Get recent critical alerts
    const criticalAlerts = await query<CriticalAlert>(`
      SELECT
        ar.id,
        ar.score,
        ar.severity,
        ar.timestamp,
        cr.title,
        cr.url,
        cr.metadata
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      WHERE ar.severity = 'critical'
      ORDER BY ar.timestamp DESC
      LIMIT 5
    `);

    // Calculate statistics
    const stats = {
      averageScore: trends.length > 0
        ? trends.reduce((sum, t) => sum + t.avgScore, 0) / trends.length
        : 0,
      maxScoreRecorded: trends.length > 0
        ? Math.max(...trends.map(t => t.maxScore))
        : 0,
      totalAnalyses: undefined as number | undefined,
      criticalAlertsCount: trends.reduce((sum, t) => sum + t.criticalAlerts, 0),
      trend: calculateTrend(trends)
    };

    return NextResponse.json({
      success: true,
      data: {
        trends,
        historicalData: historicalData.map(h => ({
          ...h,
          analysis: {
            score: h.score,
            confidence: h.confidence,
            severity: h.severity,
            indicators: h.indicators
          }
        })),
        criticalAlerts: criticalAlerts.map(a => ({
          ...a,
          crawl: { title: a.title, url: a.url, metadata: a.metadata }
        })),
        stats
      }
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}

function calculateTrend(trends: Array<{ avgScore: number }>): 'increasing' | 'decreasing' | 'stable' {
  if (trends.length < 2) return 'stable';

  const recentScores = trends.slice(0, 5).map(t => t.avgScore);
  const olderScores = trends.slice(5, 10).map(t => t.avgScore);

  if (olderScores.length === 0) return 'stable';

  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;

  const difference = recentAvg - olderAvg;

  if (difference > 0.1) return 'increasing';
  if (difference < -0.1) return 'decreasing';
  return 'stable';
}
