/**
 * Unit Tests for Author Prestige Scoring
 */

import {
  calculateAuthorPrestige,
  analyzePrestige,
  quickPrestigeCheck,
  isPrestigiousVenue,
} from '../authorPrestige';

describe('Author Prestige Scoring', () => {
  describe('calculateAuthorPrestige', () => {
    it('should give high score to notable researchers', () => {
      const prestige = calculateAuthorPrestige('Geoffrey Hinton', 'University of Toronto');

      expect(prestige.prestigeScore).toBeGreaterThan(0.4); // Notable researcher bonus
    });

    it('should score Tier 1 institutions highly', () => {
      const prestige = calculateAuthorPrestige('John Doe', 'OpenAI');

      expect(prestige.prestigeScore).toBeGreaterThan(0.25);
    });

    it('should score based on h-index', () => {
      const highHIndex = calculateAuthorPrestige('Researcher A', undefined, 120);
      const mediumHIndex = calculateAuthorPrestige('Researcher B', undefined, 55);
      const lowHIndex = calculateAuthorPrestige('Researcher C', undefined, 15);

      expect(highHIndex.prestigeScore).toBeGreaterThan(mediumHIndex.prestigeScore);
      expect(mediumHIndex.prestigeScore).toBeGreaterThan(lowHIndex.prestigeScore);
    });

    it('should combine multiple prestige signals', () => {
      const prestige = calculateAuthorPrestige(
        'Senior Researcher',
        'MIT',
        80,      // High h-index
        60000,   // High citations
        15       // Many influential papers
      );

      expect(prestige.prestigeScore).toBeGreaterThan(0.6);
    });
  });

  describe('analyzePrestige', () => {
    it('should analyze paper with high-prestige authors', () => {
      const authors = [
        { name: 'Ilya Sutskever', affiliation: 'OpenAI', hIndex: 100 },
        { name: 'Researcher B', affiliation: 'Stanford' },
      ];

      const analysis = analyzePrestige(authors);

      expect(analysis.overallScore).toBeGreaterThan(0.5);
      expect(analysis.boost).toBeGreaterThan(1.0);
      expect(analysis.reasons.length).toBeGreaterThan(0);
    });

    it('should boost for prestigious venues', () => {
      const authors = [{ name: 'Researcher', affiliation: 'MIT' }];
      const analysis = analyzePrestige(authors, 'NeurIPS 2024');

      expect(analysis.topVenue).toBe('NeurIPS 2024');
      expect(analysis.reasons.some(r => r.includes('Top-tier venue'))).toBe(true);
    });

    it('should handle unknown authors gracefully', () => {
      const authors = [{ name: 'Unknown Person', affiliation: 'Unknown University' }];
      const analysis = analyzePrestige(authors);

      expect(analysis.overallScore).toBeLessThan(0.3);
      expect(analysis.boost).toBe(1.0); // No boost
    });
  });

  describe('quickPrestigeCheck', () => {
    it('should quickly detect Tier 1 institutions', () => {
      const score = quickPrestigeCheck(['DeepMind', 'Random Corp']);

      expect(score).toBeGreaterThan(0.25);
    });

    it('should return 0 for no recognized institutions', () => {
      const score = quickPrestigeCheck(['Unknown University', 'XYZ Corp']);

      expect(score).toBe(0);
    });
  });

  describe('isPrestigiousVenue', () => {
    it('should recognize top venues', () => {
      expect(isPrestigiousVenue('NeurIPS')).toBe(true);
      expect(isPrestigiousVenue('ICML 2024')).toBe(true);
      expect(isPrestigiousVenue('Nature Machine Intelligence')).toBe(true);
    });

    it('should reject unknown venues', () => {
      expect(isPrestigiousVenue('Random Conference')).toBe(false);
    });
  });
});
