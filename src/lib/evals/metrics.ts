export type FeedbackRow = {
  feedbackType: string;
  score: number;
  severity?: string | null;
  confidence?: number | null;
};

export type EvalMetrics = {
  counts: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
  avgConfidence?: number | null;
  total: number;
};

const POSITIVE = new Set(['relevant', 'critical']);
const NEGATIVE = new Set(['noise', 'false_positive']);

export function computeEvalMetrics(rows: FeedbackRow[], threshold: number): EvalMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  rows.forEach(row => {
    const actualPositive = POSITIVE.has(row.feedbackType);
    const actualNegative = NEGATIVE.has(row.feedbackType);
    const predictedPositive = row.score >= threshold;

    if (actualPositive && predictedPositive) tp += 1;
    else if (actualPositive && !predictedPositive) fn += 1;
    else if (actualNegative && predictedPositive) fp += 1;
    else if (actualNegative && !predictedPositive) tn += 1;

    if (typeof row.confidence === 'number') {
      totalConfidence += row.confidence;
      confidenceCount += 1;
    }
  });

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0;

  return {
    counts: { tp, fp, tn, fn },
    metrics: { precision, recall, f1, accuracy, falsePositiveRate, falseNegativeRate },
    avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : null,
    total: rows.length
  };
}
