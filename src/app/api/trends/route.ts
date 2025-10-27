import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Input validation schema
const trendsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate and parse query parameters
    // Convert null to undefined so Zod defaults work correctly
    const validatedQuery = trendsQuerySchema.safeParse({
      period: searchParams.get('period') || undefined,
      limit: searchParams.get('limit') || undefined
    });

    if (!validatedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validatedQuery.error.errors
        },
        { status: 400 }
      );
    }

    const { period, limit } = validatedQuery.data;

    // Prefer live aggregation from HistoricalData (Neon) for accuracy
    let trends: Array<{ timestamp: Date; avgScore: number; maxScore: number; criticalAlerts: number }>= [];
    try {
      const granularity = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'day';
      const windowDays = period === 'monthly' ? 365 : period === 'weekly' ? 180 : 30;

      // 1) Aggregate from HistoricalData (metric='score'), joined with AnalysisResult for critical counts
      const rows = await prisma.$queryRaw<Array<{ ts: Date; avg_score: number; max_score: number; critical: number }>>(Prisma.sql`
        SELECT
          date_trunc(${Prisma.raw(`'${granularity}'`)}, hd."timestamp") AS ts,
          AVG(hd."value") AS avg_score,
          MAX(hd."value") AS max_score,
          SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
        FROM "HistoricalData" hd
        JOIN "AnalysisResult" ar ON ar."id" = hd."analysisId"
        WHERE hd."metric" = 'score'
          AND hd."timestamp" >= NOW() - (CAST(${windowDays} AS int) * INTERVAL '1 day')
        GROUP BY ts
        ORDER BY ts DESC
        LIMIT ${limit}
      `);

      trends = rows.map(r => ({
        timestamp: new Date(r.ts),
        avgScore: Number(r.avg_score) || 0,
        maxScore: Number(r.max_score) || 0,
        criticalAlerts: Number(r.critical) || 0,
      }));
    } catch (aggErr) {
      console.warn('[Trends] HistoricalData aggregation failed, trying AnalysisResult:', aggErr);
      try {
        const granularity = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'day';
        const windowDays = period === 'monthly' ? 365 : period === 'weekly' ? 180 : 30;
        const rows2 = await prisma.$queryRaw<Array<{ ts: Date; avg_score: number; max_score: number; critical: number }>>(Prisma.sql`
          SELECT
            date_trunc(${Prisma.raw(`'${granularity}'`)}, ar."timestamp") AS ts,
            AVG(ar."score") AS avg_score,
            MAX(ar."score") AS max_score,
            SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
          FROM "AnalysisResult" ar
          WHERE ar."timestamp" >= NOW() - (CAST(${windowDays} AS int) * INTERVAL '1 day')
          GROUP BY ts
          ORDER BY ts DESC
          LIMIT ${limit}
        `);
        trends = rows2.map(r => ({
          timestamp: new Date(r.ts),
          avgScore: Number(r.avg_score) || 0,
          maxScore: Number(r.max_score) || 0,
          criticalAlerts: Number(r.critical) || 0,
        }));
      } catch (agg2Err) {
        console.warn('[Trends] AnalysisResult aggregation failed, falling back to snapshots:', agg2Err);
        const snapshots = await prisma.trendAnalysis.findMany({
          where: { period },
          orderBy: { timestamp: 'desc' },
          take: limit
        });
        trends = snapshots.map(s => ({
          timestamp: s.timestamp,
          avgScore: s.avgScore,
          maxScore: s.maxScore,
          criticalAlerts: s.criticalAlerts,
        }));
      }
    }

    // Get historical data for visualization
    const historicalData = await prisma.historicalData.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit * 10,
      include: {
        analysis: {
          select: {
            score: true,
            confidence: true,
            severity: true,
            indicators: true
          }
        }
      }
    });

    // Get recent critical alerts
    const criticalAlerts = await prisma.analysisResult.findMany({
      where: { severity: 'critical' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        crawl: {
          select: {
            title: true,
            url: true,
            metadata: true
          }
        }
      }
    });

    // Calculate statistics
    const stats = {
      averageScore: trends.length > 0 
        ? trends.reduce((sum, t) => sum + t.avgScore, 0) / trends.length 
        : 0,
      maxScoreRecorded: trends.length > 0 
        ? Math.max(...trends.map(t => t.maxScore)) 
        : 0,
      totalAnalyses: undefined as any, // not displayed; kept for compatibility
      criticalAlertsCount: trends.reduce((sum, t) => sum + t.criticalAlerts, 0),
      trend: calculateTrend(trends)
    };

    return NextResponse.json({
      success: true,
      data: {
        trends,
        historicalData,
        criticalAlerts,
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
