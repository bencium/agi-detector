import { NextRequest, NextResponse } from 'next/server';
import { findAnomalies, isDbEnabled } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: 'anomalies' });
  if (limited) return limited;

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const minScore = parseFloat(searchParams.get('minScore') || '0.2');

  try {
    const anomalies = await findAnomalies(limit, Number.isFinite(minScore) ? minScore : 0.2);

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
        description: `Articles with embeddings furthest from their source-group centroid (min AGI score ${(minScore * 100).toFixed(0)}%)`
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
