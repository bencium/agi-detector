import { query, insert, execute } from '@/lib/db';
import {
  PipelineCrawlResult,
  PipelineResult,
  analyzeArticle,
  updateTrendSnapshots,
} from '@/lib/analysis/pipeline';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface AnalysisJob {
  id: string;
}

let analysisJobSchemaEnsured = false;

export async function ensureAnalysisJobSchema(): Promise<void> {
  if (analysisJobSchemaEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS "AnalysisJob" (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        status TEXT NOT NULL,
        "totalArticles" INTEGER NOT NULL DEFAULT 0,
        "processedArticles" INTEGER NOT NULL DEFAULT 0,
        "successfulAnalyses" INTEGER NOT NULL DEFAULT 0,
        "failedAnalyses" INTEGER NOT NULL DEFAULT 0,
        "currentArticle" TEXT,
        "avgBatchTime" DOUBLE PRECISION,
        "estimatedTimeRemaining" DOUBLE PRECISION,
        error TEXT,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY (id)
      )
    `);
    await execute(`
      CREATE INDEX IF NOT EXISTS "AnalysisJob_startedAt_idx"
      ON "AnalysisJob"("startedAt")
    `);
    analysisJobSchemaEnsured = true;
  } catch (error) {
    console.warn('[AnalysisJob] Failed to ensure schema:', error);
  }
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const ANALYZE_BATCH_SIZE = Math.max(1, parseInt(process.env.ANALYZE_BATCH_SIZE || '2', 10));
const ANALYZE_JOB_LIMIT = Math.max(1, parseInt(process.env.ANALYZE_JOB_LIMIT || '50', 10));
const BATCH_TIMEOUT_MS = parseInt(process.env.BATCH_TIMEOUT_MS || '20000', 10);

// ---------------------------------------------------------------------------
// Timeout utility (worker-specific infrastructure)
// ---------------------------------------------------------------------------

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
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// ---------------------------------------------------------------------------
// Per-article wrapper (checks existing + timeout)
// ---------------------------------------------------------------------------

async function analyzeArticleWithGuards(
  crawlResult: PipelineCrawlResult,
  logs: string[]
): Promise<PipelineResult | null> {
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

    // Run shared pipeline (secrecy detection disabled for batch)
    const result = await analyzeArticle(crawlResult, { logs });
    return result;
  } catch (error) {
    console.error(`[Analyze] Error analyzing article ${crawlResult.id}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Batch job orchestration
// ---------------------------------------------------------------------------

export async function runAnalyzeAllJob(jobId: string): Promise<void> {
  const logs: string[] = [];
  logs.push('[Analyze All] Starting analysis of all unanalyzed articles...');
  console.log('[Analyze All] Worker started for job', jobId);

  try {
    const unanalyzedResults = await withTimeout(
      query<PipelineCrawlResult>(
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
        const batchPromises = batch.map(article => analyzeArticleWithGuards(article, logs));
        const settled = await withTimeout(
          Promise.allSettled(batchPromises),
          BATCH_TIMEOUT_MS,
          `Batch analysis (${batchNum})`,
          logs
        );

        const validResults = settled
          .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<PipelineResult | null>).value != null)
          .map(r => (r as PromiseFulfilledResult<PipelineResult>).value);

        const batchFailed = settled.filter(r => r.status === 'rejected').length;
        const successLog = `[Analyze All] Batch completed: ${validResults.length}/${batch.length} successful; ${batchFailed} failed/timeouts`;
        logs.push(successLog);
        console.log(successLog);

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
      await updateTrendSnapshots();
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

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------

export async function createAnalyzeAllJob(totalArticles = 0): Promise<AnalysisJob | null> {
  await ensureAnalysisJobSchema();
  return insert<AnalysisJob>(
    `INSERT INTO "AnalysisJob" (id, status, "totalArticles", "processedArticles")
     VALUES (gen_random_uuid(), 'queued', $1, 0)
     RETURNING id`,
    [totalArticles]
  );
}
