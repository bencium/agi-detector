import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne, isDbEnabled } from '@/lib/db';
import {
  fetchAllARCData,
  calculateAGIProgress,
  cleanupARCSources
} from '@/lib/arc-sources';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ARCProgress {
  id: string;
  topScore: number;
  baseline: number;
  status: string;
  source: string;
  timestamp: Date;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[ARC API] Starting ARC data fetch...');

  try {
    const limited = enforceRateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: 'arc' });
    if (limited) return limited;

    // Check for cached data first (within last hour)
    if (isDbEnabled) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentProgress = await queryOne<ARCProgress>(`
        SELECT id, "topScore", baseline, status, source, timestamp
        FROM "ARCProgress"
        WHERE timestamp >= $1
        ORDER BY timestamp DESC
        LIMIT 1
      `, [oneHourAgo]);

      if (recentProgress) {
        console.log('[ARC API] Returning cached data from', recentProgress.timestamp);
        const progress = calculateAGIProgress(recentProgress.topScore);
        return NextResponse.json({
          success: true,
          data: {
            progress,
            topScore: recentProgress.topScore,
            baseline: recentProgress.baseline,
            status: recentProgress.status,
            source: recentProgress.source,
            timestamp: recentProgress.timestamp,
            cached: true
          }
        });
      }
    }

    // Fetch fresh data from all sources
    const arcData = await fetchAllARCData();
    const progress = calculateAGIProgress(arcData.summary.topScore);

    // Store progress snapshot in database
    if (isDbEnabled) {
      await insert(`
        INSERT INTO "ARCProgress" (id, "topScore", baseline, status, source, metadata)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [
        arcData.summary.topScore,
        0.04,
        progress.status,
        'aggregated',
        JSON.stringify({
          totalTeams: arcData.summary.totalTeams,
          recentActivity: arcData.summary.recentActivity,
          significantEvents: arcData.summary.significantEvents.length,
          sources: {
            official: !!arcData.official,
            kaggle: arcData.kaggle.length,
            github: !!arcData.github
          }
        })
      ]);
      console.log('[ARC API] Stored progress snapshot');
    }

    // Cleanup browser resources
    await cleanupARCSources();

    const duration = Date.now() - startTime;
    console.log(`[ARC API] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: {
        progress,
        summary: arcData.summary,
        official: arcData.official ? {
          topScore: arcData.official.topScore,
          entriesCount: arcData.official.entries.length,
          topTeams: arcData.official.entries.slice(0, 5)
        } : null,
        kaggle: {
          entriesCount: arcData.kaggle.length,
          topTeams: arcData.kaggle.slice(0, 5)
        },
        github: arcData.github ? {
          discussionsCount: arcData.github.discussions.length,
          releasesCount: arcData.github.releases.length,
          commitsCount: arcData.github.commits.length,
          reposCount: arcData.github.repos.length,
          repos: arcData.github.repos.slice(0, 10) // Top 10 community implementations
        } : null,
        significantEvents: arcData.summary.significantEvents,
        timestamp: arcData.timestamp,
        cached: false,
        fetchDuration: duration
      }
    });

  } catch (error) {
    console.error('[ARC API] Error:', error);

    try {
      await cleanupARCSources();
    } catch (cleanupError) {
      console.error('[ARC API] Cleanup error:', cleanupError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ARC data'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[ARC API] Force refresh requested');

  try {
    const limited = enforceRateLimit(request, { windowMs: 60_000, max: 2, keyPrefix: 'arc-refresh' });
    if (limited) return limited;

    const arcData = await fetchAllARCData();
    const progress = calculateAGIProgress(arcData.summary.topScore);

    if (isDbEnabled) {
      await insert(`
        INSERT INTO "ARCProgress" (id, "topScore", baseline, status, source, metadata)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [
        arcData.summary.topScore,
        0.04,
        progress.status,
        'manual_refresh',
        JSON.stringify({
          totalTeams: arcData.summary.totalTeams,
          recentActivity: arcData.summary.recentActivity,
          significantEvents: arcData.summary.significantEvents.length
        })
      ]);
    }

    await cleanupARCSources();

    return NextResponse.json({
      success: true,
      data: {
        progress,
        summary: arcData.summary,
        timestamp: arcData.timestamp,
        refreshed: true
      }
    });

  } catch (error) {
    console.error('[ARC API] Refresh error:', error);
    await cleanupARCSources();

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh ARC data'
      },
      { status: 500 }
    );
  }
}
