import { NextRequest, NextResponse } from 'next/server';
import { findAnomalies, isDbEnabled } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const anomalies = await findAnomalies(limit);

    return NextResponse.json({
      success: true,
      data: {
        anomalies: anomalies.map(a => ({
          id: a.id,
          title: a.title,
          url: a.url,
          score: a.score,
          avgDistance: Math.round(a.avgDistance * 1000) / 1000
        })),
        description: 'Articles with embeddings furthest from the cluster center, potentially indicating unusual or unique content'
      }
    });
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect anomalies'
    }, { status: 500 });
  }
}
