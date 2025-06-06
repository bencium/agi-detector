import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const limit = parseInt(searchParams.get('limit') || '30');

    // Get trend data
    const trends = await prisma.trendAnalysis.findMany({
      where: { period },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

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
      totalAnalyses: trends.reduce((sum, t) => sum + t.totalAnalyses, 0),
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

function calculateTrend(trends: any[]): 'increasing' | 'decreasing' | 'stable' {
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