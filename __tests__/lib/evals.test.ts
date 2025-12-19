import { computeEvalMetrics } from '@/lib/evals/metrics';

describe('eval metrics', () => {
  it('computes confusion matrix and metrics', () => {
    const rows = [
      { feedbackType: 'relevant', score: 0.6 },
      { feedbackType: 'critical', score: 0.7 },
      { feedbackType: 'noise', score: 0.4 },
      { feedbackType: 'false_positive', score: 0.1 }
    ];

    const result = computeEvalMetrics(rows, 0.5);
    expect(result.counts.tp).toBe(2);
    expect(result.counts.fp).toBe(0);
    expect(result.counts.fn).toBe(0);
    expect(result.counts.tn).toBe(2);
    expect(result.metrics.precision).toBe(1);
    expect(result.metrics.recall).toBe(1);
  });
});
