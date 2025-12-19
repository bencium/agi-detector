import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled } from '@/lib/db';
import { refreshCorrelationFindings, getCorrelationFindings } from '@/lib/correlations';

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const windowDays = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 50);
    const refresh = (searchParams.get('refresh') || 'true').toLowerCase() !== 'false';

    const findings = refresh
      ? await refreshCorrelationFindings(windowDays, limit)
      : await getCorrelationFindings(windowDays, limit);

    return NextResponse.json({
      success: true,
      data: {
        findings,
        windowDays
      }
    });
  } catch (error) {
    console.error('Correlation API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch correlations' }, { status: 500 });
  }
}
