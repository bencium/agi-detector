import { NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';

interface AnalysisRow {
  id: string;
  score: number;
  confidence: number;
  indicators: string[];
}

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  try {
    const batchSize = 200;
    let total = 0;
    let offset = 0;

    while (true) {
      const analyses = await query<AnalysisRow>(`
        SELECT id, score, confidence, indicators
        FROM "AnalysisResult"
        ORDER BY timestamp DESC
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (analyses.length === 0) break;

      // Check which analyses already have historical data
      const ids = analyses.map(a => a.id);
      const existing = await query<{ analysisId: string }>(`
        SELECT DISTINCT "analysisId"
        FROM "HistoricalData"
        WHERE "analysisId" = ANY($1)
      `, [ids]);

      const existingSet = new Set(existing.map(e => e.analysisId));

      for (const a of analyses) {
        if (existingSet.has(a.id)) continue;

        // Insert historical data for this analysis
        await insert(
          `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
          [a.id, 'score', a.score]
        );
        await insert(
          `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
          [a.id, 'confidence', a.confidence]
        );
        await insert(
          `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
          [a.id, 'indicator_count', a.indicators?.length || 0]
        );
        total += 3;
      }

      offset += batchSize;
      if (analyses.length < batchSize) break;
    }

    return NextResponse.json({ success: true, backfilledRows: total });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'Backfill failed' }, { status: 500 });
  }
}
