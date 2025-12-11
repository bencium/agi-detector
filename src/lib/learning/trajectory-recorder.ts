/**
 * Search Trajectory Recorder for ruvector Self-Learning
 * Records which search results were useful to improve future searches
 *
 * When using ruvector-postgres, this data feeds into:
 * - ruvector_record_trajectory() for search optimization
 * - ruvector_optimize_search_params() for automatic tuning
 */

import { query, queryOne, execute, isDbEnabled } from '@/lib/db';

export interface TrajectoryRecord {
  queryText: string;
  resultId: string;
  wasUseful: boolean;
  context?: {
    searchType?: 'semantic' | 'keyword' | 'hybrid';
    score?: number;
    userAction?: string;
    timeSpent?: number;
    source?: string;
    severity?: string;
  };
}

export interface TrajectoryStats {
  totalRecords: number;
  usefulCount: number;
  notUsefulCount: number;
  usefulRate: number;
  topUsefulSources: { source: string; count: number }[];
  recentTrend: 'improving' | 'declining' | 'stable';
}

/**
 * Record a search trajectory (which results were useful)
 */
export async function recordSearchTrajectory(trajectory: TrajectoryRecord): Promise<void> {
  if (!isDbEnabled) return;

  try {
    // Check if result exists
    const result = await queryOne<{ id: string }>(
      'SELECT id FROM "CrawlResult" WHERE id = $1',
      [trajectory.resultId]
    );

    if (!result) {
      console.warn(`[Trajectory] Result ${trajectory.resultId} not found, skipping`);
      return;
    }

    // Record trajectory
    await execute(
      `INSERT INTO search_trajectory (query_text, result_id, was_useful, context, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [trajectory.queryText, trajectory.resultId, trajectory.wasUseful, JSON.stringify(trajectory.context || {})]
    );

    console.log(`[Trajectory] Recorded: ${trajectory.wasUseful ? 'useful' : 'not useful'} for ${trajectory.resultId}`);
  } catch (error) {
    console.error('[Trajectory] Error recording:', error);
    throw error;
  }
}

/**
 * Batch record multiple trajectories
 */
export async function recordBatchTrajectories(trajectories: TrajectoryRecord[]): Promise<void> {
  for (const trajectory of trajectories) {
    await recordSearchTrajectory(trajectory);
  }
}

/**
 * Get trajectory statistics for a time period
 */
export async function getTrajectoryStats(days: number = 30): Promise<TrajectoryStats> {
  if (!isDbEnabled) {
    return {
      totalRecords: 0,
      usefulCount: 0,
      notUsefulCount: 0,
      usefulRate: 0,
      topUsefulSources: [],
      recentTrend: 'stable'
    };
  }

  try {
    // Get total counts
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM search_trajectory
       WHERE created_at > NOW() - INTERVAL '${days} days'`
    );
    const totalRecords = Number(totalResult[0]?.count || 0);

    // Get useful counts
    const usefulResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM search_trajectory
       WHERE was_useful = true AND created_at > NOW() - INTERVAL '${days} days'`
    );
    const usefulCount = Number(usefulResult[0]?.count || 0);
    const notUsefulCount = totalRecords - usefulCount;

    // Get top useful sources from context
    const sourceResult = await query<{ source: string; count: string }>(
      `SELECT context->>'source' as source, COUNT(*) as count
       FROM search_trajectory
       WHERE was_useful = true AND created_at > NOW() - INTERVAL '${days} days' AND context->>'source' IS NOT NULL
       GROUP BY context->>'source'
       ORDER BY count DESC
       LIMIT 5`
    );
    const topUsefulSources = sourceResult.map(r => ({
      source: r.source || 'unknown',
      count: Number(r.count)
    }));

    // Calculate recent trend (last 7 days vs previous 7 days)
    const recentUseful = await query<{ rate: number }>(
      `SELECT COALESCE(AVG(CASE WHEN was_useful THEN 1.0 ELSE 0.0 END), 0) as rate
       FROM search_trajectory
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );

    const previousUseful = await query<{ rate: number }>(
      `SELECT COALESCE(AVG(CASE WHEN was_useful THEN 1.0 ELSE 0.0 END), 0) as rate
       FROM search_trajectory
       WHERE created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days'`
    );

    const recentRate = Number(recentUseful[0]?.rate || 0);
    const previousRate = Number(previousUseful[0]?.rate || 0);

    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentRate > previousRate + 0.05) recentTrend = 'improving';
    else if (recentRate < previousRate - 0.05) recentTrend = 'declining';

    return {
      totalRecords,
      usefulCount,
      notUsefulCount,
      usefulRate: totalRecords > 0 ? usefulCount / totalRecords : 0,
      topUsefulSources,
      recentTrend
    };
  } catch (error) {
    console.error('[Trajectory] Error getting stats:', error);
    return {
      totalRecords: 0,
      usefulCount: 0,
      notUsefulCount: 0,
      usefulRate: 0,
      topUsefulSources: [],
      recentTrend: 'stable'
    };
  }
}

/**
 * Clean up old trajectories beyond retention period
 */
export async function cleanupOldTrajectories(retentionDays: number = 30): Promise<number> {
  if (!isDbEnabled) return 0;

  try {
    const result = await execute(
      `DELETE FROM search_trajectory WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
    );

    console.log(`[Trajectory] Cleaned up ${result} old records`);
    return result;
  } catch (error) {
    console.error('[Trajectory] Error cleaning up:', error);
    return 0;
  }
}

/**
 * Get trajectories for ruvector optimization
 * Returns data in format suitable for ruvector_record_trajectory
 */
export async function getTrajectoryDataForOptimization(): Promise<{
  queryText: string;
  resultId: string;
  wasUseful: boolean;
  context: Record<string, unknown>;
}[]> {
  if (!isDbEnabled) return [];

  try {
    const trajectories = await query<{
      query_text: string;
      result_id: string;
      was_useful: boolean;
      context: Record<string, unknown>;
    }>(
      `SELECT query_text, result_id, was_useful, context
       FROM search_trajectory
       WHERE created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC`
    );

    return trajectories.map(t => ({
      queryText: t.query_text,
      resultId: t.result_id,
      wasUseful: t.was_useful,
      context: t.context || {}
    }));
  } catch (error) {
    console.error('[Trajectory] Error getting data for optimization:', error);
    return [];
  }
}

/**
 * Record ARC progress snapshot
 */
export async function recordARCProgress(data: {
  source: 'official' | 'kaggle' | 'github';
  topScore: number;
  gapToHuman: number;
  totalTeams?: number;
  significantEvents?: unknown[];
}): Promise<void> {
  if (!isDbEnabled) return;

  try {
    await execute(
      `INSERT INTO arc_progress (source, top_score, gap_to_human, total_teams, significant_events, timestamp)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        data.source,
        data.topScore,
        data.gapToHuman,
        data.totalTeams || 0,
        JSON.stringify(data.significantEvents || [])
      ]
    );
    console.log(`[ARC Progress] Recorded ${data.source}: ${(data.topScore * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('[ARC Progress] Error recording:', error);
  }
}

/**
 * Get ARC progress history
 */
export async function getARCProgressHistory(days: number = 30): Promise<{
  source: string;
  topScore: number;
  gapToHuman: number;
  timestamp: Date;
}[]> {
  if (!isDbEnabled) return [];

  try {
    const history = await query<{
      source: string;
      top_score: number;
      gap_to_human: number;
      timestamp: Date;
    }>(
      `SELECT source, top_score, gap_to_human, timestamp
       FROM arc_progress
       WHERE timestamp > NOW() - INTERVAL '${days} days'
       ORDER BY timestamp DESC`
    );

    return history.map(h => ({
      source: h.source,
      topScore: h.top_score,
      gapToHuman: h.gap_to_human,
      timestamp: h.timestamp
    }));
  } catch (error) {
    console.error('[ARC Progress] Error getting history:', error);
    return [];
  }
}
