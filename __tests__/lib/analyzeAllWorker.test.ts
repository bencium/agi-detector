/**
 * Tests for the analyze-all batch worker (src/lib/jobs/analyzeAllWorker.ts).
 *
 * Pins job orchestration: status transitions, batching, and the failure
 * accounting — already-analyzed skips must NOT be counted as failures.
 * The db and pipeline edges are mocked.
 */

jest.mock('@/lib/db', () => ({
  isDbEnabled: true,
  query: jest.fn(async () => []),
  queryOne: jest.fn(async () => null),
  insert: jest.fn(async () => ({ id: 'job-1' })),
  execute: jest.fn(async () => 0),
  withTransaction: jest.fn(),
}));

jest.mock('@/lib/analysis/pipeline', () => ({
  analyzeArticle: jest.fn(),
  updateTrendSnapshots: jest.fn(async () => undefined),
}));

import { runAnalyzeAllJob } from '@/lib/jobs/analyzeAllWorker';
import { query, execute } from '@/lib/db';
import { analyzeArticle } from '@/lib/analysis/pipeline';

const queryMock = query as unknown as jest.Mock;
const executeMock = execute as unknown as jest.Mock;
const analyzeMock = analyzeArticle as jest.Mock;

function article(id: string) {
  return { id, title: `Article ${id}`, content: 'content', metadata: { source: 'Test' } };
}

/** Route the two query shapes the worker issues. */
function mockQueries(unanalyzed: unknown[], alreadyAnalyzedIds: string[] = []) {
  queryMock.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('LEFT JOIN "AnalysisResult"')) {
      return unanalyzed;
    }
    if (sql.includes('WHERE "crawlId" = $1')) {
      return alreadyAnalyzedIds.includes(params[0] as string) ? [{ id: 'existing' }] : [];
    }
    return [];
  });
}

function finalJobUpdate(): { sql: string; params: unknown[] } | undefined {
  const call = executeMock.mock.calls
    .filter(([sql]) => sql.includes(`status = 'completed'`))
    .pop();
  return call ? { sql: call[0], params: call[1] } : undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runAnalyzeAllJob', () => {
  it('completes immediately with zero counts when nothing is unanalyzed', async () => {
    mockQueries([]);

    await runAnalyzeAllJob('job-1');

    const update = finalJobUpdate();
    expect(update).toBeDefined();
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('counts real pipeline errors as failures', async () => {
    mockQueries([article('a'), article('b')]);
    analyzeMock.mockImplementation(async (a: { id: string }) => {
      if (a.id === 'b') throw new Error('OpenAI exploded');
      return { id: `analysis-${a.id}`, crawlId: a.id, score: 0.2 };
    });

    await runAnalyzeAllJob('job-1');

    const update = finalJobUpdate();
    expect(update?.params).toEqual([2, 1, 1, 'job-1']); // processed, successful, failed, jobId
  });

  it('does not count already-analyzed skips as failures', async () => {
    // 'a' is already analyzed (skip), 'b' succeeds, 'c' fails
    mockQueries([article('a'), article('b'), article('c')], ['a']);
    analyzeMock.mockImplementation(async (a: { id: string }) => {
      if (a.id === 'c') throw new Error('boom');
      return { id: `analysis-${a.id}`, crawlId: a.id, score: 0.2 };
    });

    await runAnalyzeAllJob('job-1');

    const update = finalJobUpdate();
    // processed=3, successful=1 (b), failed=1 (c) — the skip (a) is neither
    expect(update?.params).toEqual([3, 1, 1, 'job-1']);
    expect(analyzeMock).toHaveBeenCalledTimes(2); // a was skipped before the pipeline
  });

  it('marks the job failed when the initial query throws', async () => {
    queryMock.mockRejectedValue(new Error('db down'));

    await runAnalyzeAllJob('job-1');

    const failedUpdate = executeMock.mock.calls.find(([sql]) => sql.includes(`status = 'failed'`));
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.[1][0]).toBe('db down');
  });
});
