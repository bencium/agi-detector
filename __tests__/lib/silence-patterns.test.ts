/**
 * Tests for Silence & Secrecy Pattern Detection
 * Tests detection of hidden AGI development indicators
 */

import {
  analyzeForSecrecyIndicators,
  analyzeResearcherDepartures,
  analyzePublicationGap,
  detectContentRemoval,
  performSecrecyAnalysis,
  secrecyAnalysisToCrawlResults,
  SECRECY_KEYWORDS,
  CAUTION_KEYWORDS,
  GOVERNMENT_KEYWORDS,
  EXPECTED_PUBLICATION_FREQUENCY
} from '@/lib/detection/silence-patterns';

describe('Silence Pattern Detection', () => {
  const mockTimestamp = '2025-01-15T10:00:00Z';
  const mockSource = 'Test Source';

  describe('analyzeForSecrecyIndicators', () => {
    it('should detect secrecy keywords', () => {
      const content = 'This document is classified and cannot be discussed publicly.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.length).toBeGreaterThan(0);
      expect(indicators[0].type).toBe('silence');
      expect(indicators.some(i => i.description.includes('classified'))).toBe(true);
    });

    it('should detect multiple secrecy keywords', () => {
      const content = 'The research is under embargo. Some sections were redacted at request of the agency.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.length).toBeGreaterThanOrEqual(2);
    });

    it('should assign critical severity to critical keywords', () => {
      const content = 'The document was classified by the agency.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.some(i => i.severity === 'critical')).toBe(true);
    });

    it('should assign high severity to high-priority keywords', () => {
      const content = 'Researchers signed an NDA before accessing the results.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.some(i => i.severity === 'high')).toBe(true);
    });

    it('should detect caution keywords', () => {
      const content = 'We are pausing development due to safety concerns.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.some(i => i.type === 'safety_meeting')).toBe(true);
      expect(indicators.some(i => i.description.includes('safety concerns'))).toBe(true);
    });

    it('should detect government involvement', () => {
      const content = 'Following the executive order, the company provided a congressional briefing.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.some(i => i.type === 'government')).toBe(true);
      expect(indicators.some(i => i.severity === 'high')).toBe(true);
    });

    it('should return empty array for normal content', () => {
      const content = 'The latest machine learning model achieved good results on benchmarks.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const content = 'The data is CLASSIFIED and CONFIDENTIAL.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators.length).toBeGreaterThan(0);
    });

    it('should extract context around keywords', () => {
      const content = 'After much deliberation, the committee decided the findings are classified. Further research continues.';
      const indicators = analyzeForSecrecyIndicators(content, mockSource, mockTimestamp);

      expect(indicators[0].evidence[0]).toContain('...');
      expect(indicators[0].evidence[0].length).toBeLessThan(200);
    });
  });

  describe('analyzeResearcherDepartures', () => {
    it('should detect senior researcher departures', () => {
      const content = 'The Chief Scientist is leaving the company after 5 years.';
      const indicators = analyzeResearcherDepartures(content, mockSource);

      expect(indicators.length).toBe(1);
      expect(indicators[0].type).toBe('departure');
      expect(indicators[0].severity).toBe('high');
    });

    it('should detect various departure keywords', () => {
      const departureContents = [
        'The VP of Research resigned yesterday.',
        'Research Director departing for a new venture.',
        'Lead Researcher is no longer with the organization.',
        'CTO stepping down to pursue other opportunities.'
      ];

      departureContents.forEach(content => {
        const indicators = analyzeResearcherDepartures(content, mockSource);
        expect(indicators.length).toBe(1);
        expect(indicators[0].type).toBe('departure');
      });
    });

    it('should not flag non-senior departures', () => {
      const content = 'Junior developer is leaving for another company.';
      const indicators = analyzeResearcherDepartures(content, mockSource);

      expect(indicators).toHaveLength(0);
    });

    it('should not flag normal employee movements', () => {
      const content = 'The company is hiring new machine learning engineers.';
      const indicators = analyzeResearcherDepartures(content, mockSource);

      expect(indicators).toHaveLength(0);
    });
  });

  describe('analyzePublicationGap', () => {
    it('should calculate correct gap days', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const pattern = analyzePublicationGap('OpenAI Blog', tenDaysAgo);

      expect(pattern.currentGapDays).toBe(10);
      expect(pattern.expectedFrequency).toBe(14);
      expect(pattern.isAnomalous).toBe(false);
    });

    it('should flag anomalous gaps (2x expected)', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const pattern = analyzePublicationGap('OpenAI Blog', sixtyDaysAgo);

      expect(pattern.isAnomalous).toBe(true);
      expect(pattern.currentGapDays).toBe(60);
    });

    it('should use default frequency for unknown sources', () => {
      const pattern = analyzePublicationGap('Unknown Source', new Date().toISOString());

      expect(pattern.expectedFrequency).toBe(14); // default
    });

    it('should handle different sources correctly', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // arXiv expects daily publications
      const arxivPattern = analyzePublicationGap('arXiv AI', thirtyDaysAgo);
      expect(arxivPattern.isAnomalous).toBe(true);

      // DeepMind expects every 3 weeks
      const deepmindPattern = analyzePublicationGap('DeepMind Research', thirtyDaysAgo);
      expect(deepmindPattern.isAnomalous).toBe(false);
    });
  });

  describe('detectContentRemoval', () => {
    it('should detect significant content removal (>10%)', () => {
      // 2 out of 10 = 20% removal -> medium severity (>10%, <=20%)
      const previous = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
      const current = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];

      const indicators = detectContentRemoval(previous, current, mockSource);

      expect(indicators.length).toBe(1);
      expect(indicators[0].type).toBe('removal');
      // Thresholds: >30% = critical, >20% = high, >10% = medium
      expect(indicators[0].severity).toBe('medium'); // 20% is exactly at boundary, so medium
    });

    it('should assign high severity for >20% removal', () => {
      const previous = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const current = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

      const indicators = detectContentRemoval(previous, current, mockSource);

      expect(indicators.some(i => i.severity === 'high')).toBe(true);
    });

    it('should assign critical severity for >30% removal', () => {
      const previous = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const current = ['A', 'B', 'C', 'D', 'E', 'F'];

      const indicators = detectContentRemoval(previous, current, mockSource);

      expect(indicators.some(i => i.severity === 'critical')).toBe(true);
    });

    it('should not flag small removals (<10%)', () => {
      const previous = Array.from({ length: 100 }, (_, i) => `Article ${i}`);
      const current = previous.slice(0, 95);

      const indicators = detectContentRemoval(previous, current, mockSource);

      expect(indicators).toHaveLength(0);
    });

    it('should include removed titles in evidence', () => {
      const previous = ['Secret Article', 'Normal Article', 'Another Article'];
      const current = ['Normal Article'];

      const indicators = detectContentRemoval(previous, current, mockSource);

      expect(indicators[0].evidence).toContain('Secret Article');
    });
  });

  describe('performSecrecyAnalysis', () => {
    it('should aggregate indicators from multiple articles', () => {
      const articles = [
        { content: 'Document is classified.', source: 'Source A', timestamp: mockTimestamp },
        { content: 'Meeting behind closed doors.', source: 'Source B', timestamp: mockTimestamp }
      ];

      const analysis = performSecrecyAnalysis(articles, {});

      expect(analysis.indicators.length).toBeGreaterThanOrEqual(2);
    });

    it('should analyze publication gaps', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const publicationHistory = {
        'OpenAI Blog': sixtyDaysAgo,
        'DeepMind Research': sixtyDaysAgo
      };

      const analysis = performSecrecyAnalysis([], publicationHistory);

      expect(analysis.publicationGaps.length).toBe(2);
      expect(analysis.publicationGaps.some(p => p.isAnomalous)).toBe(true);
    });

    it('should calculate overall risk correctly', () => {
      // Critical content should result in critical risk
      const criticalArticles = [
        { content: 'classified document redacted', source: 'A', timestamp: mockTimestamp }
      ];

      const analysis = performSecrecyAnalysis(criticalArticles, {});

      expect(analysis.overallRisk).toBe('critical');
    });

    it('should return low risk for normal content', () => {
      const normalArticles = [
        { content: 'New AI model released.', source: 'A', timestamp: mockTimestamp }
      ];

      const analysis = performSecrecyAnalysis(normalArticles, {});

      expect(analysis.overallRisk).toBe('low');
      expect(analysis.indicators).toHaveLength(0);
    });

    it('should include researcher departures', () => {
      const articles = [
        { content: 'Chief Scientist resigned from the AI lab.', source: 'News', timestamp: mockTimestamp }
      ];

      const analysis = performSecrecyAnalysis(articles, {});

      expect(analysis.indicators.some(i => i.type === 'departure')).toBe(true);
    });

    it('should generate meaningful summary', () => {
      const articles = [
        { content: 'Document classified. NDA required.', source: 'A', timestamp: mockTimestamp }
      ];

      const analysis = performSecrecyAnalysis(articles, {});

      expect(analysis.summary).toContain('Secrecy analysis');
      expect(analysis.summary).toContain('risk');
    });
  });

  describe('secrecyAnalysisToCrawlResults', () => {
    it('should convert analysis to crawl results', () => {
      const analysis = performSecrecyAnalysis(
        [{ content: 'classified confidential', source: 'Test', timestamp: mockTimestamp }],
        {}
      );

      const results = secrecyAnalysisToCrawlResults(analysis);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.source).toBe('Secrecy Pattern Detection');
    });

    it('should include critical indicators as separate results', () => {
      const analysis = performSecrecyAnalysis(
        [{ content: 'classified redacted removed at request', source: 'Test', timestamp: mockTimestamp }],
        {}
      );

      const results = secrecyAnalysisToCrawlResults(analysis);

      // Should have summary + individual critical indicators
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for no indicators', () => {
      const analysis = performSecrecyAnalysis(
        [{ content: 'Normal AI research news.', source: 'Test', timestamp: mockTimestamp }],
        {}
      );

      const results = secrecyAnalysisToCrawlResults(analysis);

      expect(results).toHaveLength(0);
    });
  });

  describe('Keyword lists', () => {
    it('should have secrecy keywords defined', () => {
      expect(SECRECY_KEYWORDS.length).toBeGreaterThan(10);
      expect(SECRECY_KEYWORDS).toContain('classified');
      expect(SECRECY_KEYWORDS).toContain('nda');
    });

    it('should have caution keywords defined', () => {
      expect(CAUTION_KEYWORDS.length).toBeGreaterThan(5);
      expect(CAUTION_KEYWORDS).toContain('safety concerns');
    });

    it('should have government keywords defined', () => {
      expect(GOVERNMENT_KEYWORDS.length).toBeGreaterThan(5);
      expect(GOVERNMENT_KEYWORDS).toContain('executive order');
    });

    it('should have expected publication frequencies', () => {
      expect(EXPECTED_PUBLICATION_FREQUENCY['OpenAI Blog']).toBe(14);
      expect(EXPECTED_PUBLICATION_FREQUENCY['arXiv AI']).toBe(1);
    });
  });
});
