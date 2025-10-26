/**
 * Safe JSON Parsing Utilities
 * Prevents application crashes from malformed JSON responses
 */

/**
 * Safely parse JSON with a fallback value
 * Returns the fallback value if parsing fails instead of throwing
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch (error) {
    console.error('[SafeJSON] Failed to parse JSON:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      preview: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : '')
    });
    return fallback;
  }
}

/**
 * Safely parse JSON with validation
 * Throws descriptive errors if parsing or validation fails
 */
export function parseJsonWithValidation<T>(
  jsonString: string,
  validator: (data: unknown) => data is T,
  errorMessage?: string
): T {
  try {
    const parsed = JSON.parse(jsonString);

    if (!validator(parsed)) {
      throw new Error(errorMessage || 'JSON validation failed');
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON syntax: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Type guard for checking if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely extract a field from parsed JSON
 * Returns undefined if the field doesn't exist or JSON is invalid
 */
export function safeJsonExtract(
  jsonString: string,
  field: string
): unknown | undefined {
  try {
    const parsed = JSON.parse(jsonString);
    if (isObject(parsed) && field in parsed) {
      return parsed[field];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse OpenAI response with expected structure
 */
export type Severity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface OpenAIAnalysisResult {
  score?: number;
  confidence?: number;
  indicators?: string[];
  explanation?: string;
  severity?: Severity;
  evidence_quality?: string;
  requires_verification?: boolean;
  cross_references?: string[];
}

export function parseOpenAIResponse(content: string | null | undefined): OpenAIAnalysisResult {
  const defaultResult: OpenAIAnalysisResult = {
    score: 0,
    confidence: 0,
    indicators: [],
    explanation: 'No analysis available',
    severity: 'none',
    evidence_quality: 'speculative',
    requires_verification: false,
    cross_references: []
  };

  if (!content) {
    console.warn('[SafeJSON] No content provided to parse');
    return defaultResult;
  }

  return safeJsonParse<OpenAIAnalysisResult>(content, defaultResult);
}
