import { NextRequest, NextResponse } from 'next/server';
import { queryOne, isDbEnabled } from '@/lib/db';
import { ensureAnalysisJobSchema } from '@/lib/jobs/analyzeAllWorker';

export const dynamic = 'force-dynamic';

interface AnalysisJob {
  id: string;
  status: string;
  totalArticles: number;
  processedArticles: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  currentArticle: string | null;
  avgBatchTime: number | null;
  estimatedTimeRemaining: number | null;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  try {
    await ensureAnalysisJobSchema();
    let job: AnalysisJob | null;

    if (jobId) {
      // Get specific job
      job = await queryOne<AnalysisJob>(`
        SELECT id, status, "totalArticles", "processedArticles",
               "successfulAnalyses", "failedAnalyses", "currentArticle",
               "avgBatchTime", "estimatedTimeRemaining", "startedAt",
               "completedAt", error
        FROM "AnalysisJob"
        WHERE id = $1
      `, [jobId]);
    } else {
      // Get most recent active or recent job
      job = await queryOne<AnalysisJob>(`
        SELECT id, status, "totalArticles", "processedArticles",
               "successfulAnalyses", "failedAnalyses", "currentArticle",
               "avgBatchTime", "estimatedTimeRemaining", "startedAt",
               "completedAt", error
        FROM "AnalysisJob"
        ORDER BY
          CASE WHEN status = 'running' THEN 0 ELSE 1 END,
          "startedAt" DESC
        LIMIT 1
      `);
    }

    if (!job) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No analysis jobs found'
      });
    }

    // Calculate progress percentage
    const progress = job.totalArticles > 0
      ? Math.round((job.processedArticles / job.totalArticles) * 100)
      : 0;

    // Format ETA
    let eta: string | null = null;
    if (job.estimatedTimeRemaining && job.estimatedTimeRemaining > 0) {
      const seconds = Math.round(job.estimatedTimeRemaining);
      if (seconds < 60) {
        eta = `${seconds}s`;
      } else {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        eta = `${mins}m ${secs}s`;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress,
        totalArticles: job.totalArticles,
        processedArticles: job.processedArticles,
        successfulAnalyses: job.successfulAnalyses,
        failedAnalyses: job.failedAnalyses,
        currentArticle: job.currentArticle,
        eta,
        avgBatchTimeMs: job.avgBatchTime ? Math.round(job.avgBatchTime) : null,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error
      }
    });
  } catch (error) {
    console.error('[Analyze Status] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    }, { status: 500 });
  }
}
