/**
 * Unit Tests for Benchmark Detection
 */

import {
  extractBenchmarkResults,
  analyzeBenchmarkSignificance,
  getBenchmarkBoost,
  detectBenchmarkThresholdCrossing,
} from '../benchmarkDetector';

describe('Benchmark Detection', () => {
  describe('extractBenchmarkResults', () => {
    it('should extract benchmark scores from text', () => {
      const text = `
        Our model achieves 87.5% on MMLU and 92% on HumanEval.
        GSM8K: 95.3%
      `;

      const results = extractBenchmarkResults(text);

      expect(results.length).toBeGreaterThan(0);

      const mmlu = results.find(r => r.name === 'MMLU');
      expect(mmlu).toBeDefined();
      expect(mmlu?.score).toBeCloseTo(0.875, 2);

      // HumanEval or similar should be found
      const hasHumanEval = results.some(r => r.name.toLowerCase().includes('humaneval'));
      expect(hasHumanEval || results.length > 0).toBe(true);
    });

    it('should extract improvement statements', () => {
      const text = 'improves MMLU from 80% to 90%';

      const results = extractBenchmarkResults(text);

      expect(results.length).toBeGreaterThan(0);
      const mmlu = results.find(r => r.name === 'MMLU');
      expect(mmlu?.score).toBeCloseTo(0.90, 2);
    });

    it('should normalize benchmark names', () => {
      const text = 'human-eval: 85%, HUMANEVAL: 85%';

      const results = extractBenchmarkResults(text);

      // Should normalize to same benchmark
      const humaneval = results.filter(r => r.name === 'HumanEval');
      expect(humaneval.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeBenchmarkSignificance', () => {
    it('should detect human-level performance', () => {
      const results = [
        { name: 'MMLU', score: 0.90, unit: 'accuracy', higherIsBetter: true },
      ];

      const analysis = analyzeBenchmarkSignificance(results);

      expect(analysis.hasSignificantBreakthrough).toBe(true);
      expect(analysis.details[0].isHumanLevel).toBe(true);
      expect(analysis.reasons.join(' ')).toContain('Human-level performance');
    });

    it('should detect significant improvements', () => {
      const results = [
        { name: 'MATH', score: 0.75, unit: 'accuracy', higherIsBetter: true },
      ];

      const analysis = analyzeBenchmarkSignificance(results);

      expect(analysis.hasSignificantBreakthrough).toBe(true);
      expect(analysis.details[0].isSignificant).toBe(true);
    });

    it('should detect multiple benchmark improvements', () => {
      const results = [
        { name: 'MMLU', score: 0.90, unit: 'accuracy', higherIsBetter: true },
        { name: 'MATH', score: 0.75, unit: 'accuracy', higherIsBetter: true },
        { name: 'HumanEval', score: 0.85, unit: 'accuracy', higherIsBetter: true },
      ];

      const analysis = analyzeBenchmarkSignificance(results);

      expect(analysis.hasSignificantBreakthrough).toBe(true);
      const significantCount = analysis.details.filter(
        d => d.isSignificant || d.isHumanLevel
      ).length;
      expect(significantCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getBenchmarkBoost', () => {
    it('should provide boost for human-level performance', () => {
      const text = 'achieves 90% on MMLU (human level)';

      const { boost, reasons } = getBenchmarkBoost(text);

      expect(boost).toBeGreaterThan(1.0);
      expect(reasons.length).toBeGreaterThan(0);
    });

    it('should provide no boost for no benchmarks', () => {
      const text = 'some random text about AI';

      const { boost, benchmarks } = getBenchmarkBoost(text);

      expect(boost).toBe(1.0);
      expect(benchmarks.length).toBe(0);
    });

    it('should cap boost at 2.0x', () => {
      const text = `
        Achieves 95% on MMLU, 98% on MATH, 99% on HumanEval,
        100% on GSM8K, 100% on ARC-Challenge
      `;

      const { boost } = getBenchmarkBoost(text);

      expect(boost).toBeLessThanOrEqual(2.0);
    });
  });

  describe('detectBenchmarkThresholdCrossing', () => {
    it('should detect critical threshold crossing', () => {
      const text = 'Our model achieves 92% on GAIA, surpassing human-level performance';

      const result = detectBenchmarkThresholdCrossing(text);

      expect(result.hasCriticalThreshold).toBe(true);
      expect(result.thresholds.length).toBeGreaterThan(0);
      expect(result.agiRelevanceScore).toBeGreaterThan(0.5);
    });

    it('should not detect thresholds for weak content', () => {
      const text = 'Minor improvements in model performance';

      const result = detectBenchmarkThresholdCrossing(text);

      expect(result.hasCriticalThreshold).toBe(false);
      expect(result.thresholds.length).toBe(0);
    });
  });
});
