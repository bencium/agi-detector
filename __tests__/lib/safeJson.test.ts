/**
 * Tests for Safe JSON Parsing Utilities
 * Tests error handling for malformed JSON from API responses
 */

import {
  safeJsonParse,
  parseJsonWithValidation,
  isObject,
  safeJsonExtract,
  parseOpenAIResponse,
  OpenAIAnalysisResult
} from '@/lib/utils/safeJson';

describe('Safe JSON Utilities', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON correctly', () => {
      const json = '{"name": "test", "value": 42}';
      const result = safeJsonParse(json, {});

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should return fallback for invalid JSON', () => {
      const invalidJson = '{"broken json';
      const fallback = { error: true };
      const result = safeJsonParse(invalidJson, fallback);

      expect(result).toEqual(fallback);
    });

    it('should return fallback for empty string', () => {
      const result = safeJsonParse('', { default: true });

      expect(result).toEqual({ default: true });
    });

    it('should handle arrays', () => {
      const json = '[1, 2, 3]';
      const result = safeJsonParse<number[]>(json, []);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const json = '{"outer": {"inner": "value"}}';
      const result = safeJsonParse(json, {});

      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('should handle null in JSON', () => {
      const json = 'null';
      const result = safeJsonParse(json, { default: true });

      expect(result).toBeNull();
    });

    it('should handle primitives', () => {
      expect(safeJsonParse('"string"', '')).toBe('string');
      expect(safeJsonParse('42', 0)).toBe(42);
      expect(safeJsonParse('true', false)).toBe(true);
    });

    it('should log error for invalid JSON (console spy)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      safeJsonParse('invalid', {});

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[SafeJSON]');

      consoleSpy.mockRestore();
    });
  });

  describe('parseJsonWithValidation', () => {
    const isStringArray = (data: unknown): data is string[] =>
      Array.isArray(data) && data.every(item => typeof item === 'string');

    it('should parse and validate correct JSON', () => {
      const json = '["a", "b", "c"]';
      const result = parseJsonWithValidation(json, isStringArray);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should throw for invalid JSON syntax', () => {
      expect(() => {
        parseJsonWithValidation('{broken', isStringArray);
      }).toThrow('Invalid JSON syntax');
    });

    it('should throw for failed validation', () => {
      const json = '[1, 2, 3]'; // numbers, not strings

      expect(() => {
        parseJsonWithValidation(json, isStringArray);
      }).toThrow('JSON validation failed');
    });

    it('should use custom error message', () => {
      const json = '{"wrong": "format"}';

      expect(() => {
        parseJsonWithValidation(json, isStringArray, 'Expected string array');
      }).toThrow('Expected string array');
    });

    it('should work with object validators', () => {
      interface Config {
        host: string;
        port: number;
      }

      const isConfig = (data: unknown): data is Config =>
        isObject(data) &&
        typeof data.host === 'string' &&
        typeof data.port === 'number';

      const json = '{"host": "localhost", "port": 3000}';
      const result = parseJsonWithValidation(json, isConfig);

      expect(result).toEqual({ host: 'localhost', port: 3000 });
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(42)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it('should return false for functions', () => {
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('safeJsonExtract', () => {
    it('should extract existing field', () => {
      const json = '{"name": "test", "value": 42}';

      expect(safeJsonExtract(json, 'name')).toBe('test');
      expect(safeJsonExtract(json, 'value')).toBe(42);
    });

    it('should return undefined for missing field', () => {
      const json = '{"name": "test"}';

      expect(safeJsonExtract(json, 'missing')).toBeUndefined();
    });

    it('should return undefined for invalid JSON', () => {
      expect(safeJsonExtract('{broken', 'field')).toBeUndefined();
    });

    it('should return undefined for non-object JSON', () => {
      expect(safeJsonExtract('"string"', 'field')).toBeUndefined();
      expect(safeJsonExtract('[1,2,3]', 'field')).toBeUndefined();
    });

    it('should extract nested fields (first level only)', () => {
      const json = '{"outer": {"inner": "value"}}';

      const outer = safeJsonExtract(json, 'outer');
      expect(outer).toEqual({ inner: 'value' });
    });
  });

  describe('parseOpenAIResponse', () => {
    it('should parse valid OpenAI analysis response', () => {
      const response = JSON.stringify({
        score: 0.75,
        confidence: 0.85,
        indicators: ['indicator1', 'indicator2'],
        explanation: 'Analysis explanation',
        severity: 'high',
        evidence_quality: 'strong',
        requires_verification: true,
        cross_references: ['ref1', 'ref2']
      });

      const result = parseOpenAIResponse(response);

      expect(result.score).toBe(0.75);
      expect(result.confidence).toBe(0.85);
      expect(result.indicators).toEqual(['indicator1', 'indicator2']);
      expect(result.severity).toBe('high');
    });

    it('should return defaults for null content', () => {
      const result = parseOpenAIResponse(null);

      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.indicators).toEqual([]);
      expect(result.explanation).toBe('No analysis available');
      expect(result.severity).toBe('none');
    });

    it('should return defaults for undefined content', () => {
      const result = parseOpenAIResponse(undefined);

      expect(result.score).toBe(0);
      expect(result.explanation).toBe('No analysis available');
    });

    it('should return defaults for empty string', () => {
      const result = parseOpenAIResponse('');

      expect(result.score).toBe(0);
    });

    it('should return defaults for malformed JSON', () => {
      const result = parseOpenAIResponse('{not valid json');

      expect(result.score).toBe(0);
      expect(result.explanation).toBe('No analysis available');
    });

    it('should handle partial responses', () => {
      const partialResponse = JSON.stringify({
        score: 0.5
        // Missing other fields
      });

      const result = parseOpenAIResponse(partialResponse);

      expect(result.score).toBe(0.5);
      // Other fields should be undefined (not from default)
      expect(result.confidence).toBeUndefined();
    });

    it('should preserve all valid fields', () => {
      const fullResponse: OpenAIAnalysisResult = {
        score: 0.9,
        confidence: 0.95,
        indicators: ['AGI breakthrough detected', 'Secrecy patterns'],
        explanation: 'Critical AGI indicators found',
        severity: 'critical',
        evidence_quality: 'verified',
        requires_verification: false,
        cross_references: ['source1', 'source2']
      };

      const result = parseOpenAIResponse(JSON.stringify(fullResponse));

      expect(result).toEqual(fullResponse);
    });

    it('should log warning for null/undefined (console spy)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      parseOpenAIResponse(null);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('No content provided');

      consoleSpy.mockRestore();
    });
  });

  describe('Real-world API response scenarios', () => {
    it('should handle OpenAI response with extra whitespace', () => {
      const response = `
        {
          "score": 0.5,
          "explanation": "Test"
        }
      `;

      const result = parseOpenAIResponse(response);
      expect(result.score).toBe(0.5);
    });

    it('should handle OpenAI response with unicode', () => {
      const response = JSON.stringify({
        score: 0.5,
        explanation: 'Analysis with unicode: \u2713 \u2022 \u00e9'
      });

      const result = parseOpenAIResponse(response);
      expect(result.explanation).toContain('\u2713');
    });

    it('should handle deeply nested cross_references', () => {
      const response = JSON.stringify({
        score: 0.5,
        cross_references: ['ref1', 'ref2', 'ref3']
      });

      const result = parseOpenAIResponse(response);
      expect(result.cross_references).toHaveLength(3);
    });

    it('should not crash on unexpected response structure', () => {
      // OpenAI might return unexpected structures
      const weirdResponse = JSON.stringify({
        completely: 'different',
        structure: [1, 2, 3]
      });

      // Should not throw, just return parsed object
      const result = parseOpenAIResponse(weirdResponse);
      expect(result).toHaveProperty('completely', 'different');
    });
  });
});
