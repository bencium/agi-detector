import { execute } from '@/lib/db';

let analysisSchemaEnsured = false;

export async function ensureAnalysisScoreSchema(): Promise<void> {
  if (analysisSchemaEnsured) return;
  try {
    await execute(`ALTER TABLE "AnalysisResult" ADD COLUMN IF NOT EXISTS "modelScore" DOUBLE PRECISION`);
    await execute(`ALTER TABLE "AnalysisResult" ADD COLUMN IF NOT EXISTS "heuristicScore" DOUBLE PRECISION`);
    await execute(`ALTER TABLE "AnalysisResult" ADD COLUMN IF NOT EXISTS "scoreBreakdown" JSONB`);
    analysisSchemaEnsured = true;
  } catch (error) {
    console.warn('[AnalysisResult] Failed to ensure score schema:', error);
  }
}
