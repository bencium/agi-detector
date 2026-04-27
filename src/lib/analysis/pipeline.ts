/**
 * Shared analysis pipeline module.
 *
 * Extracts the duplicated logic between the single-article API route
 * (`/api/analyze`) and the batch worker (`analyzeAllWorker`).
 */
import { query, insert } from '@/lib/db';
import { openai, AGI_DETECTION_PROMPT, generateEmbedding } from '@/lib/openai';
import { computeSeverity, enforceCriticalEvidenceGate } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';
import {
  analyzeForSecrecyIndicators,
  analyzeResearcherDepartures,
  SecrecyIndicator
} from '@/lib/detection/silence-patterns';
import { upsertTrendSnapshot } from '@/lib/trends';
import { computeCombinedScore, computeHeuristicScore, hasBenchmarkDelta } from '@/lib/scoring/multiSignal';
import { ensureAnalysisScoreSchema } from '@/lib/scoring/schema';
import { runLayer0Triage } from '@/lib/analysis/triage';
import { shouldTranslateCjk, translateToEnglish } from '@/lib/analysis/translation';
import { EvidenceSnippet, extractEvidenceClaims } from '@/lib/evidence/extract';
import { ensureEvidenceClaimsForCrawl } from '@/lib/evidence/storage';
import { assessSignal, type Corroboration, type SourceStatus } from '@/lib/methodology/signals';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface PipelineCrawlResult {
  id: string;
  url?: string;
  title: string;
  content: string;
  metadata: {
    source?: string;
    timestamp?: string;
    canonicalUrl?: string;
    evidence?: {
      snippets?: string[];
      claims?: Array<{
        claim: string;
        evidence: string;
        tags: string[];
        numbers: number[];
        benchmark?: string;
        metric?: string;
        value?: number;
        delta?: number;
        unit?: string;
      }>;
    };
  } | null;
}

export interface PipelineResult {
  id: string;
  crawlId: string;
  score: number;
  confidence: number;
  indicators: string[];
  severity: string;
  explanation: string;
  timestamp?: Date;
  skipped?: boolean;
}

export interface PipelineOptions {
  /** Run secrecy detection and boost scoring (default: false) */
  enableSecrecyDetection?: boolean;
  /** Logging array for batch worker observability */
  logs?: string[];
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

export const OPENAI_MAX_RETRIES = Math.max(
  0,
  parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10)
);
export const OPENAI_RETRY_BASE_MS = Math.max(
  250,
  parseInt(process.env.OPENAI_RETRY_BASE_MS || '1500', 10)
);

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isRateLimitError = (err: unknown): boolean => {
  const error = err as { status?: number; code?: string; message?: string };
  if (error?.status === 429) return true;
  if (error?.code && /rate_limit/i.test(error.code)) return true;
  if (error?.message && /rate limit|429/i.test(error.message)) return true;
  return false;
};

// ---------------------------------------------------------------------------
// insertHistoricalMetrics - single multi-row INSERT
// ---------------------------------------------------------------------------

export async function insertHistoricalMetrics(
  analysisId: string,
  metrics: {
    score: number;
    modelScore: number;
    heuristicScore: number;
    confidence: number;
    indicatorCount: number;
  }
): Promise<void> {
  await insert(
    `INSERT INTO "HistoricalData" (id, "analysisId", metric, value)
     VALUES
       (gen_random_uuid(), $1, 'score', $2),
       (gen_random_uuid(), $1, 'model_score', $3),
       (gen_random_uuid(), $1, 'heuristic_score', $4),
       (gen_random_uuid(), $1, 'confidence', $5),
       (gen_random_uuid(), $1, 'indicator_count', $6)`,
    [
      analysisId,
      metrics.score,
      metrics.modelScore,
      metrics.heuristicScore,
      metrics.confidence,
      metrics.indicatorCount,
    ]
  );
}

// ---------------------------------------------------------------------------
// updateTrendSnapshots - daily + weekly
// ---------------------------------------------------------------------------

export async function updateTrendSnapshots(): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Daily trends
  const dailyAnalyses = await query<{ score: number; severity: string | null }>(
    `SELECT score, severity FROM "AnalysisResult" WHERE timestamp >= $1`,
    [dayAgo]
  );

  if (dailyAnalyses.length > 0) {
    const scores = dailyAnalyses.map(a => a.score);
    await upsertTrendSnapshot('daily', {
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      totalAnalyses: dailyAnalyses.length,
      criticalAlerts: dailyAnalyses.filter(a => a.severity === 'critical').length,
    });
  }

  // Weekly trends
  const weeklyAnalyses = await query<{ score: number; severity: string | null }>(
    `SELECT score, severity FROM "AnalysisResult" WHERE timestamp >= $1`,
    [weekAgo]
  );

  if (weeklyAnalyses.length > 0) {
    const scores = weeklyAnalyses.map(a => a.score);
    await upsertTrendSnapshot('weekly', {
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      totalAnalyses: weeklyAnalyses.length,
      criticalAlerts: weeklyAnalyses.filter(a => a.severity === 'critical').length,
    });
  }
}

// ---------------------------------------------------------------------------
// analyzeArticle - core pipeline
// ---------------------------------------------------------------------------

export async function analyzeArticle(
  crawlResult: PipelineCrawlResult,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { enableSecrecyDetection = false, logs = [] } = options;
  const metadata = crawlResult.metadata;
  const sourceName = metadata?.source || 'Unknown';
  const timestamp = metadata?.timestamp || new Date().toISOString();
  const evidenceSnippets = metadata?.evidence?.snippets || [];

  // ------------------------------------------------------------------
  // 1. Layer-0 triage
  // ------------------------------------------------------------------
  const triage = runLayer0Triage({
    title: crawlResult.title,
    content: crawlResult.content,
    source: sourceName,
  });

  if (triage.skip) {
    return handleFilteredArticle(crawlResult, triage.reason);
  }

  logs.push(`[Pipeline] Analyzing: ${crawlResult.title}`);

  // ------------------------------------------------------------------
  // 2. CJK translation
  // ------------------------------------------------------------------
  const translationEnabled = process.env.CHINESE_TRANSLATION_ENABLED !== 'false';
  let translatedSnippets: string[] = [];
  let translatedTitle = '';

  if (translationEnabled && shouldTranslateCjk(`${crawlResult.title} ${crawlResult.content}`)) {
    try {
      const translation = await translateToEnglish({
        title: crawlResult.title,
        snippets: evidenceSnippets.slice(0, 6),
      });
      translatedTitle = translation.translatedTitle || '';
      translatedSnippets = translation.translatedSnippets || [];
    } catch (err) {
      console.warn('[Pipeline] Translation failed:', err);
    }
  }

  // ------------------------------------------------------------------
  // 3. OpenAI analysis call with retry
  // ------------------------------------------------------------------
  // COST: ~$0.50-2.00/day at 50 analyses/day
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const openaiOptions = {
    model,
    max_tokens: 500,
    messages: [
      { role: 'system' as const, content: AGI_DETECTION_PROMPT },
      {
        role: 'user' as const,
        content: buildUserPrompt(crawlResult, evidenceSnippets, translatedTitle, translatedSnippets),
      },
    ],
    response_format: { type: 'json_object' as const },
  };

  let completion;
  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt += 1) {
    try {
      completion = await openai.chat.completions.create(openaiOptions);
      break;
    } catch (err) {
      if (!isRateLimitError(err) || attempt === OPENAI_MAX_RETRIES) {
        throw err;
      }
      const backoff =
        OPENAI_RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      const msg = `[Pipeline] Rate limited (429). Retry ${attempt + 1}/${OPENAI_MAX_RETRIES} in ${backoff}ms`;
      console.warn(msg);
      logs.push(msg);
      await sleep(backoff);
    }
  }

  // ------------------------------------------------------------------
  // 4. Parse response
  // ------------------------------------------------------------------
  const content = completion?.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No analysis result received from OpenAI');
  }

  const analysisResult = parseOpenAIResponse(content);
  const modelScore = analysisResult.score || 0;
  const crossReferences: string[] = analysisResult.cross_references || [];

  // ------------------------------------------------------------------
  // 5. Evidence claims
  // ------------------------------------------------------------------
  const claims = await ensureEvidenceClaimsForCrawl({
    crawlId: crawlResult.id,
    content: crawlResult.content,
    metadata: (metadata as Record<string, unknown> | null) || null,
    url: crawlResult.url,
    canonicalUrl: (metadata as Record<string, unknown> | null)?.canonicalUrl as string | undefined,
  });

  let translatedClaims: ReturnType<typeof extractEvidenceClaims> = [];
  if (translatedSnippets.length > 0) {
    const snippetObjects: EvidenceSnippet[] = translatedSnippets.map(text => ({
      text,
      score: 1,
      tags: [],
    }));
    translatedClaims = extractEvidenceClaims(snippetObjects);
  }
  const mergedClaims = [...claims, ...translatedClaims];

  // ------------------------------------------------------------------
  // 6. Heuristic score
  // ------------------------------------------------------------------
  const heuristic = computeHeuristicScore({
    claims: mergedClaims,
    snippetsCount: metadata?.evidence?.snippets?.length || 0,
  });

  // ------------------------------------------------------------------
  // 7. Secrecy detection (opt-in)
  // ------------------------------------------------------------------
  let secrecyBoost = 0;
  let allSecrecyIndicators: SecrecyIndicator[] = [];
  let combinedIndicators = analysisResult.indicators || [];

  if (enableSecrecyDetection) {
    const secrecyIndicators = analyzeForSecrecyIndicators(
      crawlResult.content,
      sourceName,
      timestamp
    );
    const departureIndicators = analyzeResearcherDepartures(crawlResult.content, sourceName);
    allSecrecyIndicators = [...secrecyIndicators, ...departureIndicators];

    combinedIndicators = [
      ...combinedIndicators,
      ...allSecrecyIndicators.map((si: SecrecyIndicator) => `[SECRECY] ${si.description}`),
    ];

    const criticalSecrecy = allSecrecyIndicators.filter(si => si.severity === 'critical').length;
    const highSecrecy = allSecrecyIndicators.filter(si => si.severity === 'high').length;

    if (criticalSecrecy > 0) {
      secrecyBoost = 0.2;
    } else if (highSecrecy > 0) {
      secrecyBoost = 0.1;
    }
  }

  // ------------------------------------------------------------------
  // 8. Corroboration check + combined score
  // ------------------------------------------------------------------
  let corroborationPenalty = 0;
  if (crossReferences.length > 0) {
    try {
      const normalizedRefs = crossReferences.map(r => r.toLowerCase());
      const refMatches = await query<{ count: number }>(
        `SELECT COUNT(*)::int as count
         FROM "CrawlResult"
         WHERE LOWER(metadata->>'source') = ANY($1)`,
        [normalizedRefs]
      );
      if (!refMatches[0]?.count) {
        corroborationPenalty = 0.15;
      }
    } catch (err) {
      console.warn('[Pipeline] Corroboration check failed:', err);
    }
  }

  const signals = [...heuristic.signals];
  if (secrecyBoost > 0) {
    signals.push({
      name: 'secrecy',
      value: secrecyBoost,
      detail: allSecrecyIndicators.some(si => si.severity === 'critical') ? 'critical' : 'high',
    });
  }
  if (corroborationPenalty > 0) {
    signals.push({
      name: 'corroboration_penalty',
      value: -corroborationPenalty,
      detail: 'no corroboration',
    });
  }

  const combined = computeCombinedScore({
    modelScore,
    heuristicScore: heuristic.score,
    secrecyBoost,
    corroborationPenalty,
    signals,
  });

  const sourceStatus = ((metadata as Record<string, unknown> | null)?.sourceStatus as SourceStatus | undefined) || 'live';
  const corroboration: Corroboration =
    crossReferences.length > 0 && corroborationPenalty === 0
      ? 'same_source'
      : 'none';
  const signalAssessment = assessSignal({
    claims: mergedClaims,
    content: crawlResult.content,
    sourceStatus,
    corroboration,
    modelScore,
    heuristicScore: heuristic.score,
    secrecyBoost,
    sourceName,
  });

  // ------------------------------------------------------------------
  // 9. Severity with evidence gate
  // ------------------------------------------------------------------
  const hasDelta = hasBenchmarkDelta(mergedClaims);
  let severity = computeSeverity(combined.combinedScore, analysisResult.severity);
  severity = enforceCriticalEvidenceGate(severity, hasDelta);

  // ------------------------------------------------------------------
  // 10. Embedding
  // ------------------------------------------------------------------
  let embeddingValue: string | null = null;
  try {
    const text = `${crawlResult.title}\n\n${crawlResult.content}`.slice(0, 8000);
    const embedding = await generateEmbedding(text);
    embeddingValue = `[${embedding.join(',')}]`;
  } catch (err) {
    console.warn('[Pipeline] Embedding generation failed:', err);
  }

  // ------------------------------------------------------------------
  // 11. Insert AnalysisResult
  // ------------------------------------------------------------------
  const criticalSecrecy = allSecrecyIndicators.filter(si => si.severity === 'critical').length;

  await ensureAnalysisScoreSchema();
  const analysis = await insert<PipelineResult>(
    `INSERT INTO "AnalysisResult"
     (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding, "modelScore", "heuristicScore", "scoreBreakdown")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13::jsonb)
     RETURNING id, "crawlId", score, confidence, indicators, severity, explanation, timestamp`,
    [
      crawlResult.id,
      combined.combinedScore,
      analysisResult.confidence || 0,
      combinedIndicators,
      severity,
      analysisResult.evidence_quality || 'speculative',
      analysisResult.requires_verification || criticalSecrecy > 0,
      crossReferences,
      analysisResult.explanation || 'No analysis available',
      embeddingValue,
      modelScore,
      heuristic.score,
      JSON.stringify({
        ...combined.breakdown,
        signalAssessment,
      }),
    ]
  );

  if (!analysis) {
    throw new Error('Failed to save analysis result');
  }

  // ------------------------------------------------------------------
  // 12. Secrecy patterns (if detected)
  // ------------------------------------------------------------------
  if (allSecrecyIndicators.length > 0) {
    for (const indicator of allSecrecyIndicators) {
      await insert(
        `INSERT INTO "SecrecyPattern" (source, "patternType", confidence, evidence, "riskLevel", metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sourceName,
          indicator.type,
          indicator.confidence,
          indicator.evidence.join('; '),
          indicator.severity,
          JSON.stringify({ description: indicator.description }),
        ]
      );
    }
  }

  // ------------------------------------------------------------------
  // 13. Historical metrics (batched)
  // ------------------------------------------------------------------
  await insertHistoricalMetrics(analysis.id, {
    score: combined.combinedScore,
    modelScore,
    heuristicScore: heuristic.score,
    confidence: analysisResult.confidence || 0,
    indicatorCount: (combinedIndicators).length,
  });

  return {
    ...analysis,
    explanation: analysisResult.explanation || analysis.explanation,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function handleFilteredArticle(
  crawlResult: PipelineCrawlResult,
  reason: string | undefined
): Promise<PipelineResult> {
  const filteredScore = 0.05;
  const filteredConfidence = 0.9;
  const filteredExplanation = `Layer-0 noise filter: ${reason || 'No capability signals detected'}`;
  const filteredBreakdown = {
    modelScore: 0,
    heuristicScore: 0,
    secrecyBoost: 0,
    corroborationPenalty: 0,
    combinedScore: filteredScore,
    weights: {
      model: parseFloat(process.env.MODEL_SCORE_WEIGHT || '0.85'),
      heuristic: parseFloat(process.env.HEURISTIC_SCORE_WEIGHT || '0.15'),
    },
    signals: [],
    filtered: true,
    filterReason: reason || 'noise',
  };

  await ensureAnalysisScoreSchema();
  const filteredAnalysis = await insert<PipelineResult>(
    `INSERT INTO "AnalysisResult"
     (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding, "modelScore", "heuristicScore", "scoreBreakdown")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13::jsonb)
     RETURNING id, "crawlId", score, confidence, indicators, severity, explanation, timestamp`,
    [
      crawlResult.id,
      filteredScore,
      filteredConfidence,
      [],
      'low',
      'filtered',
      false,
      [],
      filteredExplanation,
      null,
      0,
      0,
      JSON.stringify(filteredBreakdown),
    ]
  );

  if (!filteredAnalysis) {
    throw new Error('Failed to save filtered analysis');
  }

  await insertHistoricalMetrics(filteredAnalysis.id, {
    score: filteredScore,
    modelScore: 0,
    heuristicScore: 0,
    confidence: filteredConfidence,
    indicatorCount: 0,
  });

  return {
    ...filteredAnalysis,
    explanation: filteredExplanation,
    skipped: true,
  };
}

function buildUserPrompt(
  crawlResult: PipelineCrawlResult,
  evidenceSnippets: string[],
  translatedTitle: string,
  translatedSnippets: string[]
): string {
  let prompt = `Title: ${crawlResult.title}\n`;
  if (translatedTitle) {
    prompt += `Translated Title: ${translatedTitle}\n`;
  }
  prompt += `\nEvidence Snippets:\n${evidenceSnippets.map(s => `- ${s}`).join('\n')}\n`;
  if (translatedSnippets.length > 0) {
    prompt += `\nTranslated Evidence:\n${translatedSnippets.map(s => `- ${s}`).join('\n')}\n`;
  }
  prompt += `\nContent: ${crawlResult.content}`;
  return prompt;
}
