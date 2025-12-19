import { execute } from '@/lib/db';

let accuracySchemaEnsured = false;

export async function ensureAccuracyMetricsSchema(): Promise<void> {
  if (accuracySchemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "AccuracyMetrics" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        period TEXT NOT NULL,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "truePositives" INTEGER NOT NULL,
        "falsePositives" INTEGER NOT NULL,
        "trueNegatives" INTEGER NOT NULL,
        "falseNegatives" INTEGER NOT NULL,
        "precision" DOUBLE PRECISION NOT NULL,
        recall DOUBLE PRECISION NOT NULL,
        "f1Score" DOUBLE PRECISION NOT NULL,
        accuracy DOUBLE PRECISION NOT NULL,
        "falsePositiveRate" DOUBLE PRECISION NOT NULL,
        "falseNegativeRate" DOUBLE PRECISION NOT NULL,
        "totalReviewed" INTEGER NOT NULL,
        "avgConfidence" DOUBLE PRECISION,
        notes TEXT,
        CONSTRAINT "AccuracyMetrics_pkey" PRIMARY KEY (id)
      )
    `);
    accuracySchemaEnsured = true;
  } catch (error) {
    console.warn('[AccuracyMetrics] Failed to ensure schema:', error);
  }
}
