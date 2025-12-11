import { NextResponse } from 'next/server';
import { query, insert, isDbEnabled } from '@/lib/db';
import { openai, AGI_DETECTION_PROMPT, generateEmbedding } from '@/lib/openai';
import { computeSeverity } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';
import {
  analyzeForSecrecyIndicators,
  analyzeResearcherDepartures,
  SecrecyIndicator
} from '@/lib/detection/silence-patterns';

interface CrawlResult {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  metadata: { source?: string; timestamp?: string } | null;
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
    await insert(
      `INSERT INTO "TrendAnalysis" (period, "avgScore", "maxScore", "minScore", "totalAnalyses", "criticalAlerts")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'daily',
        scores.reduce((a, b) => a + b, 0) / scores.length,
        Math.max(...scores),
        Math.min(...scores),
        dailyAnalyses.length,
        dailyAnalyses.filter(a => a.severity === 'critical').length
      ]
    );
  }

  // Weekly trends
  const weeklyAnalyses = await query<{ score: number; severity: string | null }>(
    `SELECT score, severity FROM "AnalysisResult" WHERE timestamp >= $1`,
    [weekAgo]
  );

  if (weeklyAnalyses.length > 0) {
    const scores = weeklyAnalyses.map(a => a.score);
    await insert(
      `INSERT INTO "TrendAnalysis" (period, "avgScore", "maxScore", "minScore", "totalAnalyses", "criticalAlerts")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'weekly',
        scores.reduce((a, b) => a + b, 0) / scores.length,
        Math.max(...scores),
        Math.min(...scores),
        weeklyAnalyses.length,
        weeklyAnalyses.filter(a => a.severity === 'critical').length
      ]
    );
  }
}

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 503 }
    );
  }

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

    // Analyze content using OpenAI
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const options = {
      model,
      messages: [
        { role: "system" as const, content: AGI_DETECTION_PROMPT },
        { role: "user" as const, content: `Title: ${latestCrawl.title}\n\nContent: ${latestCrawl.content}` }
      ],
      response_format: { type: "json_object" as const }
    };
    const completion = await openai.chat.completions.create(options);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis result received from OpenAI');
    }

    const analysisResult = parseOpenAIResponse(content);

    // Run silence detection
    const metadata = latestCrawl.metadata;
    const sourceName = metadata?.source || 'Unknown';
    const timestamp = metadata?.timestamp || new Date().toISOString();

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

    // Boost score for secrecy patterns
    let adjustedScore = analysisResult.score || 0;
    const criticalSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'critical').length;
    const highSecrecy = allSecrecyIndicators.filter((si: SecrecyIndicator) => si.severity === 'high').length;

    if (criticalSecrecy > 0) {
      adjustedScore = Math.min(1.0, adjustedScore + 0.2);
    } else if (highSecrecy > 0) {
      adjustedScore = Math.min(1.0, adjustedScore + 0.1);
    }

    const severity = computeSeverity(adjustedScore, analysisResult.severity);

    // Generate embedding for semantic search (async, ~100ms)
    let embeddingValue: string | null = null;
    try {
      const text = `${latestCrawl.title}\n\n${latestCrawl.content}`.slice(0, 8000);
      const embedding = await generateEmbedding(text);
      embeddingValue = `[${embedding.join(',')}]`;
    } catch (err) {
      console.warn('[Analyze] Embedding generation failed, will be null:', err);
    }

    // Store analysis results
    const analysis = await insert<AnalysisResult>(
      `INSERT INTO "AnalysisResult"
       (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)
       RETURNING id, "crawlId", score, confidence, indicators, severity, explanation, timestamp`,
      [
        latestCrawl.id,
        adjustedScore,
        analysisResult.confidence || 0,
        combinedIndicators,
        severity,
        analysisResult.evidence_quality || 'speculative',
        analysisResult.requires_verification || criticalSecrecy > 0,
        analysisResult.cross_references || [],
        analysisResult.explanation || 'No analysis available',
        embeddingValue
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
      [analysis.id, 'score', analysisResult.score || 0]
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
