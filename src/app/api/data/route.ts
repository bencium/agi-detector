import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch crawl results
    const crawlResults = await prisma.crawlResult.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000 // Limit to prevent memory issues
    });

    // Get source counts - process manually since metadata is JSON
    const sourceStats: Record<string, number> = {};
    crawlResults.forEach(result => {
      try {
        const metadata = result.metadata as any;
        if (metadata?.source) {
          sourceStats[metadata.source] = (sourceStats[metadata.source] || 0) + 1;
        }
      } catch (e) {
        console.error('Error processing metadata:', e);
      }
    });

    // Get all analyses
    const analyses = await prisma.analysisResult.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000 // Limit to prevent memory issues
    });

    // Get latest crawl time
    const latestCrawl = crawlResults.length > 0 ? crawlResults[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        crawlResults,
        analyses,
        sourceStats,
        latestCrawlTime: latestCrawl?.timestamp || null,
        totalArticles: crawlResults.length,
        totalAnalyses: analyses.length
      }
    });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch data',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}