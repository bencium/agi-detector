/**
 * Unit Tests for Accuracy Metrics
 */

import {
  calculateAccuracyMetrics,
  formatMetricsReport,
} from '../accuracyMetrics';

// Mock Prisma
jest.mock('../../prisma', () => ({
  prisma: {
    analysisResult: {
      findMany: jest.fn(),
    },
    accuracyMetrics: {
      create: jest.fn(),
    },
  },
}));

const { prisma } = require('../../prisma');

describe('Accuracy Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAccuracyMetrics', () => {
    it('should calculate precision, recall, and F1 score correctly', async () => {
      // Mock data: 7 TP, 3 FP, 2 TN, 1 FN
      const mockData = [
        ...Array(7).fill({ groundTruthLabel: 'true_positive', confidence: 0.9 }),
        ...Array(3).fill({ groundTruthLabel: 'false_positive', confidence: 0.8 }),
        ...Array(2).fill({ groundTruthLabel: 'true_negative', confidence: 0.7 }),
        ...Array(1).fill({ groundTruthLabel: 'false_negative', confidence: 0.6 }),
      ];

      (prisma.analysisResult.findMany as jest.Mock).mockResolvedValue(mockData);

      const metrics = await calculateAccuracyMetrics('all_time');

      // Assertions
      expect(metrics.truePositives).toBe(7);
      expect(metrics.falsePositives).toBe(3);
      expect(metrics.trueNegatives).toBe(2);
      expect(metrics.falseNegatives).toBe(1);
      expect(metrics.totalReviewed).toBe(13);

      // Precision = TP / (TP + FP) = 7 / 10 = 0.7
      expect(metrics.precision).toBeCloseTo(0.7, 2);

      // Recall = TP / (TP + FN) = 7 / 8 = 0.875
      expect(metrics.recall).toBeCloseTo(0.875, 2);

      // F1 = 2 * (P * R) / (P + R) = 2 * (0.7 * 0.875) / (0.7 + 0.875) ≈ 0.778
      expect(metrics.f1Score).toBeCloseTo(0.778, 2);

      // Accuracy = (TP + TN) / Total = 9 / 13 ≈ 0.692
      expect(metrics.accuracy).toBeCloseTo(0.692, 2);

      // FPR = FP / (FP + TN) = 3 / 5 = 0.6
      expect(metrics.falsePositiveRate).toBeCloseTo(0.6, 2);

      // FNR = FN / (FN + TP) = 1 / 8 = 0.125
      expect(metrics.falseNegativeRate).toBeCloseTo(0.125, 2);
    });

    it('should handle empty dataset', async () => {
      (prisma.analysisResult.findMany as jest.Mock).mockResolvedValue([]);

      const metrics = await calculateAccuracyMetrics('all_time');

      expect(metrics.totalReviewed).toBe(0);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1Score).toBe(0);
    });

    it('should calculate perfect precision and recall', async () => {
      const mockData = [
        ...Array(10).fill({ groundTruthLabel: 'true_positive', confidence: 0.95 }),
        ...Array(5).fill({ groundTruthLabel: 'true_negative', confidence: 0.9 }),
      ];

      (prisma.analysisResult.findMany as jest.Mock).mockResolvedValue(mockData);

      const metrics = await calculateAccuracyMetrics('all_time');

      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1Score).toBe(1.0);
      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.falsePositiveRate).toBe(0);
      expect(metrics.falseNegativeRate).toBe(0);
    });
  });

  describe('formatMetricsReport', () => {
    it('should format metrics report correctly', () => {
      const metrics = {
        truePositives: 10,
        falsePositives: 2,
        trueNegatives: 5,
        falseNegatives: 1,
        totalReviewed: 18,
        precision: 0.833,
        recall: 0.909,
        f1Score: 0.870,
        accuracy: 0.833,
        falsePositiveRate: 0.286,
        falseNegativeRate: 0.091,
        avgConfidence: 0.85,
        period: 'all_time',
        timestamp: new Date('2025-11-17'),
      };

      const report = formatMetricsReport(metrics);

      expect(report).toContain('AGI Detection Accuracy Metrics');
      expect(report).toContain('TP:  10');  // Note: extra space for padding
      expect(report).toContain('FP:   2');
      expect(report).toContain('FN:   1');
      expect(report).toContain('TN:   5');
      expect(report).toContain('83.3%'); // Precision
      expect(report).toContain('90.9%'); // Recall
      expect(report).toContain('87.0%'); // F1
    });
  });
});
