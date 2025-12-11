import { NextResponse } from 'next/server';
import { query, insert, execute, isDbEnabled } from '@/lib/db';
import { openai, AGI_DETECTION_PROMPT, generateEmbedding } from '@/lib/openai';
import { computeSeverity } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';

interface AnalysisJob {
  id: string;
}

interface CrawlResult {
  id: string;
  title: string;
  content: string;
}

interface AnalysisRecord {
  id: string;
  score: number;
  severity: string | null;
  confidence: number;
  indicators: string[];
}

// Small utility to bound async operations
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  logs?: string[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const msg = `[Analyze All] Timeout after ${ms}ms at: ${label}`;
      console.warn(msg);
      logs?.push(msg);
      const err = new Error(msg) as Error & { statusCode?: number; name?: string };
      err.name = 'TimeoutError';
      err.statusCode = 504;
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// Tunables via env
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '15000', 10);
const ANALYZE_BATCH_SIZE = Math.max(1, parseInt(process.env.ANALYZE_BATCH_SIZE || '2', 10));
const BATCH_TIMEOUT_MS = parseInt(process.env.BATCH_TIMEOUT_MS || '20000', 10);

async function analyzeArticle(crawlResult: CrawlResult, logs: string[] = []): Promise<AnalysisRecord | null> {
  try {
    const logMsg = `[Analyze] Starting analysis for: ${crawlResult.title}`;
    console.log(logMsg);
    logs.push(logMsg);

    // Check if already analyzed
    const existing = await withTimeout(
      query<{ id: string }>(
        `SELECT id FROM "AnalysisResult" WHERE "crawlId" = $1 LIMIT 1`,
        [crawlResult.id]
      ),
      10000,
      'DB check existing',
      logs
    );

    if (existing.length > 0) {
      const skipMsg = `[Analyze] Skipping already analyzed: ${crawlResult.title}`;
      console.log(skipMsg);
      logs.push(skipMsg);
      return null;
    }

    const analyzeMsg = `[Analyze] Analyzing: ${crawlResult.title}`;
    console.log(analyzeMsg);
    logs.push(analyzeMsg);

    // Call OpenAI
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const options = {
      model,
      messages: [
        { role: "system" as const, content: AGI_DETECTION_PROMPT },
        { role: "user" as const, content: `Title: ${crawlResult.title}\n\nContent: ${crawlResult.content}` }
      ],
      response_format: { type: "json_object" as const }
    };

    logs.push(`[Analyze] Calling OpenAI model=${model} timeout=${OPENAI_TIMEOUT_MS}ms`);

    const completion = await openai.chat.completions.create(options, {
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 0
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis result received from OpenAI');
    }

    const analysisResult = parseOpenAIResponse(content);
    const severity = computeSeverity(analysisResult.score || 0, analysisResult.severity);

    // Generate embedding for semantic search
    let embeddingValue: string | null = null;
    try {
      const text = `${crawlResult.title}\n\n${crawlResult.content}`.slice(0, 8000);
      const embedding = await generateEmbedding(text);
      embeddingValue = `[${embedding.join(',')}]`;
    } catch (err) {
      console.warn('[Analyze All] Embedding generation failed:', err);
    }

    // Store analysis
    const analysis = await withTimeout(
      insert<AnalysisRecord>(
        `INSERT INTO "AnalysisResult"
         (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)
         RETURNING id, score, confidence, indicators, severity`,
        [
          crawlResult.id,
          analysisResult.score || 0,
          analysisResult.confidence || 0,
          analysisResult.indicators || [],
          severity,
          analysisResult.evidence_quality || 'speculative',
          analysisResult.requires_verification || false,
          analysisResult.cross_references || [],
          analysisResult.explanation || 'No AGI indicators detected',
          embeddingValue
        ]
      ),
      10000,
      'DB insert analysis',
      logs
    );

    if (!analysis) {
      throw new Error('Failed to insert analysis');
    }

    // Historical metrics
    try {
      await withTimeout(
        Promise.all([
          insert(`INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'score', analysis.score]),
          insert(`INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'confidence', analysis.confidence]),
          insert(`INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'indicator_count', (analysis.indicators || []).length])
        ]),
        10000,
        'DB insert historical',
        logs
      );
    } catch (histErr) {
      console.warn('[Analyze All] Failed to write historical data for', analysis.id, histErr);
    }

    return analysis;
  } catch (error) {
    console.error(`[Analyze] Error analyzing article ${crawlResult.id}:`, error);
    return null;
  }
}

export async function POST() {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const logs: string[] = [];
  logs.push('[Analyze All] Starting analysis of all unanalyzed articles...');
  console.log('[Analyze All] Endpoint called');

  let jobId: string | null = null;

  try {
    // Get unanalyzed crawl results
    logs.push('[Analyze All] Querying database for unanalyzed articles...');

    const unanalyzedResults = await withTimeout(
      query<CrawlResult>(
        `SELECT cr.id, cr.title, cr.content
         FROM "CrawlResult" cr
         LEFT JOIN "AnalysisResult" ar ON cr.id = ar."crawlId"
         WHERE ar.id IS NULL
         ORDER BY cr.timestamp DESC
         LIMIT 50`
      ),
      15000,
      'DB findMany unanalyzed',
      logs
    );

    logs.push(`[Analyze All] Found ${unanalyzedResults.length} unanalyzed articles`);
    console.log(`[Analyze All] Found ${unanalyzedResults.length} unanalyzed articles`);

    if (unanalyzedResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unanalyzed articles found',
        logs,
        data: {
          analyses: [],
          summary: {
            totalAnalyzed: 0,
            averageScore: 0,
            highSeverityCount: 0,
            criticalCount: 0
          }
        }
      });
    }

    // Create job record for progress tracking
    const job = await insert<AnalysisJob>(
      `INSERT INTO "AnalysisJob" (id, status, "totalArticles", "processedArticles")
       VALUES (gen_random_uuid(), 'running', $1, 0)
       RETURNING id`,
      [unanalyzedResults.length]
    );
    jobId = job?.id || null;
    logs.push(`[Analyze All] Created job ${jobId}`);

    // Analyze in batches
    const analyses: AnalysisRecord[] = [];
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const batchTimes: number[] = [];
    console.log('[Analyze All] Starting batch processing...');

    for (let i = 0; i < unanalyzedResults.length; i += ANALYZE_BATCH_SIZE) {
      const batchStart = Date.now();
      const batchNum = Math.floor(i / ANALYZE_BATCH_SIZE) + 1;
      const batchLog = `[Analyze All] Processing batch ${batchNum} (articles ${i + 1}-${Math.min(i + ANALYZE_BATCH_SIZE, unanalyzedResults.length)})`;
      logs.push(batchLog);
      console.log(batchLog);

      const batch = unanalyzedResults.slice(i, i + ANALYZE_BATCH_SIZE);
      const currentArticle = batch[0]?.title?.slice(0, 100) || 'Unknown';

      try {
        const batchPromises = batch.map((article) => analyzeArticle(article, logs));
        const settled = await withTimeout(
          Promise.allSettled(batchPromises),
          BATCH_TIMEOUT_MS,
          `Batch analysis (${batchNum})`,
          logs
        );

        const validResults = settled
          .filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<AnalysisRecord | null>).value != null)
          .map((r) => (r as PromiseFulfilledResult<AnalysisRecord>).value);

        const batchFailed = settled.filter((r) => r.status === 'rejected').length;
        const successLog = `[Analyze All] Batch completed: ${validResults.length}/${batch.length} successful; ${batchFailed} failed/timeouts`;
        logs.push(successLog);
        console.log(successLog);

        analyses.push(...validResults);
        processedCount += batch.length;
        successCount += validResults.length;
        failedCount += batchFailed + (batch.length - validResults.length - batchFailed);
      } catch (batchError) {
        const errorLog = `[Analyze All] Batch processing error: ${(batchError as Error)?.message || 'Unknown error'}`;
        logs.push(errorLog);
        console.log(errorLog);
        processedCount += batch.length;
        failedCount += batch.length;
      }

      // Track batch time and calculate ETA
      const batchTime = Date.now() - batchStart;
      batchTimes.push(batchTime);
      const avgBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
      const remainingBatches = Math.ceil((unanalyzedResults.length - processedCount) / ANALYZE_BATCH_SIZE);
      const estimatedTimeRemaining = (remainingBatches * avgBatchTime) / 1000; // in seconds

      // Update job progress
      if (jobId) {
        await execute(
          `UPDATE "AnalysisJob" SET
             "processedArticles" = $1,
             "successfulAnalyses" = $2,
             "failedAnalyses" = $3,
             "currentArticle" = $4,
             "avgBatchTime" = $5,
             "estimatedTimeRemaining" = $6
           WHERE id = $7`,
          [processedCount, successCount, failedCount, currentArticle, avgBatchTime, estimatedTimeRemaining, jobId]
        );
      }

      // Delay between batches
      if (i + ANALYZE_BATCH_SIZE < unanalyzedResults.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Analyze All] Successfully analyzed ${analyses.length} articles`);

    // Summary statistics
    const validAnalyses = analyses.filter(a => a.score > 0);
    const avgScore = validAnalyses.length > 0
      ? validAnalyses.reduce((sum, a) => sum + a.score, 0) / validAnalyses.length
      : 0;

    const highSeverityCount = analyses.filter(a =>
      a.severity === 'high' || a.severity === 'critical'
    ).length;

    // Create trend snapshots
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
    } catch (trendErr) {
      console.warn('[Analyze All] Trend snapshot creation failed:', trendErr);
    }

    // Mark job as completed
    if (jobId) {
      await execute(
        `UPDATE "AnalysisJob" SET
           status = 'completed',
           "processedArticles" = $1,
           "successfulAnalyses" = $2,
           "failedAnalyses" = $3,
           "estimatedTimeRemaining" = 0,
           "completedAt" = NOW()
         WHERE id = $4`,
        [processedCount, successCount, failedCount, jobId]
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      logs,
      data: {
        analyses,
        summary: {
          totalAnalyzed: analyses.length,
          averageScore: avgScore,
          highSeverityCount,
          criticalCount: analyses.filter(a => a.severity === 'critical').length
        }
      }
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; name?: string; code?: string };
    const errorMessage = err?.message || 'Unknown error occurred';
    const errorCode = err?.code || 'NO_CODE';
    const errorName = err?.name || 'UnknownError';
    const status = (err && typeof err.statusCode === 'number') ? err.statusCode : (errorName === 'TimeoutError' ? 504 : 500);

    console.log('[Analyze All] Caught error:', errorMessage);

    // Mark job as failed
    if (jobId) {
      await execute(
        `UPDATE "AnalysisJob" SET
           status = 'failed',
           error = $1,
           "completedAt" = NOW()
         WHERE id = $2`,
        [errorMessage, jobId]
      ).catch(e => console.error('[Analyze All] Failed to update job error:', e));
    }

    return NextResponse.json(
      {
        success: false,
        jobId,
        error: `Failed to analyze articles: ${errorMessage}`,
        errorCode,
        errorName,
        logs
      },
      { status }
    );
  }
}
