/**
 * Client-side API action functions extracted from page.tsx.
 * These helpers operate against the Zustand store API so they remain
 * type-safe outside React components and are easy to reuse.
 */
import type { MutableRefObject } from 'react';
import type { AnalysisResult } from '@/types';
import type { AppStore } from '@/store/appStore';
import { apiFetch } from '@/lib/client/api';
import { safeJsonParse } from '@/lib/utils/safeJson';

const getState = (store: AppStore) => store.getState();

export const shouldRunDailyCrawl = (lastRunTime: string | null): boolean => {
  if (!lastRunTime) return true;
  const lastRun = new Date(lastRunTime);
  const now = new Date();
  return now.getTime() - lastRun.getTime() >= 24 * 60 * 60 * 1000;
};

export async function loadExistingData(store: AppStore): Promise<void> {
  const state = getState(store);

  try {
    state.addLog('Loading existing data...');
    const response = await apiFetch('/api/data');
    const data = await response.json();

    if (data.success) {
      state.setCrawlResults(data.data.crawlResults);
      state.setAnalyses(data.data.analyses);
      state.setSourceStats(data.data.sourceStats);
      state.setTotalArticles(data.data.totalArticles || data.data.crawlResults.length);
      state.setTotalAnalyses(data.data.totalAnalyses || data.data.analyses.length);

      const latestFromResults = (data.data.crawlResults || []).reduce(
        (latest: string | null, item: { timestamp?: string }) => {
          if (!item?.timestamp) return latest;
          const ts = new Date(item.timestamp).toISOString();
          if (!latest) return ts;
          return new Date(ts).getTime() > new Date(latest).getTime() ? ts : latest;
        },
        null as string | null
      );

      const candidateTimes = [
        data.data.latestCrawlTime || null,
        data.data.lastCrawlRunAt || null,
        latestFromResults,
        state.lastCrawlTime || null,
      ].filter(Boolean) as string[];

      const latestTime =
        candidateTimes.length > 0
          ? candidateTimes.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null;

      if (latestTime) {
        state.setLastCrawlTime(latestTime);
      }

      state.setDataLoadError(null);
      state.addLog(`Loaded ${data.data.totalArticles} articles and ${data.data.totalAnalyses} analyses`);

      state.setArcProgressData({
        topScore: 0.04,
        humanBaseline: 1.0,
        gapToHuman: 0.96,
        status: 'baseline',
        description: 'Baseline - current AI capabilities on novel reasoning',
        lastUpdated: new Date().toISOString(),
      });

      void fetchARCProgress(store);
      void fetchCorrelations(store);
      void fetchInsights(store);
    } else {
      state.setDataLoadError(data.error || 'Failed to load persisted data');
    }
  } catch (error) {
    console.error('Failed to load existing data:', error);
    state.setDataLoadError('Failed to load persisted data. Check DATABASE_URL and LOCAL_API_KEY.');
  } finally {
    state.setIsInitialLoading(false);
  }
}

export async function fetchTrends(store: AppStore): Promise<void> {
  const state = getState(store);

  try {
    state.addLog(`Fetching ${state.trendPeriod} trend data...`);
    const response = await apiFetch(`/api/trends?period=${state.trendPeriod}`);
    const data = await response.json();
    if (data.success) {
      state.setTrendData(data.data.trends);
      state.setTrendStats(data.data.stats || null);
      state.setTrendMeta(data.data.meta || null);
      state.addLog(`Loaded ${data.data.trends.length} trend data points`);
    }
  } catch (error) {
    console.error('Failed to fetch trends:', error);
  }
}

export async function fetchCorrelations(
  store: AppStore,
  days?: number,
  allowExpand = true
): Promise<void> {
  const state = getState(store);
  const requestedDays = days ?? state.correlationsWindowDays;

  try {
    const response = await apiFetch(`/api/correlations?days=${requestedDays}&limit=10`);
    const data = await response.json();
    if (data.success) {
      const found = data.data.correlations || [];
      state.setCorrelations(found);
      if (allowExpand && found.length === 0 && requestedDays < 30) {
        state.setCorrelationsWindowDays(30);
        return fetchCorrelations(store, 30, false);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch correlations:', error);
  }
}

export async function fetchInsights(
  store: AppStore,
  force = false,
  days?: number,
  allowExpand = true,
  autoRefreshed = false
): Promise<void> {
  const state = getState(store);
  const requestedDays = days ?? state.insightsWindowDays;

  try {
    const response = await apiFetch(`/api/insights?days=${requestedDays}&limit=5${force ? '&refresh=true' : ''}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      state.setInsights([]);
      state.setInsightsError(data.error || 'Failed to fetch insights');
      return;
    }

    const nextInsights = data.data.insights || [];
    state.setInsights(nextInsights);
    state.setInsightsError(data.data.error || null);

    if (allowExpand && nextInsights.length === 0 && requestedDays < 180) {
      state.setInsightsWindowDays(180);
      return fetchInsights(store, force, 180, false, autoRefreshed);
    }

    if (!force && !autoRefreshed && nextInsights.length === 0 && !data.data.error) {
      return fetchInsights(store, true, requestedDays, false, true);
    }
  } catch (error) {
    console.warn('Failed to fetch insights:', error);
    state.setInsights([]);
    state.setInsightsError('Failed to fetch insights');
  }
}

export async function fetchARCProgress(store: AppStore): Promise<void> {
  const state = getState(store);

  try {
    state.addLog('Fetching ARC-AGI progress data...');
    const response = await apiFetch('/api/arc');
    const data = await response.json();
    if (data.success && data.data) {
      const progress = data.data.progress || data.data;
      const topScore = data.data.topScore || progress.topScore || 0.04;
      const gapToHuman = data.data.gapToHuman || 1.0 - topScore;
      state.setArcProgressData({
        topScore,
        humanBaseline: 1.0,
        gapToHuman,
        status: progress.status || data.data.status || 'baseline',
        description: progress.description || 'Baseline - current AI capabilities',
        lastUpdated: data.data.timestamp || new Date().toISOString(),
      });
      state.addLog(
        `ARC Progress: ${(topScore * 100).toFixed(1)}% (${progress.status || data.data.status || 'baseline'})`
      );
    }
  } catch (error) {
    console.error('Failed to fetch ARC progress:', error);
    state.addLog('ARC data fetch failed - using defaults');
  }
}

export async function startCrawling(store: AppStore): Promise<void> {
  const state = getState(store);

  state.setError(null);
  state.setIsLoading(true);
  state.clearLogs();
  state.addLog('Starting crawl of all AI sources...');

  try {
    const response = await apiFetch('/api/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      state.setCrawlResults((prev) => [...prev, ...data.data]);
      const now = new Date();
      state.setLastCrawlTime(now.toISOString());
      const nextCrawl = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      state.setNextScheduledCrawl(nextCrawl.toISOString());

      setTimeout(() => {
        void loadExistingData(store);
      }, 1000);

      const totalCrawled = data?.meta?.totalCrawled ?? data.data.length;
      const savedCount = data?.meta?.savedCount ?? data.data.length;
      const duplicates = data?.meta?.duplicates ?? Math.max(0, totalCrawled - savedCount);
      state.addLog(
        `Crawl complete! Saved ${savedCount} new, Crawled ${totalCrawled} total, Duplicates ${duplicates}`
      );
      state.addLog('Analysis is manual. Use "Run Analysis" when ready.');
    } else {
      throw new Error(data.error || 'Failed to crawl sources');
    }
  } catch (error) {
    console.error('Crawling failed:', error);
    state.setError(error instanceof Error ? error.message : 'Failed to crawl sources');
  } finally {
    state.setIsLoading(false);
  }
}

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_DURATION_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export function startAnalysis(
  store: AppStore,
  analyzeCooldownRef: MutableRefObject<number>
): (() => void) | null {
  const state = getState(store);
  const now = Date.now();

  if (state.isLoading || state.jobProgress?.status === 'running') {
    state.addLog('Analysis already in progress.');
    return null;
  }

  if (now < analyzeCooldownRef.current) {
    const seconds = Math.ceil((analyzeCooldownRef.current - now) / 1000);
    state.addLog(`Rate limited. Try again in ${seconds}s.`);
    return null;
  }

  state.setIsLoading(true);
  state.setTotalAnalyzed(0);
  state.setJobProgress(null);
  state.addLog('Starting AI analysis of all unanalyzed articles...');

  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;
  let isCleanedUp = false;
  let consecutivePollErrors = 0;

  const cleanup = () => {
    if (isCleanedUp) return;
    if (pollInterval) clearInterval(pollInterval);
    if (pollTimeout) clearTimeout(pollTimeout);
    pollInterval = null;
    pollTimeout = null;
    isCleanedUp = true;
  };

  const stopWithError = (message: string) => {
    const currentState = getState(store);
    cleanup();
    currentState.addLog(message);
    currentState.setError(message);
    currentState.setIsLoading(false);
    currentState.setJobProgress(null);
    currentState.setTotalAnalyzed(0);
  };

  void (async () => {
    try {
      const response = await apiFetch('/api/analyze-all', { method: 'POST' });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          analyzeCooldownRef.current = Date.now() + retrySeconds * 1000;
          const currentState = getState(store);
          currentState.addLog(`Rate limited. Retry after ${retrySeconds}s.`);
          currentState.setIsLoading(false);
          return;
        }

        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const data = safeJsonParse<{
        success: boolean;
        jobId?: string | null;
        message?: string;
        error?: string;
      }>(text, { success: false, error: 'Failed to parse server response' });

      if (!data.success) {
        throw new Error(data.error || 'Failed to start analysis');
      }

      if (!data.jobId) {
        const currentState = getState(store);
        currentState.addLog(data.message || 'No unanalyzed articles found.');
        currentState.setIsLoading(false);
        return;
      }

      getState(store).addLog(`Queued analysis job: ${data.jobId}`);

      pollTimeout = setTimeout(() => {
        const currentState = getState(store);
        cleanup();
        currentState.addLog('Analysis polling timed out after 30 minutes.');
        currentState.setError('Analysis polling timed out after 30 minutes.');
        currentState.setIsLoading(false);
        currentState.setJobProgress(null);
        currentState.setTotalAnalyzed(0);
      }, MAX_POLL_DURATION_MS);

      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await apiFetch(`/api/analyze-status?jobId=${data.jobId}`);
          if (!statusResponse.ok) {
            throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
          }

          const statusData = await statusResponse.json();
          if (!statusData.success || !statusData.data) {
            throw new Error(statusData.error || 'Status response was incomplete.');
          }

          consecutivePollErrors = 0;
          const currentState = getState(store);
          const job = statusData.data;

          currentState.setJobProgress({
            status: job.status,
            progress: job.progress,
            processedArticles: job.processedArticles,
            totalArticles: job.totalArticles,
            currentArticle: job.currentArticle,
            eta: job.eta,
            successfulAnalyses: job.successfulAnalyses,
            failedAnalyses: job.failedAnalyses,
          });

          currentState.setTotalAnalyzed(job.successfulAnalyses || 0);

          if (job.status === 'running' && job.currentArticle) {
            currentState.addLog(`[${job.progress}%] Analyzing: ${job.currentArticle.slice(0, 60)}...`);
          }

          if (job.status === 'completed' || job.status === 'failed') {
            cleanup();
            await loadExistingData(store);
            await fetchTrends(store);
            await fetchCorrelations(store);
            await fetchInsights(store);
            currentState.addLog(job.status === 'completed' ? 'Analysis complete!' : 'Analysis failed.');
            currentState.setIsLoading(false);
            currentState.setJobProgress(null);
            currentState.setTotalAnalyzed(0);
          }
        } catch (error) {
          consecutivePollErrors += 1;
          const message = error instanceof Error ? error.message : 'Unknown polling error';
          const currentState = getState(store);
          currentState.addLog(`Polling error (${consecutivePollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}): ${message}`);

          if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
            stopWithError('Analysis polling stopped after repeated status check failures.');
          }
        }
      }, POLL_INTERVAL_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      cleanup();
      console.error('Analysis failed:', error);
      const currentState = getState(store);
      currentState.addLog(`Analysis failed: ${message}`);
      currentState.setError(message);
      currentState.setIsLoading(false);
      currentState.setJobProgress(null);
      currentState.setTotalAnalyzed(0);
    }
  })();

  return cleanup;
}

export async function validateAnalysis(store: AppStore, analysisId: string): Promise<string | null> {
  const state = getState(store);
  state.setValidatingId(analysisId);
  state.addLog(`Running cross-validation for analysis ${analysisId}...`);

  try {
    const response = await apiFetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Validation failed');
    }

    const currentState = getState(store);
    const oldAnalysis = currentState.analyses.find((analysis: AnalysisResult) => analysis.id === analysisId);
    const newAnalysis = data.data.updatedAnalysis;

    currentState.setAnalyses((prev) =>
      prev.map((analysis: AnalysisResult) => (analysis.id === analysisId ? { ...analysis, ...newAnalysis } : analysis))
    );

    const oldScore = oldAnalysis?.score || 0;
    const newScore = newAnalysis.score || 0;
    const newIndicators = data.data.validation.additionalIndicators?.length || 0;
    const oldConfidence = oldAnalysis?.confidence || 0;
    const newConfidence = newAnalysis.confidence || 0;
    const recommendation = data.data.validation.recommendation || 'investigate';

    currentState.setValidationMeta((prev) => ({
      ...prev,
      [analysisId]: {
        prevScore: oldScore,
        newScore,
        prevConfidence: oldConfidence,
        newConfidence,
        addedIndicators: newIndicators,
        recommendation,
        timestamp: new Date().toISOString(),
      },
    }));

    currentState.addLog(`Validation complete: ${recommendation}`);

    let summary = 'Validation Result:\n';
    summary += `• Recommendation: ${recommendation}\n`;
    summary += `• Score: ${(oldScore * 100).toFixed(0)}% → ${(newScore * 100).toFixed(0)}%\n`;
    summary += `• Confidence: ${(oldConfidence * 100).toFixed(0)}% → ${(newConfidence * 100).toFixed(0)}%\n`;
    if (newIndicators > 0) {
      summary += `• Found ${newIndicators} additional indicators\n`;
    }
    summary += `\nReasoning: ${data.data.validation.reasoning}`;

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    console.error('Validation failed:', error);
    getState(store).addLog(`Validation failed: ${message}`);
    return null;
  } finally {
    getState(store).setValidatingId(null);
  }
}
