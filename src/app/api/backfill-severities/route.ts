import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';
import { computeSeverity } from '@/lib/severity';

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  try {
    const batchSize = 500;
    let updated = 0;
    let scanned = 0;
    let cursor: string | null = null;

    const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

    while (true) {
      const rows: any[] = await prisma.analysisResult.findMany({
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, score: true, severity: true },
      });
      if (rows.length === 0) break;

      const ops = rows.map((r) => {
        const current = (r.severity || 'none').toLowerCase();
        const next = computeSeverity(r.score || 0, current as any);
        if ((rank[next] ?? 0) > (rank[current] ?? 0)) {
          return prisma.analysisResult.update({ where: { id: r.id }, data: { severity: next } });
        }
        return null;
      }).filter(Boolean) as Parameters<typeof prisma.$transaction>[0];

      if (ops.length > 0) {
        const results = await prisma.$transaction(ops);
        updated += results.length;
      }

      scanned += rows.length;
      cursor = rows[rows.length - 1].id;
      if (rows.length < batchSize) break;
    }

    return NextResponse.json({ success: true, scanned, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Backfill severities failed' }, { status: 500 });
  }
}

