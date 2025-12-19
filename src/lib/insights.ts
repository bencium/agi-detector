import { execute, query } from '@/lib/db';
import { openai } from '@/lib/openai';
import { buildEvidence } from '@/lib/evidence';
import { safeJsonParse } from '@/lib/utils/safeJson';

type SourceSnippet = {
  source: string;
  title: string;
  url: string;
  timestamp: string;
  claim?: string | null;
  indicators?: string[] | null;
  severity?: string | null;
  score?: number | null;
  benchmark?: string | null;
  metric?: string | null;
  delta?: number | null;
  value?: number | null;
  unit?: string | null;
  snippets?: string[];
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

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

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

const truncate = (text: string, limit = 220) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
};

const buildItemLine = (item: SourceSnippet, index: number) => {
  const parts: string[] = [];
  parts.push(`source: ${item.source}`);
  parts.push(`title: ${truncate(item.title, 160)}`);
  parts.push(`url: ${item.url}`);
  if (item.claim) {
    parts.push(`claim: ${truncate(item.claim, 220)}`);
  } else if (item.snippets && item.snippets.length > 0) {
    parts.push(`snippet: ${truncate(item.snippets[0] || '', 200)}`);
  }
  if (item.benchmark || item.metric || item.delta != null || item.value != null) {
    const details = [
      item.benchmark ? `benchmark=${item.benchmark}` : null,
      item.metric ? `metric=${item.metric}` : null,
      item.delta != null ? `delta=${item.delta}${item.unit || ''}` : null,
      item.value != null ? `value=${item.value}${item.unit || ''}` : null
    ].filter(Boolean).join(', ');
    if (details) parts.push(details);
  }
  return `${index + 1}. ${parts.join(' | ')}`;
};

async function runInsightPass(items: SourceSnippet[], model: string, temperature: number): Promise<InsightDraft[]> {
  const lines = items.map((item, idx) => buildItemLine(item, idx)).join('\n');
  const prompt = `You are synthesizing cross-source insights about AGI-relevant signals.
Only use the provided items. Do not invent sources, URLs, or evidence.
Each insight must reference at least TWO different sources.
If evidence is weak, return an empty list.
Return JSON ONLY with shape: {"insights": [{"title": string, "summary": string, "confidence": number, "sources": string[], "urls": string[], "evidenceSnippets": string[]}]}

Items:\n${lines}`.trim();

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: 'Return JSON only. No markdown.' },
      { role: 'user', content: prompt }
    ]
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseInsightsResponse(raw);
}

async function mergeInsightPass(candidates: InsightDraft[], limit: number, model: string): Promise<InsightDraft[]> {
  const payload = candidates.slice(0, 20).map((item, idx) => ({
    idx: idx + 1,
    title: item.title,
    summary: item.summary,
    confidence: item.confidence,
    sources: item.sources,
    urls: item.urls,
    evidenceSnippets: item.evidenceSnippets
  }));

  const prompt = `You are consolidating candidate insights. Merge duplicates and return the best ${limit}.
Return JSON ONLY with shape: {"insights": [ ... ]} using the same fields.
Candidates:\n${JSON.stringify(payload, null, 2)}`.trim();

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: 'system', content: 'Return JSON only. No markdown.' },
      { role: 'user', content: prompt }
    ]
  });

  const raw = response.choices[0]?.message?.content || '';
  return parseInsightsResponse(raw);
}

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

  const sampleLimit = clamp(Number(process.env.INSIGHTS_SAMPLE_LIMIT || 80), 30, 300);
  const chunkSize = clamp(Number(process.env.INSIGHTS_CHUNK_SIZE || 30), 15, 80);
  const maxResults = clamp(Number(process.env.INSIGHTS_MAX_RESULTS || limit), 1, 10);
  const temperature = clamp(Number(process.env.INSIGHTS_TEMPERATURE || 0.6), 0, 1);
  const maxChunks = clamp(Number(process.env.INSIGHTS_MAX_CHUNKS || 1), 1, 4);
  const model = process.env.INSIGHTS_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';

  let items: SourceSnippet[] = [];

  try {
    const evidenceRows = await query<{
      source: string | null;
      title: string;
      url: string;
      timestamp: Date;
      indicators: string[] | null;
      severity: string | null;
      score: number | null;
      claim: string | null;
      benchmark: string | null;
      metric: string | null;
      delta: number | null;
      value: number | null;
      unit: string | null;
    }>(`
      SELECT
        COALESCE(cr.metadata->>'source', 'Unknown') as source,
        cr.title,
        cr.url,
        cr.timestamp,
        ar.indicators,
        ar.severity,
        ar.score,
        ec.claim,
        ec.benchmark,
        ec.metric,
        ec.delta,
        ec.value,
        ec.unit
      FROM "EvidenceClaim" ec
      JOIN "CrawlResult" cr ON cr.id = ec."crawlId"
      JOIN "AnalysisResult" ar ON ar."crawlId" = cr.id
      WHERE cr.timestamp >= NOW() - ($1 || ' days')::interval
      ORDER BY random()
      LIMIT $2
    `, [windowDays, sampleLimit]);

    items = evidenceRows.map((row) => ({
      source: row.source || 'Unknown',
      title: row.title,
      url: row.url,
      timestamp: row.timestamp.toISOString(),
      indicators: row.indicators || [],
      severity: row.severity,
      score: row.score,
      claim: row.claim,
      benchmark: row.benchmark,
      metric: row.metric,
      delta: row.delta,
      value: row.value,
      unit: row.unit
    }));
  } catch (error) {
    console.warn('[Insights] Evidence claim query failed, falling back to crawl content:', error);
  }

  if (items.length === 0) {
    const fallbackRows = await query<{
      source: string | null;
      title: string;
      url: string;
      timestamp: Date;
      content: string | null;
      indicators: string[] | null;
      severity: string | null;
      score: number | null;
      metadata: Record<string, unknown> | null;
    }>(`
      SELECT
        COALESCE(cr.metadata->>'source', 'Unknown') as source,
        cr.title,
        cr.url,
        cr.timestamp,
        cr.content,
        cr.metadata,
        ar.indicators,
        ar.severity,
        ar.score
      FROM "CrawlResult" cr
      JOIN "AnalysisResult" ar ON ar."crawlId" = cr.id
      WHERE cr.timestamp >= NOW() - ($1 || ' days')::interval
      ORDER BY cr.timestamp DESC
      LIMIT 200
    `, [windowDays]);

    items = fallbackRows.map((row) => {
      const content = typeof row.content === 'string' ? row.content : '';
      let snippets: string[] = [];
      try {
        snippets = buildEvidence(content).snippets.slice(0, 2);
      } catch (err) {
        snippets = [];
      }
      return {
        source: row.source || 'Unknown',
        title: row.title,
        url: row.url,
        timestamp: row.timestamp.toISOString(),
        indicators: row.indicators || [],
        severity: row.severity,
        score: row.score,
        snippets
      };
    });
  }

  const usable = items.filter((item) => item.claim || (item.snippets && item.snippets.length > 0) || (item.indicators && item.indicators.length > 0));
  const bySource = new Map<string, SourceSnippet[]>();
  for (const item of usable) {
    const key = item.source || 'Unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)?.push(item);
  }
  const cappedPerSource = 2;
  const sourceBalanced = Array.from(bySource.values()).flatMap(list => list.slice(0, cappedPerSource));

  if (sourceBalanced.length === 0) {
    return [];
  }

  const shuffled = shuffle(sourceBalanced);
  const chunks = chunkArray(shuffled, chunkSize).slice(0, maxChunks);
  const candidates: InsightDraft[] = [];

  for (const chunk of chunks) {
    try {
      const chunkInsights = await runInsightPass(chunk, model, temperature);
      candidates.push(...chunkInsights);
      if (candidates.length >= maxResults) {
        break;
      }
    } catch (error) {
      console.warn('[Insights] Chunk insight pass failed:', error);
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const deduped: InsightDraft[] = [];
  const seenTitles = new Set<string>();
  for (const insight of candidates) {
    const key = insight.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduped.push(insight);
  }

  let finalInsights = deduped;
  if (deduped.length > maxResults) {
    try {
      const merged = await mergeInsightPass(deduped, maxResults, model);
      if (merged.length > 0) {
        finalInsights = merged;
      }
    } catch (error) {
      console.warn('[Insights] Merge pass failed, using deduped list:', error);
    }
  }

  const toStore = finalInsights.slice(0, maxResults);

  for (const item of toStore) {
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
