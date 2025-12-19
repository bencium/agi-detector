import { NextRequest, NextResponse } from 'next/server';
import { query, isDbEnabled, insert } from '@/lib/db';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';
import { computeEvalMetrics } from '@/lib/evals/metrics';
import { ensureAccuracyMetricsSchema } from '@/lib/evals/storage';

const evalQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  threshold: z.coerce.number().min(0).max(1).default(0.3),
  persist: z.coerce.boolean().optional()
});

type FeedbackRow = {
  feedbackType: string;
  score: number;
  severity: string | null;
  confidence: number | null;
};

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: 'evals' });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const validated = evalQuerySchema.safeParse({
      days: searchParams.get('days') || undefined,
      threshold: searchParams.get('threshold') || undefined
    });

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: validated.error.errors },
        { status: 400 }
      );
    }

    const { days, threshold, persist } = validated.data;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await query<FeedbackRow>(`
      SELECT uf."feedbackType" as "feedbackType", ar.score, ar.severity, ar.confidence
      FROM "UserFeedback" uf
      JOIN "AnalysisResult" ar ON ar.id = uf."analysisId"
      WHERE uf.timestamp >= $1
    `, [since]);

    const computed = computeEvalMetrics(rows, threshold);

    if (persist) {
      await ensureAccuracyMetricsSchema();
      await insert(
        `INSERT INTO "AccuracyMetrics"
         (id, period, "truePositives", "falsePositives", "trueNegatives", "falseNegatives",
          "precision", recall, "f1Score", accuracy, "falsePositiveRate", "falseNegativeRate",
          "totalReviewed", "avgConfidence", notes)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          `${days}d`,
          computed.counts.tp,
          computed.counts.fp,
          computed.counts.tn,
          computed.counts.fn,
          computed.metrics.precision,
          computed.metrics.recall,
          computed.metrics.f1,
          computed.metrics.accuracy,
          computed.metrics.falsePositiveRate,
          computed.metrics.falseNegativeRate,
          computed.total,
          computed.avgConfidence ?? null,
          `threshold=${threshold}`
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        days,
        threshold,
        counts: computed.counts,
        metrics: computed.metrics,
        avgConfidence: computed.avgConfidence,
        totalFeedback: computed.total
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compute evals' },
      { status: 500 }
    );
  }
}
