import { NextRequest, NextResponse } from 'next/server';
import { query, isDbEnabled } from '@/lib/db';
import { createAnalyzeAllJob } from '@/lib/jobs/analyzeAllWorker';
import { enqueueAnalyzeAllJob } from '@/lib/jobs/analyzeAllQueue';
import { enforceRateLimit } from '@/lib/security/rateLimit';

const ANALYZE_JOB_LIMIT = Math.max(1, parseInt(process.env.ANALYZE_JOB_LIMIT || '50', 10));

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 503 });
  }

  const limited = enforceRateLimit(request, { windowMs: 60_000, max: 1, keyPrefix: 'analyze-all' });
  if (limited) return limited;

  try {
    const remaining = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM "CrawlResult" cr
       LEFT JOIN "AnalysisResult" ar ON cr.id = ar."crawlId"
       WHERE ar.id IS NULL`
    );

    const totalRemaining = Number(remaining[0]?.count || 0);
    if (totalRemaining === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unanalyzed articles found',
        jobId: null
      });
    }

    const jobTotal = Math.min(totalRemaining, ANALYZE_JOB_LIMIT);
    const job = await createAnalyzeAllJob(jobTotal);
    const jobId = job?.id || null;
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Failed to create job' }, { status: 500 });
    }

    enqueueAnalyzeAllJob(jobId);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      totalArticles: totalRemaining
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
