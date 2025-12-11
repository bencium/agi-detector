/**
 * Tests for Severity Computation
 * Tests severity level determination from AGI detection scores
 */

import { severityForScore, computeSeverity, Severity } from '@/lib/severity';

describe('Severity Computation', () => {
  describe('severityForScore', () => {
    it('should return "none" for score 0', () => {
      expect(severityForScore(0)).toBe('none');
    });

    it('should return "low" for scores > 0 and < 0.3', () => {
      expect(severityForScore(0.01)).toBe('low');
      expect(severityForScore(0.1)).toBe('low');
      expect(severityForScore(0.29)).toBe('low');
    });

    it('should return "medium" for scores >= 0.3 and < 0.6', () => {
      expect(severityForScore(0.3)).toBe('medium');
      expect(severityForScore(0.45)).toBe('medium');
      expect(severityForScore(0.59)).toBe('medium');
    });

    it('should return "high" for scores >= 0.6 and < 0.8', () => {
      expect(severityForScore(0.6)).toBe('high');
      expect(severityForScore(0.7)).toBe('high');
      expect(severityForScore(0.79)).toBe('high');
    });

    it('should return "critical" for scores >= 0.8', () => {
      expect(severityForScore(0.8)).toBe('critical');
      expect(severityForScore(0.9)).toBe('critical');
      expect(severityForScore(1.0)).toBe('critical');
    });

    it('should handle edge cases at boundaries', () => {
      // Exact boundary values
      expect(severityForScore(0.3)).toBe('medium');
      expect(severityForScore(0.6)).toBe('high');
      expect(severityForScore(0.8)).toBe('critical');
    });

    it('should handle scores slightly above boundaries', () => {
      expect(severityForScore(0.30001)).toBe('medium');
      expect(severityForScore(0.60001)).toBe('high');
      expect(severityForScore(0.80001)).toBe('critical');
    });

    it('should handle negative scores', () => {
      // Negative scores should be treated as none
      expect(severityForScore(-0.1)).toBe('none');
      expect(severityForScore(-1)).toBe('none');
    });

    it('should handle scores > 1', () => {
      // Scores above 1 should still be critical
      expect(severityForScore(1.5)).toBe('critical');
      expect(severityForScore(100)).toBe('critical');
    });
  });

  describe('computeSeverity', () => {
    it('should return computed severity when no prior exists', () => {
      expect(computeSeverity(0.5)).toBe('medium');
      expect(computeSeverity(0.9)).toBe('critical');
      expect(computeSeverity(0.1)).toBe('low');
    });

    it('should return computed severity when null prior', () => {
      expect(computeSeverity(0.5, null)).toBe('medium');
    });

    it('should never decrease severity (keep prior when higher)', () => {
      // Prior is critical, score suggests low
      expect(computeSeverity(0.1, 'critical')).toBe('critical');

      // Prior is high, score suggests medium
      expect(computeSeverity(0.4, 'high')).toBe('high');

      // Prior is medium, score suggests low
      expect(computeSeverity(0.2, 'medium')).toBe('medium');
    });

    it('should increase severity when score is higher', () => {
      // Prior is low, score suggests critical
      expect(computeSeverity(0.9, 'low')).toBe('critical');

      // Prior is medium, score suggests high
      expect(computeSeverity(0.7, 'medium')).toBe('high');

      // Prior is low, score suggests medium
      expect(computeSeverity(0.4, 'low')).toBe('medium');
    });

    it('should maintain severity at same level', () => {
      expect(computeSeverity(0.5, 'medium')).toBe('medium');
      expect(computeSeverity(0.65, 'high')).toBe('high');
      expect(computeSeverity(0.85, 'critical')).toBe('critical');
    });

    it('should handle all severity transitions correctly', () => {
      const severities: Severity[] = ['none', 'low', 'medium', 'high', 'critical'];
      const testScores = [0, 0.15, 0.45, 0.7, 0.9];

      for (let priorIdx = 0; priorIdx < severities.length; priorIdx++) {
        for (let scoreIdx = 0; scoreIdx < testScores.length; scoreIdx++) {
          const prior = severities[priorIdx];
          const score = testScores[scoreIdx];
          const result = computeSeverity(score, prior);

          // Result should never be lower than prior
          const resultIdx = severities.indexOf(result);
          expect(resultIdx).toBeGreaterThanOrEqual(priorIdx);
        }
      }
    });

    it('should handle undefined prior as no prior', () => {
      expect(computeSeverity(0.5, undefined)).toBe('medium');
    });

    describe('ranking system', () => {
      it('should respect severity ordering: none < low < medium < high < critical', () => {
        // When going from none to any higher level
        expect(computeSeverity(0.1, 'none')).toBe('low');
        expect(computeSeverity(0.4, 'none')).toBe('medium');
        expect(computeSeverity(0.7, 'none')).toBe('high');
        expect(computeSeverity(0.9, 'none')).toBe('critical');
      });
    });
  });

  describe('Real-world AGI detection scenarios', () => {
    it('should return low severity for routine AI news', () => {
      // Typical AI improvement announcements score around 0.1-0.2
      expect(severityForScore(0.15)).toBe('low');
    });

    it('should return medium severity for notable AI advances', () => {
      // Significant but not alarming progress
      expect(severityForScore(0.4)).toBe('medium');
    });

    it('should return high severity for breakthrough announcements', () => {
      // Major capability jumps
      expect(severityForScore(0.65)).toBe('high');
    });

    it('should return critical severity for AGI-level indicators', () => {
      // Clear signs of human-level or beyond capabilities
      expect(severityForScore(0.85)).toBe('critical');
    });

    it('should escalate severity over time (never decrease)', () => {
      // Simulate accumulating evidence
      let severity: Severity = 'none';

      // First signal: minor
      severity = computeSeverity(0.2, severity);
      expect(severity).toBe('low');

      // Second signal: also minor (should stay low)
      severity = computeSeverity(0.15, severity);
      expect(severity).toBe('low');

      // Third signal: medium
      severity = computeSeverity(0.5, severity);
      expect(severity).toBe('medium');

      // Fourth signal: drops but severity stays
      severity = computeSeverity(0.3, severity);
      expect(severity).toBe('medium');

      // Fifth signal: high
      severity = computeSeverity(0.7, severity);
      expect(severity).toBe('high');

      // Final state should remain high
      expect(severity).toBe('high');
    });
  });
});
