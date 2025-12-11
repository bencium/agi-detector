/**
 * Self-Learning System for AGI Detector
 * Integrates with ruvector-postgres for automatic search optimization
 */

export {
  recordSearchTrajectory,
  recordBatchTrajectories,
  getTrajectoryStats,
  cleanupOldTrajectories,
  getTrajectoryDataForOptimization,
  recordARCProgress,
  getARCProgressHistory
} from './trajectory-recorder';

export type { TrajectoryRecord, TrajectoryStats } from './trajectory-recorder';

export {
  recordFeedback,
  getFeedbackStats,
  analyzeFeedbackPatterns,
  calculateFeedbackImpact,
  getLearningRecommendations,
  recordSecrecyPattern,
  getRecentSecrecyPatterns
} from './feedback-handler';

export type { UserFeedback, FeedbackStats, FeedbackImpact, FeedbackType } from './feedback-handler';
