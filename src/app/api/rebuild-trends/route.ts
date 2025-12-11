import { NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';
import { z } from 'zod';

type Period = 'daily' | 'weekly' | 'monthly';

const rebuildQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional()
});

interface AggRow {
  avg: number;
  max: number;
  min: number;
  total: string;
  critical: string;
}

async function snapshot(period: Period) {
  const windowDays = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;

  const rows = await query<AggRow>(`
    SELECT
      COALESCE(AVG(ar."score"), 0) AS avg,
      COALESCE(MAX(ar."score"), 0) AS max,
      COALESCE(MIN(ar."score"), 0) AS min,
      COUNT(*) AS total,
      SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
    FROM "AnalysisResult" ar
    WHERE ar."timestamp" >= NOW() - INTERVAL '${windowDays} days'
  `);

  const row = rows[0];

  await insert(`
    INSERT INTO "TrendAnalysis" (id, period, "avgScore", "maxScore", "minScore", "totalAnalyses", "criticalAlerts")
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
  `, [
    period,
    Number(row?.avg ?? 0),
    Number(row?.max ?? 0),
    Number(row?.min ?? 0),
    Number(row?.total ?? 0),
    Number(row?.critical ?? 0)
  ]);
}

export async function POST(request: Request) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

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
      await snapshot('daily');
    } else if (p === 'weekly') {
      await snapshot('weekly');
    } else if (p === 'monthly') {
      await snapshot('monthly');
    } else {
      await Promise.all([snapshot('daily'), snapshot('weekly')]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'Failed to rebuild trends' }, { status: 500 });
  }
}
