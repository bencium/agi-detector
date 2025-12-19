import { NextRequest, NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';
import { openai, AGI_DETECTION_PROMPT, generateEmbedding } from '@/lib/openai';
import { computeSeverity, enforceCriticalEvidenceGate } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';
import {
  analyzeForSecrecyIndicators,
  analyzeResearcherDepartures,
  SecrecyIndicator
} from '@/lib/detection/silence-patterns';
import { upsertTrendSnapshot } from '@/lib/trends';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { computeCombinedScore, computeHeuristicScore, hasBenchmarkDelta } from '@/lib/scoring/multiSignal';
import { ensureAnalysisScoreSchema } from '@/lib/scoring/schema';
import { runLayer0Triage } from '@/lib/analysis/triage';
import { shouldTranslateCjk, translateToEnglish } from '@/lib/analysis/translation';
import { EvidenceSnippet, extractEvidenceClaims } from '@/lib/evidence/extract';

interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  metadata: {
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

interface AnalysisResult {
  id: string;
  crawlId: string;
  score: number;
  confidence: number;
  indicators: string[];
  severity: string;
  explanation: string;
  timestamp: Date;
}

async function updateTrendAnalysis() {
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
      criticalAlerts: dailyAnalyses.filter(a => a.severity === 'critical').length
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
      criticalAlerts: weeklyAnalyses.filter(a => a.severity === 'critical').length
    });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 503 }
    );
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'analyze' });
  if (limited) return limited;

  try {
    // Get the latest crawl result without analysis
    const latestCrawls = await query<CrawlResult>(
      `SELECT cr.id, cr.url, cr.title, cr.content, cr.timestamp, cr.metadata
       FROM "CrawlResult" cr
       LEFT JOIN "AnalysisResult" ar ON cr.id = ar."crawlId"
       WHERE ar.id IS NULL
       ORDER BY cr.timestamp DESC
       LIMIT 1`
    );

    const latestCrawl = latestCrawls[0];

    if (!latestCrawl || !latestCrawl.title || !latestCrawl.content) {
      return NextResponse.json(
        { success: false, error: 'No valid content to analyze' },
        { status: 404 }
      );
    }

    const metadata = latestCrawl.metadata;
    const sourceName = metadata?.source || 'Unknown';
    const timestamp = metadata?.timestamp || new Date().toISOString();
    const evidenceSnippets = metadata?.evidence?.snippets || [];

    const triage = runLayer0Triage({
      title: latestCrawl.title,
      content: latestCrawl.content,
      source: sourceName
    });

    if (triage.skip) {
      await ensureAnalysisScoreSchema();
      const filteredScore = 0.05;
      const filteredConfidence = 0.9;
      const filteredExplanation = `Layer-0 noise filter: ${triage.reason || 'No capability signals detected'}`;
      const filteredBreakdown = {
        modelScore: 0,
        heuristicScore: 0,
        secrecyBoost: 0,
        corroborationPenalty: 0,
        combinedScore: filteredScore,
        weights: {
          model: parseFloat(process.env.MODEL_SCORE_WEIGHT || '0.85'),
          heuristic: parseFloat(process.env.HEURISTIC_SCORE_WEIGHT || '0.15')
        },
        signals: [],
        filtered: true,
        filterReason: triage.reason || 'noise'
      };

      const filteredAnalysis = await insert<AnalysisResult>(
        `INSERT INTO "AnalysisResult"
         (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding, "modelScore", "heuristicScore", "scoreBreakdown")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13::jsonb)
         RETURNING id, "crawlId", score, confidence, indicators, severity, explanation, timestamp`,
        [
          latestCrawl.id,
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
          JSON.stringify(filteredBreakdown)
        ]
      );

      if (!filteredAnalysis) {
        throw new Error('Failed to save filtered analysis');
      }

      await insert(
        `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
        [filteredAnalysis.id, 'score', filteredScore]
      );
      await insert(
        `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
        [filteredAnalysis.id, 'model_score', 0]
      );
      await insert(
        `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
        [filteredAnalysis.id, 'heuristic_score', 0]
      );
      await insert(
        `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
        [filteredAnalysis.id, 'confidence', filteredConfidence]
      );
      await insert(
        `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
        [filteredAnalysis.id, 'indicator_count', 0]
      );
      await updateTrendAnalysis();

      return NextResponse.json({
        success: true,
        data: {
          ...filteredAnalysis,
          explanation: filteredExplanation,
          skipped: true
        }
      });
    }

    const translationEnabled = process.env.CHINESE_TRANSLATION_ENABLED !== 'false';
    let translatedSnippets: string[] = [];
    let translatedTitle = '';
    if (translationEnabled && shouldTranslateCjk(`${latestCrawl.title} ${latestCrawl.content}`)) {
      try {
        const translation = await translateToEnglish({
          title: latestCrawl.title,
          snippets: evidenceSnippets.slice(0, 6)
        });
        translatedTitle = translation.translatedTitle || '';
        translatedSnippets = translation.translatedSnippets || [];
      } catch (err) {
        console.warn('[Translate] Failed to translate evidence snippets:', err);
      }
    }

    // Analyze content using OpenAI
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const options = {
      model,
      messages: [
        { role: "system" as const, content: AGI_DETECTION_PROMPT },
        {
          role: "user" as const,
          content: `Title: ${latestCrawl.title}\n${translatedTitle ? `Translated Title: ${translatedTitle}\n` : ''}\nEvidence Snippets:\n${evidenceSnippets.map(s => `- ${s}`).join('\n')}\n${translatedSnippets.length > 0 ? `\nTranslated Evidence:\n${translatedSnippets.map(s => `- ${s}`).join('\n')}\n` : ''}\nContent: ${latestCrawl.content}`
        }
      ],
      response_format: { type: "json_object" as const }
    };
    const completion = await openai.chat.completions.create(options);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis result received from OpenAI');
    }

    const analysisResult = parseOpenAIResponse(content);
    const modelScore = analysisResult.score || 0;
    const crossReferences = analysisResult.cross_references || [];

    // Run silence detection
    const secrecyIndicators = analyzeForSecrecyIndicators(
      latestCrawl.content,
      sourceName,
      timestamp
    );
    const departureIndicators = analyzeResearcherDepartures(latestCrawl.content, sourceName);
    const allSecrecyIndicators = [...secrecyIndicators, ...departureIndicators];

    // Combine indicators
    const combinedIndicators = [
      ...(analysisResult.indicators || []),
      ...allSecrecyIndicators.map((si: SecrecyIndicator) => `[SECRECY] ${si.description}`)
    ];

    let corroborationPenalty = 0;
    if (crossReferences.length > 0) {
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
    }

    // Boost score for secrecy patterns
    let secrecyBoost = 0;
    const criticalSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'critical').length;
    const highSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'high').length;

    if (criticalSecrecy > 0) {
      secrecyBoost = 0.2;
    } else if (highSecrecy > 0) {
      secrecyBoost = 0.1;
    }

    const claims = metadata?.evidence?.claims || [];
    let translatedClaims: ReturnType<typeof extractEvidenceClaims> = [];
    if (translatedSnippets.length > 0) {
      const snippetObjects: EvidenceSnippet[] = translatedSnippets.map(text => ({ text, score: 1, tags: [] }));
      translatedClaims = extractEvidenceClaims(snippetObjects);
    }
    const mergedClaims = [...claims, ...translatedClaims];
    const heuristic = computeHeuristicScore({
      claims: mergedClaims,
      snippetsCount: metadata?.evidence?.snippets?.length || 0
    });

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

    const hasDelta = hasBenchmarkDelta(mergedClaims);
    let severity = computeSeverity(combined.combinedScore, analysisResult.severity);
    severity = enforceCriticalEvidenceGate(severity, hasDelta);

    // Generate embedding for semantic search (async, ~100ms)
    let embeddingValue: string | null = null;
    try {
      const text = `${latestCrawl.title}\n\n${latestCrawl.content}`.slice(0, 8000);
      const embedding = await generateEmbedding(text);
      embeddingValue = `[${embedding.join(',')}]`;
    } catch (err) {
      console.warn('[Analyze] Embedding generation failed, will be null:', err);
    }

    await ensureAnalysisScoreSchema();
    // Store analysis results
    const analysis = await insert<AnalysisResult>(
      `INSERT INTO "AnalysisResult"
       (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding, "modelScore", "heuristicScore", "scoreBreakdown")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13::jsonb)
       RETURNING id, "crawlId", score, confidence, indicators, severity, explanation, timestamp`,
      [
        latestCrawl.id,
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
        JSON.stringify(combined.breakdown)
      ]
    );

    if (!analysis) {
      throw new Error('Failed to save analysis result');
    }

    // Store secrecy patterns if detected
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
            JSON.stringify({ description: indicator.description })
          ]
        );
      }
    }

    // Store historical data
    await insert(
      `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [analysis.id, 'score', combined.combinedScore]
    );
    await insert(
      `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [analysis.id, 'model_score', modelScore]
    );
    await insert(
      `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [analysis.id, 'heuristic_score', heuristic.score]
    );
    await insert(
      `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [analysis.id, 'confidence', analysisResult.confidence || 0]
    );
    await insert(
      `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [analysis.id, 'indicator_count', (analysisResult.indicators || []).length]
    );

    // Update trend analysis
    await updateTrendAnalysis();

    return NextResponse.json({
      success: true,
      data: {
        ...analysis,
        explanation: analysisResult.explanation
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
}
