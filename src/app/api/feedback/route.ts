import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne, isDbEnabled } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  analysisId: z.string().uuid(),
  feedbackType: z.enum(['relevant', 'noise', 'false_positive', 'critical']),
  comment: z.string().optional()
});

interface FeedbackRecord {
  id: string;
  feedbackType: string;
  timestamp: Date;
}

interface FeedbackCount {
  feedbackType: string;
  count: string;
}

interface RecentFeedback {
  id: string;
  feedbackType: string;
  timestamp: Date;
  score: number;
  severity: string | null;
  title: string;
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid feedback data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { analysisId, feedbackType, comment } = parsed.data;

    // Verify analysis exists
    const analysis = await queryOne<{ id: string }>(
      'SELECT id FROM "AnalysisResult" WHERE id = $1',
      [analysisId]
    );

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Create feedback record
    const feedback = await insert<FeedbackRecord>(
      `INSERT INTO "UserFeedback" (id, "analysisId", "feedbackType", comment)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id, "feedbackType", timestamp`,
      [analysisId, feedbackType, comment || null]
    );

    console.log(`[Feedback] Recorded ${feedbackType} feedback for analysis ${analysisId}`);

    return NextResponse.json({
      success: true,
      data: {
        id: feedback?.id,
        feedbackType,
        timestamp: feedback?.timestamp
      }
    });

  } catch (error) {
    console.error('[Feedback] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    );
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get feedback counts by type
    const feedbackCounts = await query<FeedbackCount>(`
      SELECT "feedbackType", COUNT(*) as count
      FROM "UserFeedback"
      WHERE timestamp >= $1
      GROUP BY "feedbackType"
    `, [since]);

    // Calculate statistics
    const total = feedbackCounts.reduce((sum, f) => sum + Number(f.count), 0);
    const relevant = Number(feedbackCounts.find(f => f.feedbackType === 'relevant')?.count || 0);
    const critical = Number(feedbackCounts.find(f => f.feedbackType === 'critical')?.count || 0);
    const noise = Number(feedbackCounts.find(f => f.feedbackType === 'noise')?.count || 0);
    const falsePositive = Number(feedbackCounts.find(f => f.feedbackType === 'false_positive')?.count || 0);

    const accuracy = total > 0 ? ((relevant + critical) / total) * 100 : 0;

    // Get recent feedback
    const recentFeedback = await query<RecentFeedback>(`
      SELECT
        uf.id,
        uf."feedbackType",
        uf.timestamp,
        ar.score,
        ar.severity,
        cr.title
      FROM "UserFeedback" uf
      JOIN "AnalysisResult" ar ON ar.id = uf."analysisId"
      JOIN "CrawlResult" cr ON cr.id = ar."crawlId"
      ORDER BY uf.timestamp DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      data: {
        period: `${days} days`,
        total,
        breakdown: {
          relevant,
          critical,
          noise,
          falsePositive
        },
        accuracy: accuracy.toFixed(1),
        recentFeedback: recentFeedback.map(f => ({
          id: f.id,
          feedbackType: f.feedbackType,
          timestamp: f.timestamp,
          analysisTitle: f.title,
          analysisSeverity: f.severity,
          analysisScore: f.score
        }))
      }
    });

  } catch (error) {
    console.error('[Feedback] Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch feedback stats' },
      { status: 500 }
    );
  }
}
