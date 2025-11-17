/**
 * Unit Tests for Keyword Heuristics Filter
 */

import {
  analyzeKeywordHeuristics,
  quickFilter,
} from '../keywordHeuristics';

describe('Keyword Heuristics Filter', () => {
  describe('quickFilter', () => {
    it('should pass AGI-relevant content', () => {
      const title = 'Breakthrough in Recursive Self-Improvement';
      const content = 'AI system demonstrates ability to modify its own architecture...';

      expect(quickFilter(title, content)).toBe(true);
    });

    it('should reject marketing hype without substance', () => {
      const title = 'Revolutionary AI Product Launch!';
      const content = 'Sign up now for our game-changing AI solution. Free trial available!';

      expect(quickFilter(title, content)).toBe(false);
    });

    it('should reject non-AI content', () => {
      const title = 'New Restaurant Opens Downtown';
      const content = 'Delicious food and great atmosphere...';

      expect(quickFilter(title, content)).toBe(false);
    });
  });

  describe('analyzeKeywordHeuristics', () => {
    it('should detect strong AGI signals', () => {
      const title = 'Novel Algorithm Creation via Meta-Learning';
      const content = `
        System demonstrates emergent capability for autonomous research.
        Achieves 95% on MMLU benchmark with cross-domain generalization.
        Paper reference: arXiv:2024.12345
      `;

      const result = analyzeKeywordHeuristics(title, content);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.heuristicScore).toBeGreaterThan(0.6);
      expect(result.mediaNoiseScore).toBeLessThan(0.3);
      expect(result.detectedPatterns.positiveSignals.length).toBeGreaterThan(0);
    });

    it('should detect and reject marketing noise', () => {
      const title = 'Amazing Revolutionary Groundbreaking AI';
      const content = 'Unprecedented game-changing next-generation solution! Sign up now!';

      const result = analyzeKeywordHeuristics(title, content);

      expect(result.shouldAnalyze).toBe(false);
      expect(result.mediaNoiseScore).toBeGreaterThan(0.5);
      expect(result.detectedPatterns.negativeSignals.length).toBeGreaterThan(0);
    });

    it('should detect incremental improvements', () => {
      const title = 'Minor Performance Optimization';
      const content = 'Slight improvement in training speed, 1% accuracy gain...';

      const result = analyzeKeywordHeuristics(title, content);

      expect(result.shouldAnalyze).toBe(false);
      expect(result.heuristicScore).toBeLessThan(0.4);
    });

    it('should detect technical depth indicators', () => {
      const title = 'Code Generation Breakthrough';
      const content = `
        \`\`\`python
        def recursive_improve(model):
            return model.optimize()
        \`\`\`
        Algorithm achieves F1 score of 0.95 on HumanEval benchmark.
      `;

      const result = analyzeKeywordHeuristics(title, content);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.detectedPatterns.positiveSignals).toContain('Technical depth: code/math detected');
    });
  });
});
