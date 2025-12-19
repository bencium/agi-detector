import { execute, query, queryOne } from '@/lib/db';
import { openai } from '@/lib/openai';
import { safeJsonParse } from '@/lib/utils/safeJson';

export type SemanticCorrelation = {
  id: string;
  windowDays: number;
  title: string;
  summary: string;
  correlationType: string;
  confidence: number;
  articleIds: string[];
  sources: string[];
  urls: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ArticleRow = {
  id: string;
  url: string;
  title: string;
  content: string;
  source: string;
  score: number;
  indicators: string[];
};

type CorrelationDraft = {
  title: string;
  summary: string;
  articles: number[];
  confidence: number;
  type: string;
};

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "SemanticCorrelation" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "windowDays" INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        "correlationType" TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        "articleIds" TEXT[] NOT NULL DEFAULT '{}',
        sources TEXT[] NOT NULL DEFAULT '{}',
        urls TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SemanticCorrelation_pkey" PRIMARY KEY (id)
      )
    `);
    await execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "SemanticCorrelation_window_title_key"
      ON "SemanticCorrelation"("windowDays", title)
    `);
    schemaEnsured = true;
  } catch (error) {
    console.warn('[SemanticCorrelation] Schema error:', error);
  }
}

const stripJson = (raw: string): string => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
};

export async function findSemanticCorrelations(
  windowDays: number,
  limit = 10
): Promise<SemanticCorrelation[]> {
  await ensureSchema();

  // Fetch top 20 interesting articles with CONTENT
  const articles = await query<ArticleRow>(`
    SELECT
      cr.id,
      cr.url,
      cr.title,
      LEFT(cr.content, 200) as content,
      COALESCE(cr.metadata->>'source', 'Unknown') as source,
      ar.score,
      ar.indicators
    FROM "AnalysisResult" ar
    JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
    WHERE ar.timestamp >= NOW() - ($1 || ' days')::interval
      AND ar.score >= 0.25
    ORDER BY ar.score DESC, ar.timestamp DESC
    LIMIT 20
  `, [windowDays]);

  if (articles.length < 2) {
    console.log('[SemanticCorrelation] Not enough articles:', articles.length);
    return [];
  }

  // Build compact article summaries (~1.5k tokens total)
  const articleLines = articles.map((a, i) =>
    `[${i + 1}] ${a.source} | ${a.title} | score=${a.score.toFixed(2)} | ${a.indicators.slice(0, 3).join(', ')} | ${a.content.replace(/\s+/g, ' ').trim()}`
  ).join('\n');

  const prompt = `Analyze these ${articles.length} AI/AGI articles. Find INTERESTING correlations - not obvious patterns.

Look for:
- Same breakthrough reported by multiple sources
- Timing patterns (coordinated announcements)
- Thematic clusters (same research direction)
- Contradicting narratives
- Capability signals

Articles:
${articleLines}

Return JSON only:
{"correlations":[{"title":"short title","summary":"why interesting","articles":[1,3],"confidence":0.8,"type":"thematic_cluster"}]}

Types: coordinated_announcement, thematic_cluster, contradicting_narratives, timing_pattern, capability_signal

Return 2-5 correlations max. Quality over quantity. Empty array if nothing interesting.`;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  let parsed: CorrelationDraft[] = [];
  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: 'system', content: 'You are an AGI research analyst. Find non-obvious correlations. JSON only.' },
        { role: 'user', content: prompt }
      ]
    });

    const raw = response.choices[0]?.message?.content || '';
    const cleaned = stripJson(raw);
    const data = safeJsonParse<{ correlations: CorrelationDraft[] }>(cleaned, { correlations: [] });
    parsed = Array.isArray(data?.correlations) ? data.correlations : [];
  } catch (error) {
    console.error('[SemanticCorrelation] LLM error:', error);
    return [];
  }

  if (parsed.length === 0) {
    console.log('[SemanticCorrelation] LLM returned no correlations');
    return [];
  }

  // Store correlations
  for (const corr of parsed.slice(0, limit)) {
    const involvedArticles = (corr.articles || [])
      .filter(n => n >= 1 && n <= articles.length)
      .map(n => articles[n - 1]);

    if (involvedArticles.length < 2) continue;

    const articleIds = involvedArticles.map(a => a.id);
    const sources = [...new Set(involvedArticles.map(a => a.source))];
    const urls = involvedArticles.map(a => a.url);

    await execute(`
      INSERT INTO "SemanticCorrelation"
      ("windowDays", title, summary, "correlationType", confidence, "articleIds", sources, urls)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("windowDays", title)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        "correlationType" = EXCLUDED."correlationType",
        confidence = EXCLUDED.confidence,
        "articleIds" = EXCLUDED."articleIds",
        sources = EXCLUDED.sources,
        urls = EXCLUDED.urls,
        "updatedAt" = CURRENT_TIMESTAMP
    `, [
      windowDays,
      corr.title || 'Unnamed correlation',
      corr.summary || '',
      corr.type || 'unknown',
      corr.confidence || 0.5,
      articleIds,
      sources,
      urls
    ]);
  }

  return getSemanticCorrelations(windowDays, limit);
}

export async function getSemanticCorrelations(
  windowDays: number,
  limit = 10
): Promise<SemanticCorrelation[]> {
  await ensureSchema();
  return query<SemanticCorrelation>(`
    SELECT *
    FROM "SemanticCorrelation"
    WHERE "windowDays" = $1
    ORDER BY confidence DESC, "updatedAt" DESC
    LIMIT $2
  `, [windowDays, limit]);
}

export async function hasRecentCorrelations(windowDays: number, maxAgeMinutes = 60): Promise<boolean> {
  await ensureSchema();
  const result = await queryOne<{ count: string }>(`
    SELECT COUNT(*)::text as count
    FROM "SemanticCorrelation"
    WHERE "windowDays" = $1
      AND "updatedAt" >= NOW() - ($2 || ' minutes')::interval
  `, [windowDays, maxAgeMinutes]);
  return Number(result?.count || 0) > 0;
}
