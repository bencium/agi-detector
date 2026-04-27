'use client';

import React from 'react';
import type { JobProgress, CorrelationItem, InsightItem } from '@/types';
import type { AGIProgressData } from '@/components/AGIProgressIndicator';
import type { SourceStatus } from '@/components/MonitoringStatus';
import { formatDateTime } from '@/lib/scoreLabels';
import { SkeletonStatCard } from '@/components/Skeleton';
import AGIProgressIndicator from '@/components/AGIProgressIndicator';
import ARCChallengeCategories from '@/components/ARCChallengeCategories';
import MonitoringStatus from '@/components/MonitoringStatus';

interface OverviewTabProps {
  // Data
  totalArticles: number;
  totalAnalyses: number;
  monitoringSourceStatus: SourceStatus[];
  arcProgressData: AGIProgressData | null;
  correlations: CorrelationItem[];
  correlationsWindowDays: number;
  insights: InsightItem[];
  insightsWindowDays: number;
  insightsError: string | null;

  // State
  isInitialLoading: boolean;
  isLoading: boolean;
  isAutoCrawling: boolean;
  lastCrawlTime: string | null;
  nextScheduledCrawl: string | null;
  jobProgress: JobProgress | null;

  // Actions
  onToggleAutoCrawling: () => void;
  onStartCrawling: () => void;
  onRefreshCorrelations: () => void;
  onRefreshInsights: () => void;
  onRefreshData: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  totalArticles,
  totalAnalyses,
  monitoringSourceStatus,
  arcProgressData,
  correlations,
  correlationsWindowDays,
  insights,
  insightsWindowDays,
  insightsError,
  isInitialLoading,
  isLoading,
  isAutoCrawling,
  lastCrawlTime,
  nextScheduledCrawl,
  jobProgress,
  onToggleAutoCrawling,
  onStartCrawling,
  onRefreshCorrelations,
  onRefreshInsights,
  onRefreshData,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div className="bg-[var(--surface)] rounded-xl p-8 border border-[var(--border)] shadow-sm">
        <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3 tracking-tight">
          Monitoring AGI Emergence
        </h2>
        <p className="text-[var(--muted)] mb-6" style={{ lineHeight: '1.7' }}>
          This system continuously monitors AI research labs, academic papers, and technology news
          for indicators of artificial general intelligence emergence. Using advanced pattern recognition,
          we analyze developments across multiple domains to identify potential AGI breakthroughs.
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {isInitialLoading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <div
                className="bg-[var(--surface-hover)] border-l-4 rounded-lg p-5 transition-all hover:scale-[1.02] hover:shadow-md"
                style={{ borderColor: 'var(--accent-cyan)' }}
              >
                <div className="text-sm font-medium mb-2" style={{ color: 'var(--accent-cyan)' }}>
                  Active Sources
                </div>
                <div className="flex items-baseline space-x-2">
                  <div className="text-3xl font-bold text-[var(--foreground)]">
                    {monitoringSourceStatus.filter(s => s.status === 'active').length}
                  </div>
                  <div className="text-sm text-[var(--muted)]">monitoring</div>
                </div>
              </div>
              <div className="bg-[var(--surface-hover)] border-l-4 border-[var(--accent)] rounded-lg p-5 transition-all hover:scale-[1.02] hover:shadow-md">
                <div className="text-sm text-[var(--muted)] font-medium mb-2">Total Articles</div>
                <div className="flex items-baseline space-x-2">
                  <div className="text-3xl font-bold text-[var(--foreground)]">{totalArticles}</div>
                  {totalArticles > 0 && (
                    <div className="text-sm text-green-600 flex items-center">
                      <span>↑</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-[var(--surface-hover)] border-l-4 border-gray-400 rounded-lg p-5 transition-all hover:scale-[1.02] hover:shadow-md">
                <div className="text-sm text-[var(--muted)] font-medium mb-2">Analyzed</div>
                <div className="flex items-baseline space-x-2">
                  <div className="text-3xl font-bold text-[var(--foreground)]">{totalAnalyses}</div>
                  <div className="text-sm text-[var(--muted)]">of {totalArticles}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onToggleAutoCrawling}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              isAutoCrawling
                ? 'bg-[var(--danger)] text-white hover:bg-red-700'
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
            }`}
          >
            {isAutoCrawling ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
          <button
            onClick={onStartCrawling}
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isLoading
                ? 'bg-[var(--accent)] text-white processing-button scale-105'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
            } disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="flex items-center space-x-3">
                <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-lg font-semibold">
                  {jobProgress ? `${jobProgress.progress}% - ${jobProgress.eta || 'calculating...'}` : 'Starting...'}
                </span>
              </span>
            ) : (
              'Run Manual Scan'
            )}
          </button>

          {/* Progress Bar */}
          {isLoading && jobProgress && (
            <div className="w-full mt-4 space-y-2">
              <div className="flex justify-between text-sm text-[var(--muted)]">
                <span>{jobProgress.processedArticles} / {jobProgress.totalArticles} articles</span>
                <span>{jobProgress.eta ? `ETA: ${jobProgress.eta}` : 'Calculating...'}</span>
              </div>
              <div className="w-full h-3 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
                  style={{ width: `${jobProgress.progress}%` }}
                />
              </div>
              {jobProgress.currentArticle && (
                <p className="text-xs text-[var(--muted)] truncate">
                  Analyzing: {jobProgress.currentArticle}
                </p>
              )}
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span className="text-green-600">{jobProgress.successfulAnalyses} successful</span>
                {jobProgress.failedAnalyses > 0 && (
                  <span className="text-red-600">{jobProgress.failedAnalyses} failed</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--muted)] opacity-60 mt-1">
                If stuck, refresh the page - progress is saved to database
              </p>
            </div>
          )}
        </div>

        {/* Status Info */}
        <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-2">
          {lastCrawlTime && (
            <p className="text-sm text-[var(--muted)]">
              Last scan: {formatDateTime(new Date(lastCrawlTime))}
            </p>
          )}
          {isAutoCrawling && nextScheduledCrawl && (
            <p className="text-sm text-[var(--success)]">
              Next scan: {formatDateTime(new Date(nextScheduledCrawl))}
            </p>
          )}
        </div>
      </div>

      {/* ARC benchmark signal dashboard */}
      <AGIProgressIndicator data={arcProgressData} isLoading={isInitialLoading} />

      {/* ARC Challenge Categories */}
      <ARCChallengeCategories isLoading={isInitialLoading} />

      {/* Monitoring Status Dashboard */}
      <MonitoringStatus
        sources={monitoringSourceStatus}
        isLoading={isInitialLoading}
        onRefresh={onRefreshData}
      />

      {/* Semantic Correlations */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
              Correlations
            </h3>
            <span className="text-xs text-[var(--muted)]">{correlationsWindowDays}d</span>
          </div>
          <button
            onClick={onRefreshCorrelations}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Refresh
          </button>
        </div>

        {correlations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">No correlations detected</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {correlations.map((item, idx) => {
              const confidence = typeof item.confidence === 'number' ? item.confidence : 0.5;
              const typeColors: Record<string, string> = {
                thematic_cluster: 'bg-[var(--accent-cyan)]',
                contradicting_narratives: 'bg-[var(--danger)]',
                timing_pattern: 'bg-[var(--warning)]',
                coordinated_announcement: 'bg-[var(--success)]',
                capability_signal: 'bg-[var(--accent)]',
              };
              const typeColor = typeColors[item.correlationType || ''] || 'bg-[var(--muted)]';

              return (
                <div key={item.id || idx} className="px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-1 h-full min-h-[40px] rounded-full ${typeColor} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--foreground)]"
                              style={{ width: `${confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-[var(--muted)]">
                            {Math.round(confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">
                        {item.correlationType?.replace(/_/g, ' ') || 'pattern'}
                      </span>
                      {item.summary && (
                        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                      {Array.isArray(item.sources) && item.sources.length > 0 && (
                        <div className="flex items-center gap-1 mt-3 text-xs text-[var(--muted)]">
                          <span className="font-medium">{item.sources.length}</span>
                          <span>sources:</span>
                          <span className="truncate">{item.sources.join(' · ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LLM Insights */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
              Insights
            </h3>
            <span className="text-xs text-[var(--muted)]">{insightsWindowDays}d</span>
          </div>
          <button
            onClick={onRefreshInsights}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Refresh
          </button>
        </div>

        {insights.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[var(--muted)]">
              {insightsError || 'No insights generated'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {insights.map((item, idx) => {
              const confidence = typeof item.confidence === 'number' ? item.confidence : 0.5;

              return (
                <div key={item.id || idx} className="px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                        {Math.round(confidence * 100)}
                      </span>
                      <div className="w-1 h-8 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="w-full rounded-full bg-[var(--accent)]"
                          style={{ height: `${confidence * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                      {Array.isArray(item.sources) && item.sources.length > 0 && (
                        <div className="flex items-center gap-1 mt-3 text-xs text-[var(--muted)]">
                          <span className="font-medium">{item.sources.length}</span>
                          <span>sources:</span>
                          <span className="truncate">{item.sources.join(' · ')}</span>
                        </div>
                      )}
                      {Array.isArray(item.evidenceSnippets) && item.evidenceSnippets.length > 0 && (
                        <div className="mt-2 text-xs text-[var(--muted)] italic line-clamp-1">
                          &quot;{item.evidenceSnippets[0]}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
