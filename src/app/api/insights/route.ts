import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled } from '@/lib/db';
import { refreshInsights, getInsights } from '@/lib/insights';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const windowDays = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 5), 1), 10);
    const refreshParam = (searchParams.get('refresh') || 'false').toLowerCase();
    const forceRefresh = refreshParam === 'true' || refreshParam === 'force';
    const ttlMinutes = Math.min(Math.max(Number(process.env.INSIGHTS_TTL_MINUTES || 360), 15), 1440);

    const cached = await getInsights(windowDays, limit);
    const now = Date.now();
    const latest = cached[0]?.updatedAt ? new Date(cached[0].updatedAt).getTime() : 0;
    const ttlFresh = latest > 0 && (now - latest) < ttlMinutes * 60 * 1000;

    const insights = (cached.length > 0 && ttlFresh && !forceRefresh)
      ? cached
      : await refreshInsights(windowDays, limit);

    return NextResponse.json({
      success: true,
      data: {
        insights,
        cached: cached.length > 0 && ttlFresh && !forceRefresh,
        ttlMinutes,
        windowDays
      }
    });
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch insights' }, { status: 500 });
  }
}
