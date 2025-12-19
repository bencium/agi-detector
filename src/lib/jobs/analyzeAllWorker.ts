import { query, insert, execute } from '@/lib/db';
import { openai, AGI_DETECTION_PROMPT, generateEmbedding } from '@/lib/openai';
import { computeSeverity } from '@/lib/severity';
import { parseOpenAIResponse } from '@/lib/utils/safeJson';
import { upsertTrendSnapshot } from '@/lib/trends';
import { computeCombinedScore, computeHeuristicScore } from '@/lib/scoring/multiSignal';
import { ensureAnalysisScoreSchema } from '@/lib/scoring/schema';

interface AnalysisJob {
  id: string;
}

interface CrawlResult {
  id: string;
  title: string;
  content: string;
  metadata?: {
    evidence?: { snippets?: string[] };
  } | null;
}

interface AnalysisRecord {
  id: string;
  score: number;
  severity: string | null;
  confidence: number;
  indicators: string[];
}

// Tunables via env
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '15000', 10);
const ANALYZE_BATCH_SIZE = Math.max(1, parseInt(process.env.ANALYZE_BATCH_SIZE || '2', 10));
const ANALYZE_JOB_LIMIT = Math.max(1, parseInt(process.env.ANALYZE_JOB_LIMIT || '50', 10));
const BATCH_TIMEOUT_MS = parseInt(process.env.BATCH_TIMEOUT_MS || '20000', 10);

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

    const evidenceSnippets = crawlResult.metadata?.evidence?.snippets || [];

    // Call OpenAI
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const options = {
      model,
      messages: [
        { role: 'system' as const, content: AGI_DETECTION_PROMPT },
        {
          role: 'user' as const,
          content: `Title: ${crawlResult.title}\n\nEvidence Snippets:\n${evidenceSnippets.map(s => `- ${s}`).join('\n')}\n\nContent: ${crawlResult.content}`
        }
      ],
      response_format: { type: 'json_object' as const }
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
    const modelScore = analysisResult.score || 0;
    const heuristic = computeHeuristicScore({
      claims: crawlResult.metadata?.evidence?.claims || [],
      snippetsCount: crawlResult.metadata?.evidence?.snippets?.length || 0
    });
    const combined = computeCombinedScore({
      modelScore,
      heuristicScore: heuristic.score,
      secrecyBoost: 0,
      signals: heuristic.signals
    });
    const severity = computeSeverity(combined.combinedScore, analysisResult.severity);

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
    await ensureAnalysisScoreSchema();
    const analysis = await withTimeout(
      insert<AnalysisRecord>(
        `INSERT INTO "AnalysisResult"
         (id, "crawlId", score, confidence, indicators, severity, "evidenceQuality", "requiresVerification", "crossReferences", explanation, embedding, "modelScore", "heuristicScore", "scoreBreakdown")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13::jsonb)
         RETURNING id, score, confidence, indicators, severity`,
        [
          crawlResult.id,
          combined.combinedScore,
          analysisResult.confidence || 0,
          analysisResult.indicators || [],
          severity,
          analysisResult.evidence_quality || 'speculative',
          analysisResult.requires_verification || false,
          analysisResult.cross_references || [],
          analysisResult.explanation || 'No AGI indicators detected',
          embeddingValue,
          modelScore,
          heuristic.score,
          JSON.stringify(combined.breakdown)
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
          insert(
            `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'score', combined.combinedScore]
          ),
          insert(
            `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'model_score', modelScore]
          ),
          insert(
            `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'heuristic_score', heuristic.score]
          ),
          insert(
            `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'confidence', analysis.confidence]
          ),
          insert(
            `INSERT INTO "HistoricalData" (id, "analysisId", metric, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [analysis.id, 'indicator_count', (analysis.indicators || []).length]
          )
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

export async function runAnalyzeAllJob(jobId: string): Promise<void> {
  const logs: string[] = [];
  logs.push('[Analyze All] Starting analysis of all unanalyzed articles...');
  console.log('[Analyze All] Worker started for job', jobId);

  try {
    // Find unanalyzed results (bounded)
    const unanalyzedResults = await withTimeout(
      query<CrawlResult>(
        `SELECT cr.id, cr.title, cr.content, cr.metadata
         FROM "CrawlResult" cr
         LEFT JOIN "AnalysisResult" ar ON cr.id = ar."crawlId"
         WHERE ar.id IS NULL
         ORDER BY cr.timestamp DESC
         LIMIT $1`,
        [ANALYZE_JOB_LIMIT]
      ),
      15000,
      'DB findMany unanalyzed',
      logs
    );

    if (unanalyzedResults.length === 0) {
      await execute(
        `UPDATE "AnalysisJob" SET
           status = 'completed',
           "processedArticles" = 0,
           "successfulAnalyses" = 0,
           "failedAnalyses" = 0,
           "estimatedTimeRemaining" = 0,
           "completedAt" = NOW()
         WHERE id = $1`,
        [jobId]
      );
      return;
    }

    await execute(
      `UPDATE "AnalysisJob" SET
         status = 'running',
         "totalArticles" = $1,
         "processedArticles" = 0,
         "successfulAnalyses" = 0,
         "failedAnalyses" = 0
       WHERE id = $2`,
      [unanalyzedResults.length, jobId]
    );

    const analyses: AnalysisRecord[] = [];
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const batchTimes: number[] = [];

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

      const batchTime = Date.now() - batchStart;
      batchTimes.push(batchTime);
      const avgBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
      const remainingBatches = Math.ceil((unanalyzedResults.length - processedCount) / ANALYZE_BATCH_SIZE);
      const estimatedTimeRemaining = (remainingBatches * avgBatchTime) / 1000;

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

      if (i + ANALYZE_BATCH_SIZE < unanalyzedResults.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Trend snapshots
    try {
      const dailyAnalyses = await query<{ score: number; severity: string | null }>(
        `SELECT score, severity FROM "AnalysisResult" WHERE timestamp >= NOW() - INTERVAL '1 day'`
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

      const weeklyAnalyses = await query<{ score: number; severity: string | null }>(
        `SELECT score, severity FROM "AnalysisResult" WHERE timestamp >= NOW() - INTERVAL '7 days'`
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
    } catch (trendErr) {
      console.warn('[Analyze All] Trend snapshot creation failed:', trendErr);
    }

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
  } catch (error) {
    const err = error as Error & { statusCode?: number; name?: string; code?: string };
    const errorMessage = err?.message || 'Unknown error occurred';
    console.log('[Analyze All] Worker error:', errorMessage);

    await execute(
      `UPDATE "AnalysisJob" SET
         status = 'failed',
         error = $1,
         "completedAt" = NOW()
       WHERE id = $2`,
      [errorMessage, jobId]
    ).catch(e => console.error('[Analyze All] Failed to update job error:', e));
  }
}

export async function createAnalyzeAllJob(totalArticles = 0): Promise<AnalysisJob | null> {
  return insert<AnalysisJob>(
    `INSERT INTO "AnalysisJob" (id, status, "totalArticles", "processedArticles")
     VALUES (gen_random_uuid(), 'queued', $1, 0)
     RETURNING id`,
    [totalArticles]
  );
}
