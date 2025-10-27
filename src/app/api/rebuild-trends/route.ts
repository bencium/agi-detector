import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

type Period = 'daily' | 'weekly' | 'monthly';

// Input validation schema
const rebuildQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional()
});

async function snapshot(period: Period) {
  const windowDays = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
  const [row] = await prisma.$queryRaw<Array<{ avg: number; max: number; min: number; total: number; critical: number }>>(Prisma.sql`
    SELECT
      COALESCE(AVG(ar."score"), 0) AS avg,
      COALESCE(MAX(ar."score"), 0) AS max,
      COALESCE(MIN(ar."score"), 0) AS min,
      COUNT(*) AS total,
      SUM(CASE WHEN ar."severity" = 'critical' THEN 1 ELSE 0 END) AS critical
    FROM "AnalysisResult" ar
    WHERE ar."timestamp" >= NOW() - (CAST(${windowDays} AS int) * INTERVAL '1 day')
  `);

  await prisma.trendAnalysis.create({
    data: {
      period,
      avgScore: Number(row?.avg ?? 0),
      maxScore: Number(row?.max ?? 0),
      minScore: Number(row?.min ?? 0),
      totalAnalyses: Number(row?.total ?? 0),
      criticalAlerts: Number(row?.critical ?? 0),
    },
  });
}

export async function POST(request: Request) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    // Convert null to undefined so Zod validation works correctly
    const validatedQuery = rebuildQuerySchema.safeParse({
      period: searchParams.get('period') || undefined
    });

    if (!validatedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validatedQuery.error.errors
        },
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to rebuild trends' }, { status: 500 });
  }
}

