/**
 * User Feedback Handler for Self-Learning
 * Captures user feedback on AGI analyses to improve future detection
 *
 * Feedback types:
 * - relevant: Correctly identified AGI-relevant content
 * - noise: False positive, not actually relevant
 * - false_positive: Incorrectly flagged as high risk
 * - critical: User confirms this is critically important
 */

import { query, queryOne, execute, isDbEnabled } from '@/lib/db';
import { recordSearchTrajectory } from './trajectory-recorder';

export type FeedbackType = 'relevant' | 'noise' | 'false_positive' | 'critical';

export interface UserFeedback {
  analysisId: string;
  relevance: FeedbackType;
  notes?: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  relevantCount: number;
  noiseCount: number;
  falsePositiveCount: number;
  criticalCount: number;
  feedbackRate: number;
  accuracyEstimate: number;
}

export interface FeedbackImpact {
  adjustedScore: number;
  confidenceBoost: number;
  shouldRetrain: boolean;
  recommendation: string;
}

interface AnalysisWithCrawl {
  id: string;
  crawlId: string;
  score: number;
  severity: string | null;
  title: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Record user feedback on an analysis
 */
export async function recordFeedback(feedback: UserFeedback): Promise<void> {
  if (!isDbEnabled) return;

  try {
    // Verify analysis exists and get crawl data
    const analysis = await queryOne<AnalysisWithCrawl>(
      `SELECT ar.id, ar."crawlId", ar.score, ar.severity, cr.title, cr.metadata
       FROM "AnalysisResult" ar
       JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
       WHERE ar.id = $1`,
      [feedback.analysisId]
    );

    if (!analysis) {
      throw new Error(`Analysis ${feedback.analysisId} not found`);
    }

    // Record feedback with upsert
    await execute(
      `INSERT INTO user_feedback (analysis_id, relevance, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (analysis_id) DO UPDATE
       SET relevance = $2, notes = $3, created_at = NOW()`,
      [feedback.analysisId, feedback.relevance, feedback.notes || '']
    );

    // Also record as search trajectory for learning
    await recordSearchTrajectory({
      queryText: analysis.title,
      resultId: analysis.crawlId,
      wasUseful: feedback.relevance === 'relevant' || feedback.relevance === 'critical',
      context: {
        source: (analysis.metadata as Record<string, string>)?.source || 'unknown',
        score: analysis.score,
        userAction: `feedback_${feedback.relevance}`,
        severity: analysis.severity || 'unknown'
      }
    });

    console.log(`[Feedback] Recorded: ${feedback.relevance} for analysis ${feedback.analysisId}`);
  } catch (error) {
    console.error('[Feedback] Error recording:', error);
    throw error;
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  if (!isDbEnabled) {
    return {
      totalFeedback: 0,
      relevantCount: 0,
      noiseCount: 0,
      falsePositiveCount: 0,
      criticalCount: 0,
      feedbackRate: 0,
      accuracyEstimate: 0
    };
  }

  try {
    // Get feedback counts by type
    const counts = await query<{ relevance: string; count: string }>(
      `SELECT relevance, COUNT(*) as count
       FROM user_feedback
       GROUP BY relevance`
    );

    const countMap = counts.reduce((acc, c) => {
      acc[c.relevance] = Number(c.count);
      return acc;
    }, {} as Record<string, number>);

    // Get total analyses count
    const totalAnalysesResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM "AnalysisResult"'
    );
    const totalAnalyses = Number(totalAnalysesResult[0]?.count || 0);

    // Calculate stats
    const totalFeedback = Object.values(countMap).reduce((a, b) => a + b, 0);
    const relevantCount = countMap['relevant'] || 0;
    const noiseCount = countMap['noise'] || 0;
    const falsePositiveCount = countMap['false_positive'] || 0;
    const criticalCount = countMap['critical'] || 0;

    // Accuracy estimate: (relevant + critical) / total feedback
    const accuracyEstimate = totalFeedback > 0
      ? (relevantCount + criticalCount) / totalFeedback
      : 0;

    return {
      totalFeedback,
      relevantCount,
      noiseCount,
      falsePositiveCount,
      criticalCount,
      feedbackRate: totalAnalyses > 0 ? totalFeedback / totalAnalyses : 0,
      accuracyEstimate
    };
  } catch (error) {
    console.error('[Feedback] Error getting stats:', error);
    return {
      totalFeedback: 0,
      relevantCount: 0,
      noiseCount: 0,
      falsePositiveCount: 0,
      criticalCount: 0,
      feedbackRate: 0,
      accuracyEstimate: 0
    };
  }
}

/**
 * Analyze feedback patterns to identify improvements
 */
export async function analyzeFeedbackPatterns(): Promise<{
  commonFalsePositives: string[];
  commonMissedSignals: string[];
  sourceAccuracy: { source: string; accuracy: number }[];
  severityDistribution: { severity: string; accurate: number; total: number }[];
}> {
  if (!isDbEnabled) {
    return {
      commonFalsePositives: [],
      commonMissedSignals: [],
      sourceAccuracy: [],
      severityDistribution: []
    };
  }

  try {
    // Get false positive patterns (look at indicators that were marked as noise)
    const falsePositives = await query<{ indicator: string; count: string }>(
      `SELECT unnest(ar.indicators) as indicator, COUNT(*) as count
       FROM user_feedback uf
       JOIN "AnalysisResult" ar ON uf.analysis_id = ar.id
       WHERE uf.relevance IN ('noise', 'false_positive')
       GROUP BY indicator
       ORDER BY count DESC
       LIMIT 10`
    );

    // Accuracy by source
    const sourceAccuracy = await query<{
      source: string;
      accurate: string;
      total: string;
    }>(
      `SELECT
        cr.metadata->>'source' as source,
        SUM(CASE WHEN uf.relevance IN ('relevant', 'critical') THEN 1 ELSE 0 END) as accurate,
        COUNT(*) as total
       FROM user_feedback uf
       JOIN "AnalysisResult" ar ON uf.analysis_id = ar.id
       JOIN "CrawlResult" cr ON ar."crawlId" = cr.id
       GROUP BY cr.metadata->>'source'
       HAVING COUNT(*) > 5
       ORDER BY total DESC`
    );

    // Accuracy by severity
    const severityAccuracy = await query<{
      severity: string;
      accurate: string;
      total: string;
    }>(
      `SELECT
        ar.severity,
        SUM(CASE WHEN uf.relevance IN ('relevant', 'critical') THEN 1 ELSE 0 END) as accurate,
        COUNT(*) as total
       FROM user_feedback uf
       JOIN "AnalysisResult" ar ON uf.analysis_id = ar.id
       WHERE ar.severity IS NOT NULL
       GROUP BY ar.severity
       ORDER BY total DESC`
    );

    return {
      commonFalsePositives: falsePositives.map(fp => fp.indicator),
      commonMissedSignals: [],
      sourceAccuracy: sourceAccuracy.map(sa => ({
        source: sa.source || 'unknown',
        accuracy: Number(sa.total) > 0 ? Number(sa.accurate) / Number(sa.total) : 0
      })),
      severityDistribution: severityAccuracy.map(sa => ({
        severity: sa.severity || 'unknown',
        accurate: Number(sa.accurate),
        total: Number(sa.total)
      }))
    };
  } catch (error) {
    console.error('[Feedback] Error analyzing patterns:', error);
    return {
      commonFalsePositives: [],
      commonMissedSignals: [],
      sourceAccuracy: [],
      severityDistribution: []
    };
  }
}

/**
 * Calculate feedback impact on an analysis score
 */
export async function calculateFeedbackImpact(analysisId: string): Promise<FeedbackImpact | null> {
  if (!isDbEnabled) return null;

  try {
    const feedback = await query<{ relevance: string }>(
      'SELECT relevance FROM user_feedback WHERE analysis_id = $1',
      [analysisId]
    );

    if (feedback.length === 0) return null;

    const analysis = await queryOne<{ id: string; score: number }>(
      'SELECT id, score FROM "AnalysisResult" WHERE id = $1',
      [analysisId]
    );

    if (!analysis) return null;

    const relevance = feedback[0].relevance;
    let adjustedScore = analysis.score;
    let confidenceBoost = 0;
    let shouldRetrain = false;
    let recommendation = '';

    switch (relevance) {
      case 'critical':
        adjustedScore = Math.min(1, analysis.score * 1.2);
        confidenceBoost = 0.1;
        recommendation = 'User confirmed critical AGI indicator';
        break;

      case 'relevant':
        confidenceBoost = 0.05;
        recommendation = 'User confirmed relevance';
        break;

      case 'noise':
        adjustedScore = Math.max(0, analysis.score * 0.5);
        shouldRetrain = true;
        recommendation = 'User marked as noise - review detection criteria';
        break;

      case 'false_positive':
        adjustedScore = Math.max(0, analysis.score * 0.3);
        shouldRetrain = true;
        recommendation = 'False positive - retrain on similar content';
        break;
    }

    return {
      adjustedScore,
      confidenceBoost,
      shouldRetrain,
      recommendation
    };
  } catch (error) {
    console.error('[Feedback] Error calculating impact:', error);
    return null;
  }
}

/**
 * Get learning recommendations based on accumulated feedback
 */
export async function getLearningRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    const stats = await getFeedbackStats();
    const patterns = await analyzeFeedbackPatterns();

    if (stats.totalFeedback < 10) {
      recommendations.push('Need more user feedback to improve detection (current: ' + stats.totalFeedback + ', recommended: 10+)');
      return recommendations;
    }

    if (stats.accuracyEstimate < 0.7) {
      recommendations.push(`Detection accuracy is ${(stats.accuracyEstimate * 100).toFixed(0)}% - consider retraining`);
    }

    if (patterns.commonFalsePositives.length > 0) {
      recommendations.push(`Common false positive indicators: ${patterns.commonFalsePositives.slice(0, 3).join(', ')}`);
    }

    const lowAccuracySources = patterns.sourceAccuracy.filter(sa => sa.accuracy < 0.5);
    if (lowAccuracySources.length > 0) {
      recommendations.push(`Low accuracy sources: ${lowAccuracySources.map(s => s.source).join(', ')}`);
    }

    const criticalAccuracy = patterns.severityDistribution.find(s => s.severity === 'critical');
    if (criticalAccuracy && criticalAccuracy.total > 0) {
      const rate = criticalAccuracy.accurate / criticalAccuracy.total;
      if (rate < 0.8) {
        recommendations.push(`Critical severity accuracy is ${(rate * 100).toFixed(0)}% - review critical detection threshold`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Detection performance is good based on feedback');
    }

    return recommendations;
  } catch (error) {
    console.error('[Feedback] Error getting recommendations:', error);
    return ['Error analyzing feedback data'];
  }
}

/**
 * Record secrecy pattern for tracking
 */
export async function recordSecrecyPattern(pattern: {
  type: string;
  severity: string;
  source: string;
  description: string;
  evidence: string[];
  confidence: number;
}): Promise<void> {
  if (!isDbEnabled) return;

  try {
    await execute(
      `INSERT INTO secrecy_pattern (pattern_type, severity, source, description, evidence, confidence, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [pattern.type, pattern.severity, pattern.source, pattern.description, pattern.evidence, pattern.confidence]
    );
    console.log(`[Secrecy] Recorded pattern: ${pattern.type} (${pattern.severity})`);
  } catch (error) {
    console.error('[Secrecy] Error recording pattern:', error);
  }
}

/**
 * Get recent secrecy patterns
 */
export async function getRecentSecrecyPatterns(days: number = 7): Promise<{
  type: string;
  severity: string;
  source: string;
  description: string;
  detectedAt: Date;
}[]> {
  if (!isDbEnabled) return [];

  try {
    const patterns = await query<{
      pattern_type: string;
      severity: string;
      source: string;
      description: string;
      detected_at: Date;
    }>(
      `SELECT pattern_type, severity, source, description, detected_at
       FROM secrecy_pattern
       WHERE detected_at > NOW() - INTERVAL '${days} days'
       ORDER BY detected_at DESC`
    );

    return patterns.map(p => ({
      type: p.pattern_type,
      severity: p.severity,
      source: p.source,
      description: p.description,
      detectedAt: p.detected_at
    }));
  } catch (error) {
    console.error('[Secrecy] Error getting patterns:', error);
    return [];
  }
}
