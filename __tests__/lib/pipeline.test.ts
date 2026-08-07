/**
 * Characterization tests for the core analysis pipeline (src/lib/analysis/pipeline.ts).
 *
 * These pin CURRENT behavior — including known quirks — so future changes to the
 * crawl → analyze → score → store path are deliberate. Only the process edges
 * (Postgres via @/lib/db, OpenAI via @/lib/openai) are mocked; triage, evidence
 * extraction, scoring, and severity all run for real.
 */

jest.mock('@/lib/db', () => ({
  isDbEnabled: true,
  query: jest.fn(async () => []),
  queryOne: jest.fn(async () => null),
  insert: jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('"AnalysisResult"')) {
      return {
        id: 'analysis-1',
        crawlId: params[0],
        score: params[1],
        confidence: params[2],
        indicators: params[3],
        severity: params[4],
        explanation: params[8],
        timestamp: new Date('2026-01-01T00:00:00Z'),
      };
    }
    return null;
  }),
  execute: jest.fn(async () => 0),
  withTransaction: jest.fn(),
}));

jest.mock('@/lib/openai', () => ({
  openai: { chat: { completions: { create: jest.fn() } } },
  AGI_DETECTION_PROMPT: 'test-system-prompt',
  generateEmbedding: jest.fn(async () => Array(512).fill(0.01)),
}));

import { analyzeArticle } from '@/lib/analysis/pipeline';
import { openai, generateEmbedding } from '@/lib/openai';
import { insert, query } from '@/lib/db';

const createMock = openai.chat.completions.create as jest.Mock;
const insertMock = insert as jest.Mock;
const queryMock = query as unknown as jest.Mock;
const embeddingMock = generateEmbedding as jest.Mock;

function mockModelResponse(analysis: Record<string, unknown>) {
  createMock.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(analysis) } }],
  });
}

function crawlResult(overrides: Partial<{ id: string; title: string; content: string; url: string }> = {}) {
  return {
    id: overrides.id ?? 'crawl-1',
    url: overrides.url ?? 'https://example.com/post',
    title: overrides.title ?? 'Research update',
    content: overrides.content ?? '',
    metadata: { source: 'OpenAI Blog', timestamp: '2026-01-01T00:00:00Z' },
  };
}

// Sentence engineered so evidence extraction reliably yields one claim with
// benchmark=ARC, value=85 (%), delta=30 (%): heuristic = 0.03 + 0.15 + 0.10 = 0.28.
const ARC_DELTA_CONTENT =
  'The model achieves 85% accuracy on the ARC-AGI benchmark, an improvement of 30% over the previous state of the art.';

// Capability keywords (passes triage) but no numbers/benchmarks: zero claims, heuristic 0.
const NO_EVIDENCE_CONTENT =
  'The system demonstrates autonomous reasoning and planning across many different domains without retraining.';

beforeEach(() => {
  jest.clearAllMocks();
  queryMock.mockResolvedValue([]);
  embeddingMock.mockResolvedValue(Array(512).fill(0.01));
});

describe('analyzeArticle — Layer-0 triage', () => {
  it('skips short noise articles without calling OpenAI and stores a filtered result', async () => {
    const result = await analyzeArticle(
      crawlResult({
        title: 'Acme announces new pricing plan',
        content: 'We are updating our subscription pricing next month.',
      })
    );

    expect(result.skipped).toBe(true);
    expect(result.score).toBe(0.05);
    expect(result.severity).toBe('low');
    expect(result.explanation).toContain('Layer-0 noise filter');
    expect(createMock).not.toHaveBeenCalled();

    const analysisInsert = insertMock.mock.calls.find(([sql]) => sql.includes('"AnalysisResult"'));
    expect(analysisInsert).toBeDefined();
    // Filtered rows still record historical metrics
    const historicalInsert = insertMock.mock.calls.find(([sql]) => sql.includes('"HistoricalData"'));
    expect(historicalInsert).toBeDefined();
  });
});

describe('analyzeArticle — scoring and severity', () => {
  it('demotes critical to high when no benchmark delta exists (evidence gate)', async () => {
    mockModelResponse({
      score: 0.75,
      confidence: 0.8,
      indicators: ['autonomous research'],
      explanation: 'Extraordinary claim',
      severity: 'critical',
      evidence_quality: 'circumstantial',
      requires_verification: true,
      cross_references: [],
    });

    const result = await analyzeArticle(crawlResult({ content: NO_EVIDENCE_CONTENT }));

    expect(result.score).toBe(0.75);
    expect(result.severity).toBe('high');
  });

  it('keeps critical when a benchmark delta backs the claim', async () => {
    mockModelResponse({
      score: 0.85,
      confidence: 0.9,
      indicators: ['ARC-AGI jump'],
      explanation: 'Large verified benchmark jump',
      severity: 'critical',
      evidence_quality: 'direct',
      requires_verification: false,
      cross_references: [],
    });

    const result = await analyzeArticle(crawlResult({ content: ARC_DELTA_CONTENT }));

    expect(result.score).toBe(0.85);
    expect(result.severity).toBe('critical');
  });

  it('lets the heuristic raise the model score via the weighted term, but never lower it', async () => {
    mockModelResponse({
      score: 0.1,
      confidence: 0.5,
      indicators: [],
      explanation: 'Model thinks this is minor',
      severity: 'low',
      cross_references: [],
    });

    const result = await analyzeArticle(crawlResult({ content: ARC_DELTA_CONTENT }));

    // combined = max(model, 0.85*model + 0.15*heuristic) = max(0.1, 0.085 + 0.15*0.28) = 0.127
    expect(result.score).toBeCloseTo(0.127, 3);

    mockModelResponse({
      score: 0.6,
      confidence: 0.5,
      indicators: [],
      explanation: 'Model scores higher than heuristic',
      severity: 'high',
      cross_references: [],
    });

    const higher = await analyzeArticle(crawlResult({ id: 'crawl-2', content: ARC_DELTA_CONTENT }));
    // weighted (0.552) < model (0.6): heuristic cannot pull the score down
    expect(higher.score).toBe(0.6);
  });

  it('applies a 0.15 corroboration penalty when cross-references match no known source', async () => {
    mockModelResponse({
      score: 0.5,
      confidence: 0.7,
      indicators: ['unverified claim'],
      explanation: 'Needs corroboration',
      severity: 'medium',
      cross_references: ['some unknown lab'],
    });
    queryMock.mockResolvedValue([]); // no CrawlResult rows for the referenced source

    const result = await analyzeArticle(crawlResult({ content: NO_EVIDENCE_CONTENT }));

    expect(result.score).toBeCloseTo(0.35, 3);
    const corroborationQuery = queryMock.mock.calls.find(([sql]) =>
      sql.includes(`LOWER(metadata->>'source')`)
    );
    expect(corroborationQuery).toBeDefined();
  });
});

describe('analyzeArticle — resilience', () => {
  it('still stores the analysis when embedding generation fails', async () => {
    mockModelResponse({
      score: 0.3,
      confidence: 0.6,
      indicators: [],
      explanation: 'ok',
      severity: 'medium',
      cross_references: [],
    });
    embeddingMock.mockRejectedValue(new Error('embedding service down'));

    const result = await analyzeArticle(crawlResult({ content: NO_EVIDENCE_CONTENT }));

    expect(result.id).toBe('analysis-1');
    const analysisInsert = insertMock.mock.calls.find(([sql]) => sql.includes('"AnalysisResult"'));
    expect(analysisInsert?.[1][9]).toBeNull(); // embedding column
  });

  it('retries once on a 429 rate limit and then succeeds', async () => {
    createMock
      .mockRejectedValueOnce({ status: 429, message: 'rate limit' })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 0.2,
                confidence: 0.5,
                indicators: [],
                explanation: 'after retry',
                severity: 'low',
                cross_references: [],
              }),
            },
          },
        ],
      });

    const result = await analyzeArticle(crawlResult({ content: NO_EVIDENCE_CONTENT }));

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result.explanation).toBe('after retry');
  }, 15000);

  it('throws when OpenAI returns no content', async () => {
    createMock.mockResolvedValue({ choices: [] });

    await expect(analyzeArticle(crawlResult({ content: NO_EVIDENCE_CONTENT }))).rejects.toThrow(
      'No analysis result received from OpenAI'
    );
  });
});
