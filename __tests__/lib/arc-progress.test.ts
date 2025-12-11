/**
 * Tests for AGI Progress Calculation
 * Tests ARC-AGI benchmark progress tracking and status determination
 */

import { calculateAGIProgress, arcDataToCrawlResults, ARCAggregatedData, ARCSummary } from '@/lib/arc-sources/index';

describe('AGI Progress Calculation', () => {
  describe('calculateAGIProgress', () => {
    it('should return baseline status for scores at baseline (4%)', () => {
      const result = calculateAGIProgress(0.04);

      expect(result.status).toBe('baseline');
      expect(result.progress).toBeCloseTo(0, 1);
      expect(result.description).toContain('Baseline');
    });

    it('should return baseline for scores below baseline', () => {
      const result = calculateAGIProgress(0.02);

      expect(result.status).toBe('baseline');
      expect(result.progress).toBe(0);
    });

    it('should return improving status for scores 10-25%', () => {
      const result = calculateAGIProgress(0.10);

      expect(result.status).toBe('improving');
      expect(result.description).toContain('improvement');
    });

    it('should return significant status for scores 25-50%', () => {
      const result = calculateAGIProgress(0.30);

      expect(result.status).toBe('significant');
      expect(result.description).toContain('Significant');
    });

    it('should return breakthrough status for scores 50-75%', () => {
      const result = calculateAGIProgress(0.55);

      expect(result.status).toBe('breakthrough');
      expect(result.description).toContain('breakthrough');
    });

    it('should return near_agi status for scores 75-100%', () => {
      const result = calculateAGIProgress(0.80);

      expect(result.status).toBe('near_agi');
      expect(result.description).toContain('Near AGI');
    });

    it('should return agi status for perfect score', () => {
      const result = calculateAGIProgress(1.0);

      expect(result.status).toBe('agi');
      expect(result.description).toContain('AGI achieved');
    });

    it('should calculate correct progress percentage', () => {
      // 4% is 0 progress (baseline)
      // 100% is 100% progress (AGI)
      // The formula: (score - 0.04) / (1 - 0.04) * 100

      // At baseline (4%)
      expect(calculateAGIProgress(0.04).progress).toBeCloseTo(0, 1);

      // At 52% score -> (0.52 - 0.04) / 0.96 * 100 = 50%
      expect(calculateAGIProgress(0.52).progress).toBeCloseTo(50, 1);

      // At 100% score -> 100% progress
      expect(calculateAGIProgress(1.0).progress).toBeCloseTo(100, 1);
    });

    it('should handle edge cases', () => {
      // Zero score
      const zero = calculateAGIProgress(0);
      expect(zero.status).toBe('baseline');
      expect(zero.progress).toBe(0);

      // Slightly above threshold
      const justAbove = calculateAGIProgress(0.251);
      expect(justAbove.status).toBe('significant');

      // Exactly at threshold
      const exactHigh = calculateAGIProgress(0.75);
      expect(exactHigh.status).toBe('near_agi');
    });

    it('should cap progress at 100%', () => {
      const result = calculateAGIProgress(1.5);

      expect(result.progress).toBeLessThanOrEqual(100);
    });

    it('should not return negative progress', () => {
      const result = calculateAGIProgress(-0.1);

      expect(result.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Status boundaries', () => {
    it('should correctly classify all status boundaries', () => {
      const boundaries = [
        { score: 0.04, expected: 'baseline' },
        { score: 0.09, expected: 'baseline' },
        { score: 0.10, expected: 'improving' },
        { score: 0.24, expected: 'improving' },
        { score: 0.25, expected: 'significant' },
        { score: 0.49, expected: 'significant' },
        { score: 0.50, expected: 'breakthrough' },
        { score: 0.74, expected: 'breakthrough' },
        { score: 0.75, expected: 'near_agi' },
        { score: 0.99, expected: 'near_agi' },
        { score: 1.00, expected: 'agi' }
      ];

      boundaries.forEach(({ score, expected }) => {
        const result = calculateAGIProgress(score);
        expect(result.status).toBe(expected);
      });
    });
  });

  describe('arcDataToCrawlResults', () => {
    const mockSummary: ARCSummary = {
      topScore: 0.15,
      humanBaseline: 1.0,
      gapToHuman: 0.85,
      totalTeams: 50,
      recentActivity: 10,
      significantEvents: []
    };

    it('should create summary crawl result', () => {
      const mockData: ARCAggregatedData = {
        official: null,
        kaggle: [],
        github: null,
        timestamp: '2025-01-15T10:00:00Z',
        summary: mockSummary
      };

      const results = arcDataToCrawlResults(mockData);

      expect(results.length).toBeGreaterThan(0);

      const summaryResult = results.find(r => r.metadata?.type === 'benchmark_summary');
      expect(summaryResult).toBeDefined();
      expect(summaryResult?.title).toContain('ARC-AGI Progress Summary');
      expect(summaryResult?.metadata.topScore).toBe(0.15);
    });

    it('should include correct gap calculation in content', () => {
      const mockData: ARCAggregatedData = {
        official: null,
        kaggle: [],
        github: null,
        timestamp: '2025-01-15T10:00:00Z',
        summary: { ...mockSummary, topScore: 0.25, gapToHuman: 0.75 }
      };

      const results = arcDataToCrawlResults(mockData);
      const summaryResult = results.find(r => r.metadata?.type === 'benchmark_summary');

      expect(summaryResult?.content).toContain('25.0%');
      expect(summaryResult?.content).toContain('75.0%');
    });

    it('should include metadata with all required fields', () => {
      const mockData: ARCAggregatedData = {
        official: null,
        kaggle: [],
        github: null,
        timestamp: '2025-01-15T10:00:00Z',
        summary: mockSummary
      };

      const results = arcDataToCrawlResults(mockData);
      const summaryResult = results.find(r => r.metadata?.type === 'benchmark_summary');

      expect(summaryResult?.metadata).toHaveProperty('source', 'ARC-AGI Aggregated');
      expect(summaryResult?.metadata).toHaveProperty('timestamp');
      expect(summaryResult?.metadata).toHaveProperty('topScore');
      expect(summaryResult?.metadata).toHaveProperty('gap');
      expect(summaryResult?.metadata).toHaveProperty('eventCount');
    });

    it('should handle data with official leaderboard', () => {
      const mockData: ARCAggregatedData = {
        official: {
          topScore: 0.12,
          entries: [
            { rank: 1, team: 'Team A', score: 0.12, submissionDate: '2025-01-01' },
            { rank: 2, team: 'Team B', score: 0.10, submissionDate: '2025-01-01' }
          ],
          timestamp: '2025-01-15T10:00:00Z',
          humanBaseline: 1.0,
          gap: 0.88
        },
        kaggle: [],
        github: null,
        timestamp: '2025-01-15T10:00:00Z',
        summary: mockSummary
      };

      const results = arcDataToCrawlResults(mockData);

      // Should include official leaderboard entries + summary
      expect(results.length).toBeGreaterThan(1);
    });

    it('should handle empty data gracefully', () => {
      const emptyData: ARCAggregatedData = {
        official: null,
        kaggle: [],
        github: null,
        timestamp: '2025-01-15T10:00:00Z',
        summary: {
          topScore: 0,
          humanBaseline: 1.0,
          gapToHuman: 1.0,
          totalTeams: 0,
          recentActivity: 0,
          significantEvents: []
        }
      };

      const results = arcDataToCrawlResults(emptyData);

      // Should still have at least the summary
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Real-world ARC score scenarios', () => {
    it('should correctly assess current SOTA (o3-preview at ~4%)', () => {
      const result = calculateAGIProgress(0.04);

      expect(result.status).toBe('baseline');
      expect(result.description).toContain('current AI capabilities');
    });

    it('should flag significant improvement if scores jump to 15%', () => {
      const result = calculateAGIProgress(0.15);

      expect(result.status).toBe('improving');
      expect(result.progress).toBeGreaterThan(0);
    });

    it('should alert for major breakthrough at 30%', () => {
      const result = calculateAGIProgress(0.30);

      expect(result.status).toBe('significant');
      expect(result.description).toContain('Significant');
    });

    it('should trigger high alert at 60%', () => {
      const result = calculateAGIProgress(0.60);

      expect(result.status).toBe('breakthrough');
    });

    it('should indicate near-AGI at 85%', () => {
      const result = calculateAGIProgress(0.85);

      expect(result.status).toBe('near_agi');
      expect(result.description).toContain('exceeds most humans');
    });
  });

  describe('Progress tracking over time', () => {
    it('should show increasing progress with score improvements', () => {
      const scores = [0.04, 0.08, 0.15, 0.25, 0.40, 0.60];
      const progressValues = scores.map(s => calculateAGIProgress(s).progress);

      // Each progress should be greater than the last
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }
    });

    it('should show status escalation with major jumps', () => {
      const statuses = [0.04, 0.15, 0.30, 0.55, 0.80, 1.0].map(
        s => calculateAGIProgress(s).status
      );

      expect(statuses).toEqual([
        'baseline',
        'improving',
        'significant',
        'breakthrough',
        'near_agi',
        'agi'
      ]);
    });
  });
});
