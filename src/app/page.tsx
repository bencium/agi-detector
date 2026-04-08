'use client';

import React, { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { apiFetch } from '@/lib/client/api';
import {
  shouldRunDailyCrawl,
  loadExistingData,
  fetchTrends,
  fetchCorrelations,
  fetchInsights,
  startCrawling,
  startAnalysis,
  validateAnalysis as validateAnalysisAction,
} from '@/lib/client/actions';
import ConsoleOutput from '@/components/ConsoleOutput';
import { OverviewTab, FindingsTab, AnalysisTab, TrendsTab, AnomalyTab } from '@/components/tabs';
import type { DbInfoResponse } from '@/types';

export default function Home(): React.ReactElement {
  const store = useAppStore();
  const analyzeCooldownRef = useRef(0);
  const analysisCleanupRef = useRef<(() => void) | null>(null);

  const [dbInfo, setDbInfo] = React.useState<DbInfoResponse | null>(null);
  const riskLevel = store.getRiskLevel();
  const criticalCount = store.analyses.filter(a => (a.severity || '').toLowerCase() === 'critical').length;

  // Navigation helpers
  const scrollToAnalysis = (analysisId: string | null) => {
    if (!analysisId) return;
    store.setActiveTab('analysis');
    setTimeout(() => {
      const el = document.getElementById(`analysis-card-${analysisId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const jumpToMostSevere = () => {
    if (store.analyses.length === 0) return;
    const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const sorted = [...store.analyses].sort((a, b) =>
      (rank[(b.severity || 'none').toLowerCase()] ?? 0) - (rank[(a.severity || 'none').toLowerCase()] ?? 0)
    );
    const target = sorted.find(a => (a.severity || '').toLowerCase() === 'critical') || sorted[0];
    scrollToAnalysis(target.id);
  };

  const handleAnalyze = () => {
    const cleanup = startAnalysis(useAppStore, analyzeCooldownRef);
    if (cleanup) {
      analysisCleanupRef.current?.();
      analysisCleanupRef.current = cleanup;
    }
  };

  const handleValidate = async (analysisId: string) => {
    const summary = await validateAnalysisAction(useAppStore, analysisId);
    if (summary) {
      alert(summary);
    }
  };

  const handleStartCrawling = async () => {
    await startCrawling(useAppStore);
  };

  // Effects
  useEffect(() => {
    void loadExistingData(useAppStore);
  }, []);

  useEffect(() => {
    const fetchDbInfo = async () => {
      try {
        const response = await apiFetch('/api/db-info');
        const data = await response.json();
        setDbInfo(data);
      } catch {
        setDbInfo({ success: false });
      }
    };
    fetchDbInfo();
  }, []);

  useEffect(() => {
    void fetchTrends(useAppStore);
  }, [store.trendPeriod]);

  useEffect(() => {
    return () => {
      analysisCleanupRef.current?.();
      analysisCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (store.isAutoCrawling) {
      if (shouldRunDailyCrawl(store.lastCrawlTime)) {
        void startCrawling(useAppStore);
      } else if (store.lastCrawlTime) {
        const lastCrawl = new Date(store.lastCrawlTime);
        const nextCrawl = new Date(lastCrawl.getTime() + 24 * 60 * 60 * 1000);
        useAppStore.getState().setNextScheduledCrawl(nextCrawl.toISOString());
      }

      intervalId = setInterval(() => {
        if (shouldRunDailyCrawl(store.lastCrawlTime)) {
          void startCrawling(useAppStore);
        }
      }, 60 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [store.isAutoCrawling, store.lastCrawlTime]);

  // DB blocking check
  const isLocalHost = (host?: string | null) => {
    if (!host) return false;
    const lower = host.toLowerCase();
    return lower === 'localhost' || lower.includes('127.0.0.1') || lower.includes('::1');
  };
  const envHost = dbInfo?.info?.envHost ?? null;
  const reportedHost = dbInfo?.info?.host ?? null;
  const neonOnly = dbInfo?.env?.NEON_ONLY ?? true;
  const isDbLocal = isLocalHost(envHost || '') || (!envHost && isLocalHost(reportedHost || ''));
  const blockLocalDb = neonOnly && isDbLocal;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[var(--accent)] rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">ASI/AGI Monitor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-end">
                <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border-2 transition-all ${
                  riskLevel.level === 'HIGH'
                    ? 'bg-red-50 border-red-500 text-red-700' + (criticalCount > 0 ? ' animate-pulse' : '')
                    : riskLevel.level === 'MEDIUM'
                    ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                    : 'bg-green-50 border-green-500 text-green-700'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    riskLevel.level === 'HIGH' ? 'bg-red-500'
                    : riskLevel.level === 'MEDIUM' ? 'bg-yellow-500'
                    : 'bg-green-500'
                  }`} />
                  <span className="text-sm font-semibold">{riskLevel.level} Risk</span>
                </div>
                {criticalCount > 0 && (
                  <button
                    onClick={jumpToMostSevere}
                    className="mt-2 inline-flex items-center text-xs font-medium"
                    style={{ color: 'var(--accent-cyan)' }}
                    title="Jump to most severe finding"
                  >
                    View {criticalCount} critical {criticalCount === 1 ? 'finding' : 'findings'} →
                  </button>
                )}
              </div>
              <div className={`w-3 h-3 rounded-full transition-colors ${store.isAutoCrawling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} title={store.isAutoCrawling ? 'Monitoring active' : 'Monitoring inactive'} />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {(['overview', 'findings', 'analysis', 'trends', 'anomalies'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => store.setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  store.activeTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Local DB Blocker */}
        {blockLocalDb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
            <div className="max-w-xl w-full mx-4 bg-white border border-red-200 rounded-xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-red-700 mb-2">Local DB Blocked</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                This app is configured for Neon-only. A local database host was detected, so the UI is blocked.
              </p>
              <div className="text-xs text-[var(--muted)] space-y-1 mb-4">
                <div>Env host: <span className="font-mono">{envHost || 'unknown'}</span></div>
                <div>Server host: <span className="font-mono">{reportedHost || 'unknown'}</span></div>
              </div>
              <div className="text-sm text-[var(--foreground)]">
                Fix: update <span className="font-mono">DATABASE_URL</span> in <span className="font-mono">.env.local</span> to your Neon URL.
              </div>
            </div>
          </div>
        )}

        {/* Error Alerts */}
        {store.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            <p className="text-red-700 text-sm">{store.error}</p>
          </div>
        )}
        {store.dataLoadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            <p className="text-red-700 text-sm">
              {store.dataLoadError.includes('LOCAL_API_KEY')
                ? '401: LOCAL_API_KEY not configured.'
                : store.dataLoadError.includes('Database') || store.dataLoadError.includes('DATABASE_URL')
                  ? 'DB not configured.'
                  : store.dataLoadError}
            </p>
          </div>
        )}

        {/* Tab Content */}
        {store.activeTab === 'overview' && (
          <OverviewTab
            totalArticles={store.totalArticles}
            totalAnalyses={store.totalAnalyses}
            monitoringSourceStatus={store.monitoringSourceStatus}
            arcProgressData={store.arcProgressData}
            correlations={store.correlations}
            correlationsWindowDays={store.correlationsWindowDays}
            insights={store.insights}
            insightsWindowDays={store.insightsWindowDays}
            insightsError={store.insightsError}
            isInitialLoading={store.isInitialLoading}
            isLoading={store.isLoading}
            isAutoCrawling={store.isAutoCrawling}
            lastCrawlTime={store.lastCrawlTime}
            nextScheduledCrawl={store.nextScheduledCrawl}
            jobProgress={store.jobProgress}
            onToggleAutoCrawling={() => store.setIsAutoCrawling(!store.isAutoCrawling)}
            onStartCrawling={handleStartCrawling}
            onRefreshCorrelations={() => void fetchCorrelations(useAppStore)}
            onRefreshInsights={() => void fetchInsights(useAppStore, true)}
            onRefreshData={() => void loadExistingData(useAppStore)}
          />
        )}

        {store.activeTab === 'findings' && (
          <FindingsTab
            crawlResults={store.crawlResults}
            onStartMonitoring={handleStartCrawling}
          />
        )}

        {store.activeTab === 'analysis' && (
          <AnalysisTab
            analyses={store.analyses}
            isLoading={store.isLoading}
            jobProgress={store.jobProgress}
            validatingId={store.validatingId}
            validationMeta={store.validationMeta}
            onAnalyze={handleAnalyze}
            onValidate={handleValidate}
          />
        )}

        {store.activeTab === 'trends' && (
          <TrendsTab
            trendData={store.trendData}
            trendPeriod={store.trendPeriod}
            trendStats={store.trendStats}
            trendMeta={store.trendMeta}
            onPeriodChange={(period) => store.setTrendPeriod(period)}
          />
        )}

        {store.activeTab === 'anomalies' && <AnomalyTab />}
      </main>

      {/* Console Output */}
      <ConsoleOutput
        logs={store.logs}
        isExpanded={store.isConsoleExpanded || store.isLoading}
        onToggleExpand={() => store.setIsConsoleExpanded(!store.isConsoleExpanded)}
      />

      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-[var(--muted)]">
            <div className="flex items-center justify-center space-x-3">
              <span>Concept and AI Agents Orchestration by</span>
              <a
                href="https://bencium.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Bencium.io
              </a>
              <span className="text-[var(--border)]">•</span>
              <a
                href="https://github.com/bencium/agi-detector"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
