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
    const refresh = (searchParams.get('refresh') || 'true').toLowerCase() !== 'false';

    const insights = refresh
      ? await refreshInsights(windowDays, limit)
      : await getInsights(windowDays, limit);

    return NextResponse.json({
      success: true,
      data: {
        insights,
        windowDays
      }
    });
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch insights' }, { status: 500 });
  }
}
