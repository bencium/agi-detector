/**
 * Unit Tests for NLP Preprocessing
 */

import {
  cleanText,
  splitIntoSentences,
  tokenize,
  preprocessText,
  detectCodeBlocks,
  detectMathContent,
  extractSimpleEntities,
  removeStopWords,
} from '../preprocessing';

describe('NLP Preprocessing', () => {
  describe('cleanText', () => {
    it('should remove excessive whitespace', () => {
      const text = 'Multiple    spaces   and\n\nnewlines';
      const cleaned = cleanText(text);

      expect(cleaned).toBe('Multiple spaces and newlines');
    });

    it('should normalize quotes', () => {
      const text = '\u201cSmart quotes\u201d and \u2018apostrophes\u2019';
      const cleaned = cleanText(text);

      expect(cleaned).toContain('"Smart quotes"');
      expect(cleaned).toContain("'apostrophes'");
    });
  });

  describe('splitIntoSentences', () => {
    it('should split on sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('First sentence');
      expect(sentences[1]).toBe('Second sentence');
    });
  });

  describe('tokenize', () => {
    it('should split text into lowercase tokens', () => {
      const text = 'Machine Learning and AI';
      const tokens = tokenize(text);

      expect(tokens).toEqual(['machine', 'learning', 'and', 'ai']);
    });

    it('should preserve hyphens and apostrophes', () => {
      const text = "state-of-the-art don't";
      const tokens = tokenize(text);

      expect(tokens).toContain('state-of-the-art');
      expect(tokens).toContain("don't");
    });
  });

  describe('preprocessText', () => {
    it('should extract comprehensive features', () => {
      const text = `
        Machine learning models achieve 95% accuracy.
        See arXiv:2024.12345 for details.
        \`\`\`python
        def train_model():
            return model
        \`\`\`
      `;

      const processed = preprocessText(text);

      expect(processed.features.wordCount).toBeGreaterThan(0);
      expect(processed.features.sentenceCount).toBeGreaterThan(0);
      expect(processed.features.hasCode).toBe(true);
      expect(processed.features.hasCitations).toBe(true);
      expect(processed.features.technicalDensity).toBeGreaterThan(0);
    });
  });

  describe('detectCodeBlocks', () => {
    it('should detect markdown code blocks', () => {
      const text = '```python\nprint("hello")\n```';
      expect(detectCodeBlocks(text)).toBe(true);
    });

    it('should detect function definitions', () => {
      const text = 'def my_function():';
      expect(detectCodeBlocks(text)).toBe(true);
    });

    it('should return false for plain text', () => {
      const text = 'This is plain text without code';
      expect(detectCodeBlocks(text)).toBe(false);
    });
  });

  describe('detectMathContent', () => {
    it('should detect LaTeX math', () => {
      const text = 'The equation is $$x^2 + y^2 = z^2$$';
      expect(detectMathContent(text)).toBe(true);
    });

    it('should detect math symbols', () => {
      const text = 'For all x ∈ ℝ, we have ∑ xi ≥ 0';
      expect(detectMathContent(text)).toBe(true);
    });

    it('should detect mathematical terms', () => {
      const text = 'We prove the following theorem:';
      expect(detectMathContent(text)).toBe(true);
    });
  });

  describe('extractSimpleEntities', () => {
    it('should extract organizations', () => {
      const text = 'OpenAI and DeepMind collaborate with MIT researchers';
      const entities = extractSimpleEntities(text);

      expect(entities.organizations).toContain('OpenAI');
      expect(entities.organizations).toContain('DeepMind');
      expect(entities.organizations).toContain('MIT');
    });

    it('should extract benchmarks', () => {
      const text = 'Model achieves 90% on MMLU and 85% on HumanEval';
      const entities = extractSimpleEntities(text);

      expect(entities.benchmarks).toContain('MMLU');
      expect(entities.benchmarks).toContain('HumanEval');
    });

    it('should extract model names', () => {
      const text = 'GPT-4 and Claude-3 show strong performance';
      const entities = extractSimpleEntities(text);

      expect(entities.models.length).toBeGreaterThan(0);
    });
  });

  describe('removeStopWords', () => {
    it('should remove common stop words', () => {
      const tokens = ['the', 'machine', 'learning', 'is', 'powerful'];
      const filtered = removeStopWords(tokens);

      expect(filtered).toEqual(['machine', 'learning', 'powerful']);
      expect(filtered).not.toContain('the');
      expect(filtered).not.toContain('is');
    });
  });
});
