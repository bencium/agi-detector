import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';

export async function GET() {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'DATABASE_URL not set (no-DB mode).'},
      { status: 503 }
    );
  }

  try {
    // Simple connectivity check
    const ping = await prisma.$queryRawUnsafe<any>('SELECT 1 as ok');

    // Basic stats
    const [crawlCount, analysisCount, trendCount] = await Promise.all([
      prisma.crawlResult.count(),
      prisma.analysisResult.count(),
      prisma.trendAnalysis.count(),
    ]);

    // Recent timestamps (if any)
    const latestCrawl = await prisma.crawlResult.findFirst({ orderBy: { timestamp: 'desc' }, select: { timestamp: true } });
    const latestAnalysis = await prisma.analysisResult.findFirst({ orderBy: { timestamp: 'desc' }, select: { timestamp: true } });

    return NextResponse.json({
      success: true,
      data: {
        ping: Array.isArray(ping) ? ping[0] : ping,
        counts: {
          crawlResults: crawlCount,
          analyses: analysisCount,
          trends: trendCount,
        },
        latest: {
          crawl: latestCrawl?.timestamp ?? null,
          analysis: latestAnalysis?.timestamp ?? null,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'DB health check failed',
      code: error?.code,
    }, { status: 500 });
  }
}

