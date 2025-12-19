import { execute, query } from '@/lib/db';
import { openai } from '@/lib/openai';
import { safeJsonParse } from '@/lib/utils/safeJson';

type AggregateRow = {
  indicator: string;
  source: string;
  cnt_30: number;
  cnt_90: number;
  cnt_180: number;
  example_title: string | null;
  example_url: string | null;
};

type IndicatorTotalRow = {
  indicator: string;
  cnt_30: number;
  cnt_90: number;
  cnt_180: number;
};

type InsightDraft = {
  title: string;
  summary: string;
  confidence: number;
  sources: string[];
  urls: string[];
  evidenceSnippets: string[];
};

export type InsightFinding = {
  id: string;
  windowDays: number;
  title: string;
  summary: string;
  confidence: number;
  sources: string[];
  urls: string[];
  evidenceSnippets: string[];
  createdAt: Date;
  updatedAt: Date;
};

let insightSchemaEnsured = false;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const stripJson = (raw: string): string => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf('{');
  const firstBracket = raw.indexOf('[');
  const start = firstBrace === -1
    ? firstBracket
    : firstBracket === -1
      ? firstBrace
      : Math.min(firstBrace, firstBracket);
  if (start === -1) return raw.trim();
  const lastBrace = raw.lastIndexOf('}');
  const lastBracket = raw.lastIndexOf(']');
  const end = lastBrace === -1
    ? lastBracket
    : lastBracket === -1
      ? lastBrace
      : Math.max(lastBrace, lastBracket);
  if (end <= start) return raw.trim();
  return raw.slice(start, end + 1).trim();
};

const normalizeInsight = (item: any): InsightDraft | null => {
  if (!item || typeof item !== 'object') return null;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
  if (!title || !summary) return null;

  const sources = Array.isArray(item.sources) ? item.sources.filter((s: any) => typeof s === 'string') : [];
  const urls = Array.isArray(item.urls) ? item.urls.filter((u: any) => typeof u === 'string') : [];
  const evidenceSnippets = Array.isArray(item.evidenceSnippets)
    ? item.evidenceSnippets.filter((s: any) => typeof s === 'string')
    : [];

  const confidence = Number(item.confidence);
  return {
    title,
    summary,
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5,
    sources,
    urls,
    evidenceSnippets
  };
};

const parseInsightsResponse = (raw: string): InsightDraft[] => {
  const cleaned = stripJson(raw);
  const parsed = safeJsonParse<any>(cleaned, { insights: [] });
  const insights = Array.isArray(parsed) ? parsed : parsed?.insights;
  if (!Array.isArray(insights)) return [];
  return insights.map(normalizeInsight).filter((item): item is InsightDraft => Boolean(item));
};

export async function ensureInsightSchema(): Promise<void> {
  if (insightSchemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "InsightFinding" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "windowDays" INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        sources TEXT[] NOT NULL DEFAULT '{}',
        urls TEXT[] NOT NULL DEFAULT '{}',
        "evidenceSnippets" TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InsightFinding_pkey" PRIMARY KEY (id)
      )
    `);
    await execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "InsightFinding_window_title_key"
      ON "InsightFinding"("windowDays", title)
    `);
    await execute(`
      CREATE INDEX IF NOT EXISTS "InsightFinding_updatedAt_idx"
      ON "InsightFinding"("updatedAt")
    `);
    insightSchemaEnsured = true;
  } catch (error) {
    console.warn('[InsightFinding] Failed to ensure schema:', error);
  }
}

export async function refreshInsights(windowDays: number, limit = 5): Promise<InsightFinding[]> {
  await ensureInsightSchema();

  const maxWindow = Math.max(windowDays, 180);
  const aggLimit = clamp(Number(process.env.INSIGHTS_AGG_LIMIT || 80), 30, 200);
  const model = process.env.INSIGHTS_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
  const temperature = clamp(Number(process.env.INSIGHTS_TEMPERATURE || 0.5), 0, 1);

  const aggregates = await query<AggregateRow>(`
    SELECT
      LOWER(indicator) AS indicator,
      COALESCE(cr.metadata->>'source', 'Unknown') AS source,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '30 days')::int AS cnt_30,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '90 days')::int AS cnt_90,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '180 days')::int AS cnt_180,
      (array_agg(cr.title ORDER BY ar.timestamp DESC))[1] AS example_title,
      (array_agg(cr.url ORDER BY ar.timestamp DESC))[1] AS example_url
    FROM "AnalysisResult" ar
    JOIN "CrawlResult" cr ON cr.id = ar."crawlId"
    CROSS JOIN LATERAL unnest(ar.indicators) AS indicator
    WHERE ar.timestamp >= NOW() - ($1 || ' days')::interval
    GROUP BY indicator, source
    ORDER BY cnt_30 DESC NULLS LAST, cnt_90 DESC, cnt_180 DESC
    LIMIT $2
  `, [maxWindow, aggLimit]);

  if (!aggregates || aggregates.length === 0) {
    return [];
  }

  const indicatorTotals = await query<IndicatorTotalRow>(`
    SELECT
      LOWER(indicator) AS indicator,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '30 days')::int AS cnt_30,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '90 days')::int AS cnt_90,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '180 days')::int AS cnt_180
    FROM "AnalysisResult" ar
    CROSS JOIN LATERAL unnest(ar.indicators) AS indicator
    WHERE ar.timestamp >= NOW() - ($1 || ' days')::interval
    GROUP BY indicator
    ORDER BY cnt_30 DESC NULLS LAST, cnt_90 DESC, cnt_180 DESC
    LIMIT 30
  `, [maxWindow]);

  const analysisCounts = await query<{ cnt_30: number; cnt_90: number; cnt_180: number }>(`
    SELECT
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '30 days')::int AS cnt_30,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '90 days')::int AS cnt_90,
      COUNT(*) FILTER (WHERE ar.timestamp >= NOW() - INTERVAL '180 days')::int AS cnt_180
    FROM "AnalysisResult" ar
    WHERE ar.timestamp >= NOW() - ($1 || ' days')::interval
  `, [maxWindow]);

  const totals = analysisCounts[0] || { cnt_30: 0, cnt_90: 0, cnt_180: 0 };

  const aggregateLines = aggregates.map((row, idx) => {
    return `${idx + 1}. indicator=${row.indicator} | source=${row.source} | 30d=${row.cnt_30} | 90d=${row.cnt_90} | 180d=${row.cnt_180} | example="${row.example_title || 'n/a'}" | url=${row.example_url || 'n/a'}`;
  }).join('\n');

  const totalsLines = indicatorTotals.map((row, idx) => {
    return `${idx + 1}. ${row.indicator} | 30d=${row.cnt_30} | 90d=${row.cnt_90} | 180d=${row.cnt_180}`;
  }).join('\n');

  const prompt = `You are given deterministic aggregate counts of AGI indicators by source. Use these summaries to infer cross-source correlations and trends. Only use the data provided below. Do not invent sources or URLs. Each insight must reference at least TWO different sources and include representative URLs.
If the data is sparse or dominated by one source, return an empty list.
Return JSON ONLY with shape: {"insights": [{"title": string, "summary": string, "confidence": number, "sources": string[], "urls": string[], "evidenceSnippets": string[]}]}.

Analysis counts:
- 30d total analyses: ${totals.cnt_30}
- 90d total analyses: ${totals.cnt_90}
- 180d total analyses: ${totals.cnt_180}

Top indicators overall:
${totalsLines}

Indicator by source (with representative example):
${aggregateLines}`.trim();

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: 'Return JSON only. No markdown.' },
      { role: 'user', content: prompt }
    ]
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseInsightsResponse(raw);

  if (!parsed || parsed.length === 0) {
    return [];
  }

  for (const item of parsed.slice(0, limit)) {
    await execute(
      `INSERT INTO "InsightFinding"
       ("windowDays", title, summary, confidence, sources, urls, "evidenceSnippets")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("windowDays", title)
       DO UPDATE SET
         summary = EXCLUDED.summary,
         confidence = EXCLUDED.confidence,
         sources = EXCLUDED.sources,
         urls = EXCLUDED.urls,
         "evidenceSnippets" = EXCLUDED."evidenceSnippets",
         "updatedAt" = CURRENT_TIMESTAMP`,
      [
        windowDays,
        item.title,
        item.summary,
        item.confidence,
        item.sources || [],
        item.urls || [],
        item.evidenceSnippets || []
      ]
    );
  }

  return query<InsightFinding>(`
    SELECT *
    FROM "InsightFinding"
    WHERE "windowDays" = $1
    ORDER BY "updatedAt" DESC
    LIMIT $2
  `, [windowDays, limit]);
}

export async function getInsights(windowDays: number, limit = 5): Promise<InsightFinding[]> {
  await ensureInsightSchema();
  return query<InsightFinding>(`
    SELECT *
    FROM "InsightFinding"
    WHERE "windowDays" = $1
    ORDER BY "updatedAt" DESC
    LIMIT $2
  `, [windowDays, limit]);
}
