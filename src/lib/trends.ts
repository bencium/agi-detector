import { execute, query } from '@/lib/db';

export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

let trendSchemaEnsured = false;

export async function ensureTrendAnalysisSchema(): Promise<void> {
  if (trendSchemaEnsured) return;
  try {
    await execute(`ALTER TABLE "TrendAnalysis" ADD COLUMN IF NOT EXISTS "dateBucket" DATE`);
    await execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "TrendAnalysis_period_dateBucket_key"
       ON "TrendAnalysis"(period, "dateBucket")`
    );
    trendSchemaEnsured = true;
  } catch (error) {
    console.warn('[TrendAnalysis] Failed to ensure schema:', error);
  }
}

export function dateBucketForPeriod(period: TrendPeriod, date = new Date()): string {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));

  if (period === 'weekly') {
    const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setUTCDate(d.getUTCDate() + diff);
  } else if (period === 'monthly') {
    d.setUTCDate(1);
  }

  return d.toISOString().slice(0, 10);
}

export async function upsertTrendSnapshot(
  period: TrendPeriod,
  stats: {
    avgScore: number;
    maxScore: number;
    minScore: number;
    totalAnalyses: number;
    criticalAlerts: number;
  },
  bucketDate?: string
): Promise<void> {
  await ensureTrendAnalysisSchema();
  const dateBucket = bucketDate || dateBucketForPeriod(period);

  await execute(
    `INSERT INTO "TrendAnalysis"
       (id, period, "avgScore", "maxScore", "minScore", "totalAnalyses", "criticalAlerts", "dateBucket")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (period, "dateBucket")
     DO UPDATE SET
       "avgScore" = EXCLUDED."avgScore",
       "maxScore" = EXCLUDED."maxScore",
       "minScore" = EXCLUDED."minScore",
       "totalAnalyses" = EXCLUDED."totalAnalyses",
       "criticalAlerts" = EXCLUDED."criticalAlerts",
       "timestamp" = CURRENT_TIMESTAMP`,
    [
      period,
      stats.avgScore,
      stats.maxScore,
      stats.minScore,
      stats.totalAnalyses,
      stats.criticalAlerts,
      dateBucket
    ]
  );
}

export async function snapshotFromAnalysis(period: TrendPeriod): Promise<void> {
  const windowDays = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;

  const rows = await query<{
    avg: number;
    max: number;
    min: number;
    total: string;
    critical: string;
  }>(`
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
  await upsertTrendSnapshot(period, {
    avgScore: Number(row?.avg ?? 0),
    maxScore: Number(row?.max ?? 0),
    minScore: Number(row?.min ?? 0),
    totalAnalyses: Number(row?.total ?? 0),
    criticalAlerts: Number(row?.critical ?? 0)
  });
}
