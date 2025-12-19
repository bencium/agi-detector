import { NextResponse } from 'next/server';
import { query, queryOne, execute, isDbEnabled } from '@/lib/db';
import { openai } from '@/lib/openai';
import { crawlSource, SOURCES } from '@/lib/crawler';
import { applyValidationOverride, enforceCriticalEvidenceGate, severityForScore } from '@/lib/severity';
import { safeJsonParse } from '@/lib/utils/safeJson';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { computeCombinedScore, computeHeuristicScore, hasBenchmarkDelta } from '@/lib/scoring/multiSignal';
import { ensureAnalysisScoreSchema } from '@/lib/scoring/schema';
import {
  analyzeForSecrecyIndicators,
  analyzeResearcherDepartures,
  SecrecyIndicator
} from '@/lib/detection/silence-patterns';
import { shouldTranslateCjk, translateToEnglish } from '@/lib/analysis/translation';
import { EvidenceSnippet, extractEvidenceClaims } from '@/lib/evidence/extract';

const validateRequestSchema = z.object({
  analysisId: z.string().uuid('Invalid analysis ID format')
});

const VALIDATION_PROMPT = `You are a second-opinion AI safety expert validating a previous AGI detection analysis. Your role is to ensure NO AGI progress is missed or downplayed.

Previous analysis found:
Score: {score}
Indicators: {indicators}
Severity: {severity}

Review the content and provide an independent assessment. Be EXTRA vigilant for:
1. Any missed AGI indicators
2. Signs of capability jumps or emergent behaviors
3. Architectural breakthroughs that could lead to AGI
4. ANY progress toward human-level AI

IMPORTANT: If in doubt, err on the side of caution and flag it as AGI-relevant.

Provide your validation as JSON:
{
  "agrees": boolean,
  "validatedScore": number,
  "reasoning": string,
  "additionalIndicators": string[],
  "recommendation": "confirm" | "investigate" | "dismiss"
}`;

interface AnalysisWithCrawl {
  id: string;
  score: number;
  modelScore?: number | null;
  heuristicScore?: number | null;
  confidence: number;
  indicators: string[];
  severity: string | null;
  crossReferences: string[];
  title: string;
  content: string;
  metadata?: {
    source?: string;
    timestamp?: string;
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

export async function POST(request: Request) {
  if (!isDbEnabled) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'validate' });
  if (limited) return limited;

  try {
    const body = await request.json();
    const validatedBody = validateRequestSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validatedBody.error.errors },
        { status: 400 }
      );
    }

    const { analysisId } = validatedBody.data;

    // Get the analysis with crawl data
    const analysis = await queryOne<AnalysisWithCrawl>(`
      SELECT
        ar.id,
        ar.score,
        ar."modelScore",
        ar."heuristicScore",
        ar.confidence,
        ar.indicators,
        ar.severity,
        ar."crossReferences",
        cr.title,
        cr.content,
        cr.metadata
      FROM "AnalysisResult" ar
      JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
      WHERE ar.id = $1
    `, [analysisId]);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Validate with OpenAI
    const validationPrompt = VALIDATION_PROMPT
      .replace('{score}', analysis.score.toString())
      .replace('{indicators}', analysis.indicators.join(', '))
      .replace('{severity}', analysis.severity || 'none');

    const evidenceSnippets = analysis.metadata?.evidence?.snippets || [];
    const translationEnabled = process.env.CHINESE_TRANSLATION_ENABLED !== 'false';
    let translatedSnippets: string[] = [];
    if (translationEnabled && shouldTranslateCjk(`${analysis.title} ${analysis.content}`)) {
      try {
        const translation = await translateToEnglish({
          title: analysis.title,
          snippets: evidenceSnippets.slice(0, 6)
        });
        translatedSnippets = translation.translatedSnippets || [];
      } catch (err) {
        console.warn('[Translate] Failed to translate evidence snippets:', err);
      }
    }
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const vOptions = {
      model,
      messages: [
        { role: "system" as const, content: validationPrompt },
        {
          role: "user" as const,
          content: `Title: ${analysis.title}\n\nEvidence Snippets:\n${evidenceSnippets.map(s => `- ${s}`).join('\n')}\n${translatedSnippets.length > 0 ? `\nTranslated Evidence:\n${translatedSnippets.map(s => `- ${s}`).join('\n')}\n` : ''}\nContent: ${analysis.content}`
        }
      ],
      response_format: { type: "json_object" as const }
    };
    const validation = await openai.chat.completions.create(vOptions);

    const validationResult = safeJsonParse(validation.choices[0]?.message?.content || '{}', {
      agrees: false,
      validatedScore: 0,
      reasoning: 'Failed to parse validation response',
      additionalIndicators: [],
      recommendation: 'investigate'
    });

    // Check cross-references for high severity analyses
    let crossReferenceResults: Array<{
      source: string;
      found: boolean;
      articleCount?: number;
      titles?: string[];
      error?: string;
    }> = [];
    if (analysis.severity === 'high' || analysis.severity === 'critical') {
      crossReferenceResults = await checkCrossReferences(analysis.crossReferences);
    }
    const checkedCrossRefs = analysis.severity === 'high' || analysis.severity === 'critical';
    const hasCrossRefs = (analysis.crossReferences || []).length > 0;
    const hasCorroboration = crossReferenceResults.some(r => r.found);
    const corroborationPenalty = checkedCrossRefs && hasCrossRefs && !hasCorroboration ? 0.2 : 0;

    // Calculate final score and confidence
    const modelScore = validationResult.validatedScore || analysis.modelScore || analysis.score;
    const claims = analysis.metadata?.evidence?.claims || [];
    let translatedClaims: ReturnType<typeof extractEvidenceClaims> = [];
    if (translatedSnippets.length > 0) {
      const snippetObjects: EvidenceSnippet[] = translatedSnippets.map(text => ({ text, score: 1, tags: [] }));
      translatedClaims = extractEvidenceClaims(snippetObjects);
    }
    const mergedClaims = [...claims, ...translatedClaims];
    const heuristic = computeHeuristicScore({
      claims: mergedClaims,
      snippetsCount: analysis.metadata?.evidence?.snippets?.length || 0
    });

    const secrecyIndicators = analyzeForSecrecyIndicators(
      analysis.content,
      analysis.metadata?.source || 'Unknown',
      analysis.metadata?.timestamp || new Date().toISOString()
    );
    const departureIndicators = analyzeResearcherDepartures(
      analysis.content,
      analysis.metadata?.source || 'Unknown'
    );
    const allSecrecyIndicators = [...secrecyIndicators, ...departureIndicators];
    let secrecyBoost = 0;
    const criticalSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'critical').length;
    const highSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'high').length;
    if (criticalSecrecy > 0) secrecyBoost = 0.2;
    else if (highSecrecy > 0) secrecyBoost = 0.1;

    const signals = [...heuristic.signals];
    if (secrecyBoost > 0) {
      signals.push({ name: 'secrecy', value: secrecyBoost, detail: criticalSecrecy > 0 ? 'critical' : 'high' });
    }
    if (corroborationPenalty > 0) {
      signals.push({ name: 'corroboration_penalty', value: -corroborationPenalty, detail: 'no corroboration' });
    }
    const combined = computeCombinedScore({
      modelScore,
      heuristicScore: heuristic.score,
      secrecyBoost,
      corroborationPenalty,
      signals
    });

    const penaltyAdjustedPrior = Math.max(0, analysis.score - corroborationPenalty);
    const finalScore = Math.max(penaltyAdjustedPrior, combined.combinedScore);

    const prevConfidence = analysis.confidence;
    const addedIndicators = (validationResult.additionalIndicators || []).length;
    const newConfidence = Math.min(1, prevConfidence + (validationResult.agrees ? 0.2 : 0.1));

    const lastValidation = {
      prevScore: analysis.score,
      newScore: finalScore,
      prevConfidence,
      newConfidence,
      addedIndicators,
      recommendation: validationResult.recommendation || 'investigate',
      timestamp: new Date().toISOString(),
      modelScore,
      heuristicScore: heuristic.score,
      corroborationPenalty
    };

    const hasDelta = hasBenchmarkDelta(mergedClaims);
    let newSeverity = severityForScore(finalScore);
    newSeverity = enforceCriticalEvidenceGate(newSeverity, hasDelta);
    newSeverity = applyValidationOverride(newSeverity, validationResult.recommendation);

    // Merge indicators
    const mergedIndicators = [...new Set([...analysis.indicators, ...(validationResult.additionalIndicators || [])])];

    // Update analysis
    await ensureAnalysisScoreSchema();
    await execute(`
      UPDATE "AnalysisResult"
      SET
        "requiresVerification" = false,
        confidence = $1,
        score = $2,
        severity = $3,
        indicators = $4,
        "validatedAt" = NOW(),
        "lastValidation" = $5,
        "modelScore" = $6,
        "heuristicScore" = $7,
        "scoreBreakdown" = $8
      WHERE id = $9
    `, [newConfidence, finalScore, newSeverity, mergedIndicators, JSON.stringify(lastValidation), modelScore, heuristic.score, JSON.stringify(combined.breakdown), analysisId]);

    // Get updated analysis
    const updatedAnalysis = await queryOne<{
      id: string;
      score: number;
      confidence: number;
      indicators: string[];
      severity: string;
      validatedAt: Date;
    }>(`
      SELECT id, score, confidence, indicators, severity, "validatedAt"
      FROM "AnalysisResult"
      WHERE id = $1
    `, [analysisId]);

    return NextResponse.json({
      success: true,
      data: {
        validation: validationResult,
        crossReferenceResults,
        updatedAnalysis
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate analysis' },
      { status: 500 }
    );
  }
}

async function checkCrossReferences(references: string[]): Promise<Array<{
  source: string;
  found: boolean;
  articleCount?: number;
  titles?: string[];
  error?: string;
}>> {
  const results = [];

  for (const ref of references) {
    const allSources = [
      ...SOURCES.RESEARCH_BLOGS,
      ...SOURCES.NEWS_SITES,
      ...SOURCES.ACADEMIC,
      ...(SOURCES.CHINA_LABS || []),
      ...(SOURCES.CHINA_ACADEMIC || []),
      ...(SOURCES.CHINA_MODEL_RELEASES || [])
    ];

    const source = allSources.find(s => s.name.toLowerCase().includes(ref.toLowerCase()));

    if (source) {
      try {
        const articles = await crawlSource(source);
        const relatedArticles = articles.filter(article =>
          article.content.toLowerCase().includes('agi') ||
          article.content.toLowerCase().includes('artificial general intelligence') ||
          article.content.toLowerCase().includes('superintelligence')
        );

        results.push({
          source: ref,
          found: relatedArticles.length > 0,
          articleCount: relatedArticles.length,
          titles: relatedArticles.slice(0, 3).map(a => a.title)
        });
      } catch {
        results.push({
          source: ref,
          found: false,
          error: 'Failed to crawl source'
        });
      }
    }
  }

  return results;
}
