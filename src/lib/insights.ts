import { execute, query } from '@/lib/db';
import { openai } from '@/lib/openai';
import { buildEvidence } from '@/lib/evidence';

type SourceSnippet = {
  source: string;
  title: string;
  url: string;
  timestamp: string;
  snippets: string[];
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

  const rows = await query<{
    id: string;
    title: string;
    url: string;
    timestamp: Date;
    metadata: Record<string, unknown> | null;
    content: string;
  }>(`
    SELECT id, title, url, timestamp, metadata, content
    FROM "CrawlResult"
    WHERE timestamp >= NOW() - ($1 || ' days')::interval
    ORDER BY timestamp DESC
    LIMIT 200
  `, [windowDays]);

  if (rows.length === 0) {
    return [];
  }

  const bySource = new Map<string, SourceSnippet[]>();
  for (const row of rows) {
    const metadata = row.metadata as Record<string, any> | null;
    const source = (metadata?.source as string) || 'Unknown';
    const content = row.content || '';
    const snippets = Array.isArray(metadata?.evidence?.snippets)
      ? (metadata?.evidence?.snippets as string[]).slice(0, 3)
      : buildEvidence(content).snippets.slice(0, 3);
    if (snippets.length === 0 && !content.trim()) {
      continue;
    }
    const entry: SourceSnippet = {
      source,
      title: row.title,
      url: row.url,
      timestamp: row.timestamp.toISOString(),
      snippets
    };
    if (!bySource.has(source)) {
      bySource.set(source, []);
    }
    if ((bySource.get(source) || []).length < 3) {
      bySource.get(source)?.push(entry);
    }
  }

  const maxPerSource = 2;
  const maxSources = 30;
  const sourcesPayload = Array.from(bySource.entries())
    .flatMap(([_, entries]) => entries.slice(0, maxPerSource))
    .slice(0, maxSources);
  if (sourcesPayload.length === 0) {
    return [];
  }

  const model = process.env.INSIGHTS_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
  const prompt = `
You are given excerpts from multiple sources. Identify at least 2 cross-source correlations or themes.
Only use the provided sources. Do not invent facts or sources.
Return strict JSON array with items:
{
  "title": string,
  "summary": string,
  "confidence": number (0-1),
  "sources": string[],
  "urls": string[],
  "evidenceSnippets": string[]
}

Sources:
${sourcesPayload.map((s, idx) => `
${idx + 1}. [${s.source}] ${s.title}
URL: ${s.url}
Time: ${s.timestamp}
Snippets:
${s.snippets.map((snip) => `- ${snip.slice(0, 240)}`).join('\n')}
`).join('\n')}
`.trim();

  let raw = '[]';
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You extract correlations across sources and return JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });
    raw = response.choices[0]?.message?.content || '[]';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
    throw new Error(`OpenAI insights failed: ${message}`);
  }

  let parsed: Array<{
    title: string;
    summary: string;
    confidence: number;
    sources: string[];
    urls: string[];
    evidenceSnippets: string[];
  }> = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[Insights] Failed to parse LLM JSON, returning empty list.');
    parsed = [];
  }

  if (parsed.length === 0) {
    throw new Error('LLM returned no insights');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
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
        Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
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
