import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled } from '@/lib/db';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { snapshotFromAnalysis } from '@/lib/trends';

type Period = 'daily' | 'weekly' | 'monthly';

const rebuildQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional()
});

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 2, keyPrefix: 'rebuild-trends' });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = rebuildQuerySchema.safeParse({
      period: searchParams.get('period') || undefined
    });

    if (!validatedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: validatedQuery.error.errors },
        { status: 400 }
      );
    }

    const p = (validatedQuery.data.period as Period) || 'daily';
    if (p === 'daily') {
      await snapshotFromAnalysis('daily');
    } else if (p === 'weekly') {
      await snapshotFromAnalysis('weekly');
    } else if (p === 'monthly') {
      await snapshotFromAnalysis('monthly');
    } else {
      await Promise.all([snapshotFromAnalysis('daily'), snapshotFromAnalysis('weekly')]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'Failed to rebuild trends' }, { status: 500 });
  }
}
