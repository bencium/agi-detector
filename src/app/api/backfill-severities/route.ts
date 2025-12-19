import { NextRequest, NextResponse } from 'next/server';
import { query, execute, isDbEnabled } from '@/lib/db';
import { computeSeverity } from '@/lib/severity';
import { enforceRateLimit } from '@/lib/security/rateLimit';

interface AnalysisRow {
  id: string;
  score: number;
  severity: string | null;
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'DB disabled' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 1, keyPrefix: 'backfill-severities' });
  if (limited) return limited;

  try {
    const batchSize = 500;
    let updated = 0;
    let scanned = 0;
    let offset = 0;

    const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

    while (true) {
      const rows = await query<AnalysisRow>(`
        SELECT id, score, severity
        FROM "AnalysisResult"
        ORDER BY id ASC
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (rows.length === 0) break;

      for (const r of rows) {
        const current = (r.severity || 'none').toLowerCase();
        const next = computeSeverity(r.score || 0, current as 'none' | 'low' | 'medium' | 'high' | 'critical');
        if ((rank[next] ?? 0) > (rank[current] ?? 0)) {
          await execute(
            'UPDATE "AnalysisResult" SET severity = $1 WHERE id = $2',
            [next, r.id]
          );
          updated++;
        }
      }

      scanned += rows.length;
      offset += batchSize;
      if (rows.length < batchSize) break;
    }

    return NextResponse.json({ success: true, scanned, updated });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err?.message || 'Backfill severities failed' }, { status: 500 });
  }
}
