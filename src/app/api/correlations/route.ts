import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled } from '@/lib/db';
import {
  findSemanticCorrelations,
  getSemanticCorrelations,
  hasRecentCorrelations
} from '@/lib/semantic-correlations';

const CACHE_TTL_MINUTES = Number(process.env.CORRELATION_CACHE_TTL || 60);

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const windowDays = Math.min(Math.max(Number(searchParams.get('days') || 7), 1), 365);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 20);
    const forceRefresh = searchParams.get('refresh') === 'true';

    let correlations;

    if (forceRefresh) {
      // Force refresh: always call LLM
      correlations = await findSemanticCorrelations(windowDays, limit);
    } else {
      // Check if we have recent correlations (within cache TTL)
      const hasRecent = await hasRecentCorrelations(windowDays, CACHE_TTL_MINUTES);
      if (hasRecent) {
        correlations = await getSemanticCorrelations(windowDays, limit);
      } else {
        correlations = await findSemanticCorrelations(windowDays, limit);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        correlations,
        windowDays,
        count: correlations.length
      }
    });
  } catch (error) {
    console.error('Correlation API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch correlations' }, { status: 500 });
  }
}
