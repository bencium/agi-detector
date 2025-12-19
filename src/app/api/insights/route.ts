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
    const ttlMinutes = Math.min(Math.max(Number(process.env.INSIGHTS_TTL_MINUTES || 1440), 15), 1440);

    const cached = await getInsights(windowDays, limit);
    const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.API_KEY);
    const now = Date.now();
    const latest = cached[0]?.updatedAt ? new Date(cached[0].updatedAt).getTime() : 0;
    const ttlFresh = latest > 0 && (now - latest) < ttlMinutes * 60 * 1000;

    let insights = cached;
    let errorMessage: string | null = null;
    const shouldRefresh = cached.length === 0 || !ttlFresh;
    if (shouldRefresh) {
      try {
        insights = await refreshInsights(windowDays, limit);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Failed to refresh insights';
        // fall back to cached data if available
        insights = cached;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        insights,
        cached: cached.length > 0 && ttlFresh,
        error: errorMessage,
        ttlMinutes,
        windowDays
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch insights';
    console.error('Insights API error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
