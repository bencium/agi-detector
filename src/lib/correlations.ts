import { execute, query } from '@/lib/db';

export type CorrelationFinding = {
  id: string;
  windowDays: number;
  indicator: string;
  benchmark: string;
  metric: string | null;
  avgDelta: number | null;
  maxDelta: number | null;
  analysisCount: number;
  sourceCount: number;
  sources: string[];
  analysisIds: string[];
  urls: string[];
  updatedAt: Date;
};

let correlationSchemaEnsured = false;

export async function ensureCorrelationSchema(): Promise<void> {
  if (correlationSchemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "CorrelationFinding" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "windowDays" INTEGER NOT NULL,
        indicator TEXT NOT NULL,
        benchmark TEXT NOT NULL,
        metric TEXT,
        "avgDelta" DOUBLE PRECISION,
        "maxDelta" DOUBLE PRECISION,
        "analysisCount" INTEGER NOT NULL,
        "sourceCount" INTEGER NOT NULL,
        sources TEXT[] NOT NULL DEFAULT '{}',
        "analysisIds" TEXT[] NOT NULL DEFAULT '{}',
        urls TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CorrelationFinding_pkey" PRIMARY KEY (id)
      )
    `);
    await execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CorrelationFinding_window_indicator_benchmark_metric_key"
      ON "CorrelationFinding"("windowDays", indicator, benchmark, metric)
    `);
    await execute(`
      CREATE INDEX IF NOT EXISTS "CorrelationFinding_updatedAt_idx"
      ON "CorrelationFinding"("updatedAt")
    `);
    correlationSchemaEnsured = true;
  } catch (error) {
    console.warn('[CorrelationFinding] Failed to ensure schema:', error);
  }
}

export async function refreshCorrelationFindings(windowDays: number, limit = 20): Promise<CorrelationFinding[]> {
  await ensureCorrelationSchema();

  const findings = await query<CorrelationFinding & {
    analysis_count: number;
    source_count: number;
    avg_delta: number | null;
    max_delta: number | null;
    analysis_ids: string[];
    sources: string[];
    urls: string[];
  }>(`
    WITH base AS (
      SELECT
        ar.id as analysis_id,
        cr.url as url,
        COALESCE(cr.metadata->>'source', 'Unknown') as source,
        ar.indicators as indicators,
        ec.benchmark as benchmark,
        ec.metric as metric,
        ec.delta as delta
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      JOIN "EvidenceClaim" ec ON ec."crawlId" = cr.id
      WHERE ec.benchmark IS NOT NULL
        AND ec.delta IS NOT NULL
        AND ar."timestamp" >= NOW() - ($1 || ' days')::interval
    ),
    expanded AS (
      SELECT
        analysis_id,
        url,
        source,
        unnest(indicators) as indicator,
        benchmark,
        metric,
        delta
      FROM base
    )
    SELECT
      indicator,
      benchmark,
      metric,
      COUNT(DISTINCT analysis_id)::int as analysis_count,
      COUNT(DISTINCT source)::int as source_count,
      ARRAY_AGG(DISTINCT source) as sources,
      ARRAY_AGG(DISTINCT analysis_id) as analysis_ids,
      ARRAY_AGG(DISTINCT url) as urls,
      AVG(delta) as avg_delta,
      MAX(delta) as max_delta
    FROM expanded
    GROUP BY indicator, benchmark, metric
    HAVING COUNT(DISTINCT source) >= 2
    ORDER BY source_count DESC, analysis_count DESC, max_delta DESC NULLS LAST
    LIMIT $2
  `, [windowDays, limit]);

  if (findings.length === 0) {
    return [];
  }

  for (const row of findings) {
    await execute(
      `INSERT INTO "CorrelationFinding"
       ("windowDays", indicator, benchmark, metric, "avgDelta", "maxDelta", "analysisCount", "sourceCount", sources, "analysisIds", urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT ("windowDays", indicator, benchmark, metric)
       DO UPDATE SET
         "avgDelta" = EXCLUDED."avgDelta",
         "maxDelta" = EXCLUDED."maxDelta",
         "analysisCount" = EXCLUDED."analysisCount",
         "sourceCount" = EXCLUDED."sourceCount",
         sources = EXCLUDED.sources,
         "analysisIds" = EXCLUDED."analysisIds",
         urls = EXCLUDED.urls,
         "updatedAt" = CURRENT_TIMESTAMP`,
      [
        windowDays,
        row.indicator,
        row.benchmark,
        row.metric,
        row.avg_delta,
        row.max_delta,
        row.analysis_count,
        row.source_count,
        row.sources,
        row.analysis_ids,
        row.urls
      ]
    );
  }

  const stored = await query<CorrelationFinding>(`
    SELECT *
    FROM "CorrelationFinding"
    WHERE "windowDays" = $1
    ORDER BY "sourceCount" DESC, "analysisCount" DESC, "maxDelta" DESC NULLS LAST, "updatedAt" DESC
    LIMIT $2
  `, [windowDays, limit]);

  return stored;
}

export async function getCorrelationFindings(windowDays: number, limit = 20): Promise<CorrelationFinding[]> {
  await ensureCorrelationSchema();
  return query<CorrelationFinding>(`
    SELECT *
    FROM "CorrelationFinding"
    WHERE "windowDays" = $1
    ORDER BY "sourceCount" DESC, "analysisCount" DESC, "maxDelta" DESC NULLS LAST, "updatedAt" DESC
    LIMIT $2
  `, [windowDays, limit]);
}
