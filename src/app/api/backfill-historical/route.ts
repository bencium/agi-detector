import { NextResponse } from 'next/server';
import { prisma, isDbEnabled } from '@/lib/prisma';

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  try {
    const batchSize = 200;
    let total = 0;
    let cursor: string | null = null;

    // Process in pages
    // Find analyses that do not have any HistoricalData rows yet
    // Simpler approach: backfill for all analyses (idempotent enough if we de-dupe per analysis)
    while (true) {
      const analyses: any[] = await prisma.analysisResult.findMany({
        orderBy: { timestamp: 'desc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, score: true, confidence: true, indicators: true },
      });
      if (analyses.length === 0) break;

      // Check which analysis already has historical data
      const ids = analyses.map(a => a.id);
      const existing = await prisma.historicalData.findMany({
        where: { analysisId: { in: ids } },
        select: { analysisId: true },
      });
      const existingSet = new Set(existing.map(e => e.analysisId));

      const rows: { analysisId: string; metric: string; value: number }[] = [];
      for (const a of analyses) {
        if (existingSet.has(a.id)) continue; // skip if already backfilled
        rows.push({ analysisId: a.id, metric: 'score', value: a.score });
        rows.push({ analysisId: a.id, metric: 'confidence', value: a.confidence });
        rows.push({ analysisId: a.id, metric: 'indicator_count', value: a.indicators?.length || 0 });
      }
      if (rows.length > 0) {
        await prisma.historicalData.createMany({ data: rows });
        total += rows.length;
      }

      cursor = analyses[analyses.length - 1].id;
      if (analyses.length < batchSize) break;
    }

    return NextResponse.json({ success: true, backfilledRows: total });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Backfill failed' }, { status: 500 });
  }
}

