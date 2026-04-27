/**
 * Tests for ARC-AGI benchmark signal classification.
 * ARC is treated as benchmark evidence, not an AGI meter.
 */

import {
  calculateAGIProgress,
  classifyARCBenchmarkEvidence,
  arcDataToCrawlResults,
  ARCAggregatedData,
  ARCSummary
} from '@/lib/arc-sources/index';

describe('ARC benchmark signal calculation', () => {
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

    it('should return watch status for scores 10-25%', () => {
      const result = calculateAGIProgress(0.10);

      expect(result.status).toBe('watch');
      expect(result.description).toContain('watch signal');
    });

    it('should return notable status for scores 25-50%', () => {
      const result = calculateAGIProgress(0.30);

      expect(result.status).toBe('notable');
      expect(result.description).toContain('Notable');
    });

    it('should return strong status for scores 50-75%', () => {
      const result = calculateAGIProgress(0.55);

      expect(result.status).toBe('strong');
      expect(result.description).toContain('Strong');
    });

    it('should return exceptional status for scores 75-100%', () => {
      const result = calculateAGIProgress(0.80);

      expect(result.status).toBe('exceptional');
      expect(result.description).toContain('Exceptional');
    });

    it('should not return agi status for perfect score', () => {
      const result = calculateAGIProgress(1.0);

      expect(result.status).toBe('exceptional');
      expect(result.description).not.toMatch(/AGI achieved|Near AGI/i);
    });

    it('should calculate correct progress percentage', () => {
      // 4% is 0 progress (baseline)
      // 100% is full benchmark movement, not an AGI conclusion.
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
      expect(justAbove.status).toBe('notable');

      // Exactly at threshold
      const exactHigh = calculateAGIProgress(0.75);
      expect(exactHigh.status).toBe('exceptional');
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
        { score: 0.10, expected: 'watch' },
        { score: 0.24, expected: 'watch' },
        { score: 0.25, expected: 'notable' },
        { score: 0.49, expected: 'notable' },
        { score: 0.50, expected: 'strong' },
        { score: 0.74, expected: 'strong' },
        { score: 0.75, expected: 'exceptional' },
        { score: 0.99, expected: 'exceptional' },
        { score: 1.00, expected: 'exceptional' }
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
      significantEvents: [],
      sourceStatus: 'live',
      benchmarkEvidence: classifyARCBenchmarkEvidence(0.15, 'live')
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
      expect(summaryResult?.title).toContain('ARC-AGI Benchmark Signal');
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
      expect(summaryResult?.metadata).toHaveProperty('sourceStatus');
      expect(summaryResult?.metadata).toHaveProperty('benchmarkEvidence');
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
          gap: 0.88,
          sourceStatus: 'live',
          sourceUrl: 'https://arcprize.org/leaderboard'
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
          significantEvents: [],
          sourceStatus: 'unavailable',
          benchmarkEvidence: classifyARCBenchmarkEvidence(0, 'unavailable')
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
      expect(result.description).toContain('Baseline ARC-AGI');
    });

    it('should flag significant improvement if scores jump to 15%', () => {
      const result = calculateAGIProgress(0.15);

      expect(result.status).toBe('watch');
      expect(result.progress).toBeGreaterThan(0);
    });

    it('should mark notable benchmark movement at 30%', () => {
      const result = calculateAGIProgress(0.30);

      expect(result.status).toBe('notable');
      expect(result.description).toContain('Notable');
    });

    it('should trigger strong benchmark watch at 60%', () => {
      const result = calculateAGIProgress(0.60);

      expect(result.status).toBe('strong');
    });

    it('should indicate exceptional benchmark evidence at 85%', () => {
      const result = calculateAGIProgress(0.85);

      expect(result.status).toBe('exceptional');
      expect(result.description).not.toContain('AGI achieved');
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
        'watch',
        'notable',
        'strong',
        'exceptional',
        'exceptional'
      ]);
    });
  });

  describe('classifyARCBenchmarkEvidence', () => {
    it('keeps ARC evidence separate from AGI conclusions', () => {
      const result = classifyARCBenchmarkEvidence(1.0, 'live');

      expect(result.status).toBe('exceptional');
      expect(result.interpretation).not.toMatch(/AGI achieved|ASI/i);
      expect(result.limitations.join(' ')).toContain('not an AGI or ASI meter');
    });

    it('marks manual snapshots as weak evidence', () => {
      const result = classifyARCBenchmarkEvidence(0.2403, 'manual_snapshot');

      expect(result.sourceStatus).toBe('manual_snapshot');
      expect(result.evidenceConfidence).toBe('weak');
      expect(result.limitations.join(' ')).toContain('not fresh live evidence');
    });
  });
});
