/**
 * Accuracy Metrics Calculation Service
 *
 * Calculates precision, recall, F1 score, and other accuracy metrics
 * based on ground truth validation data.
 */

import { prisma } from '../prisma';

export interface AccuracyMetricsResult {
  // Raw counts
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  totalReviewed: number;

  // Calculated metrics (0-1)
  precision: number; // TP / (TP + FP) - How many detected AGI signals are real?
  recall: number; // TP / (TP + FN) - How many real AGI signals did we catch?
  f1Score: number; // Harmonic mean of precision and recall
  accuracy: number; // (TP + TN) / Total - Overall correctness
  falsePositiveRate: number; // FP / (FP + TN) - How often do we cry wolf?
  falseNegativeRate: number; // FN / (FN + TP) - How often do we miss real signals?

  // Additional context
  avgConfidence: number;
  period: string;
  timestamp: Date;
}

/**
 * Calculate accuracy metrics from ground truth labeled data
 */
export async function calculateAccuracyMetrics(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'all_time'
): Promise<AccuracyMetricsResult> {
  const startDate = getStartDateForPeriod(period);

  // Fetch all analyses with ground truth labels
  const analyses = await prisma.analysisResult.findMany({
    where: {
      groundTruthLabel: { not: null },
      reviewedAt: startDate ? { gte: startDate } : undefined,
    },
    select: {
      groundTruthLabel: true,
      confidence: true,
    },
  });

  // Count confusion matrix
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  analyses.forEach((analysis) => {
    switch (analysis.groundTruthLabel) {
      case 'true_positive':
        truePositives++;
        break;
      case 'false_positive':
        falsePositives++;
        break;
      case 'true_negative':
        trueNegatives++;
        break;
      case 'false_negative':
        falseNegatives++;
        break;
    }
  });

  const totalReviewed = analyses.length;

  // Calculate metrics (with zero-division protection)
  const precision = truePositives + falsePositives > 0
    ? truePositives / (truePositives + falsePositives)
    : 0;

  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0;

  const f1Score = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  const accuracy = totalReviewed > 0
    ? (truePositives + trueNegatives) / totalReviewed
    : 0;

  const falsePositiveRate = falsePositives + trueNegatives > 0
    ? falsePositives / (falsePositives + trueNegatives)
    : 0;

  const falseNegativeRate = falseNegatives + truePositives > 0
    ? falseNegatives / (falseNegatives + truePositives)
    : 0;

  // Calculate average confidence
  const avgConfidence = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.length
    : 0;

  const result: AccuracyMetricsResult = {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    totalReviewed,
    precision,
    recall,
    f1Score,
    accuracy,
    falsePositiveRate,
    falseNegativeRate,
    avgConfidence,
    period,
    timestamp: new Date(),
  };

  // Save to database
  try {
    await prisma.accuracyMetrics.create({
      data: {
        period,
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives,
        precision,
        recall,
        f1Score,
        accuracy,
        falsePositiveRate,
        falseNegativeRate,
        totalReviewed,
        avgConfidence,
      },
    });
  } catch (error) {
    console.warn('[Metrics] Failed to save accuracy metrics to database:', error);
    // Continue even if DB save fails
  }

  return result;
}

/**
 * Get start date based on period
 */
function getStartDateForPeriod(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'daily':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all_time':
    default:
      return null;
  }
}

/**
 * Update ground truth label for an analysis
 */
export async function updateGroundTruth(
  analysisId: string,
  label: 'true_positive' | 'false_positive' | 'true_negative' | 'false_negative',
  groundTruthScore: number,
  notes?: string,
  reviewedBy?: string
): Promise<void> {
  await prisma.analysisResult.update({
    where: { id: analysisId },
    data: {
      groundTruthLabel: label,
      groundTruthScore,
      groundTruthNotes: notes,
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Get confusion matrix breakdown
 */
export async function getConfusionMatrix(): Promise<{
  matrix: number[][];
  labels: string[];
  total: number;
}> {
  const metrics = await calculateAccuracyMetrics('all_time');

  return {
    matrix: [
      [metrics.truePositives, metrics.falseNegatives], // Actual Positive
      [metrics.falsePositives, metrics.trueNegatives], // Actual Negative
    ],
    labels: ['Predicted Positive', 'Predicted Negative'],
    total: metrics.totalReviewed,
  };
}

/**
 * Generate metrics report as text
 */
export function formatMetricsReport(metrics: AccuracyMetricsResult): string {
  return `
=== AGI Detection Accuracy Metrics (${metrics.period}) ===
Generated: ${metrics.timestamp.toISOString()}

📊 Confusion Matrix:
┌─────────────────┬─────────┬─────────┐
│                 │ Pred +  │ Pred -  │
├─────────────────┼─────────┼─────────┤
│ Actual AGI (+)  │ TP: ${metrics.truePositives.toString().padStart(3)}  │ FN: ${metrics.falseNegatives.toString().padStart(3)}  │
│ Not AGI (-)     │ FP: ${metrics.falsePositives.toString().padStart(3)}  │ TN: ${metrics.trueNegatives.toString().padStart(3)}  │
└─────────────────┴─────────┴─────────┘
Total Reviewed: ${metrics.totalReviewed}

🎯 Key Metrics:
• Precision:     ${(metrics.precision * 100).toFixed(1)}% (of detected, how many are real?)
• Recall:        ${(metrics.recall * 100).toFixed(1)}% (of real AGI signals, how many caught?)
• F1 Score:      ${(metrics.f1Score * 100).toFixed(1)}% (balanced accuracy)
• Accuracy:      ${(metrics.accuracy * 100).toFixed(1)}% (overall correctness)

⚠️  Error Rates:
• False Positive Rate: ${(metrics.falsePositiveRate * 100).toFixed(1)}% (crying wolf)
• False Negative Rate: ${(metrics.falseNegativeRate * 100).toFixed(1)}% (missing signals)

📈 Confidence:
• Average: ${(metrics.avgConfidence * 100).toFixed(1)}%

🎯 Interpretation:
${getInterpretation(metrics)}
`;
}

function getInterpretation(metrics: AccuracyMetricsResult): string {
  const interpretations: string[] = [];

  if (metrics.totalReviewed === 0) {
    return '⚠️  No ground truth data available. Start reviewing analyses to generate metrics.';
  }

  if (metrics.precision < 0.5) {
    interpretations.push('⚠️  LOW PRECISION: High false positive rate, tighten detection thresholds');
  } else if (metrics.precision >= 0.85) {
    interpretations.push('✅ EXCELLENT PRECISION: Low false positive rate');
  }

  if (metrics.recall < 0.5) {
    interpretations.push('⚠️  LOW RECALL: Missing many AGI signals, lower thresholds');
  } else if (metrics.recall >= 0.85) {
    interpretations.push('✅ EXCELLENT RECALL: Catching most AGI signals');
  }

  if (metrics.f1Score >= 0.80) {
    interpretations.push('🎯 EXCELLENT F1: Well-balanced detection system');
  } else if (metrics.f1Score < 0.60) {
    interpretations.push('⚠️  POOR F1: System needs retuning');
  }

  if (metrics.falsePositiveRate > 0.3) {
    interpretations.push('🚨 HIGH FALSE POSITIVE RATE: Consider keyword heuristics filter');
  }

  return interpretations.join('\n');
}

/**
 * Get latest metrics for a specific period
 */
export async function getLatestMetrics(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
): Promise<AccuracyMetricsResult | null> {
  const dbMetrics = await prisma.accuracyMetrics.findFirst({
    where: { period },
    orderBy: { timestamp: 'desc' },
  });

  if (!dbMetrics) {
    // Calculate fresh metrics if none exist
    return calculateAccuracyMetrics(period);
  }

  return {
    truePositives: dbMetrics.truePositives,
    falsePositives: dbMetrics.falsePositives,
    trueNegatives: dbMetrics.trueNegatives,
    falseNegatives: dbMetrics.falseNegatives,
    totalReviewed: dbMetrics.totalReviewed,
    precision: dbMetrics.precision,
    recall: dbMetrics.recall,
    f1Score: dbMetrics.f1Score,
    accuracy: dbMetrics.accuracy,
    falsePositiveRate: dbMetrics.falsePositiveRate,
    falseNegativeRate: dbMetrics.falseNegativeRate,
    avgConfidence: dbMetrics.avgConfidence || 0,
    period,
    timestamp: dbMetrics.timestamp,
  };
}
