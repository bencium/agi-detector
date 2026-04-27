'use client';

import React from 'react';
import TrendChart from '@/components/TrendChart';
import type { TrendDataPoint, TrendStats, TrendMeta, TrendPeriod } from '@/types';

interface TrendsTabProps {
  trendData: TrendDataPoint[];
  trendPeriod: TrendPeriod;
  trendStats: TrendStats | null;
  trendMeta: TrendMeta | null;
  onPeriodChange: (period: TrendPeriod) => void;
}

export const TrendsTab: React.FC<TrendsTabProps> = ({
  trendData,
  trendPeriod,
  trendStats,
  trendMeta,
  onPeriodChange,
}) => {
  const latestAnalysisDate = trendMeta?.latestAnalysisTimestamp
    ? new Date(trendMeta.latestAnalysisTimestamp)
    : null;
  const hasTrendPoints = trendData.length > 0;
  const selectedWindowLabel = trendMeta?.windowDays ? `last ${trendMeta.windowDays} days` : 'selected window';
  const latestOutsideWindow =
    latestAnalysisDate && trendMeta?.windowDays
      ? Date.now() - latestAnalysisDate.getTime() > trendMeta.windowDays * 24 * 60 * 60 * 1000
      : false;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Historical Trends</h2>
          <div className="text-xs text-[var(--muted)] mt-1">
            {trendMeta?.latestAnalysisTimestamp
              ? `Last updated: ${new Date(trendMeta.latestAnalysisTimestamp).toLocaleString()}`
              : 'Last updated: —'}
            {trendMeta?.windowDays ? ` · Window: last ${trendMeta.windowDays} days` : ''}
            {typeof trendMeta?.totalAnalyses === 'number' ? ` · Total analyses: ${trendMeta.totalAnalyses}` : ''}
          </div>
        </div>
        <div className="flex space-x-2">
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                trendPeriod === period
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trend Chart */}
      {!hasTrendPoints && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm">
          No trend points were found in the {selectedWindowLabel}.
          {latestAnalysisDate && (
            <> Latest stored analysis is {latestAnalysisDate.toLocaleString()}, so the current window may simply be stale.</>
          )}
        </div>
      )}
      {latestOutsideWindow && hasTrendPoints && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm">
          Latest stored analysis is outside the selected {selectedWindowLabel}; treat this trend view as stale.
        </div>
      )}
      <TrendChart data={trendData} period={trendPeriod} />

      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-xs text-[var(--muted)]">Average Score</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">
            {(() => {
              const avg = trendStats?.averageScore ??
                (trendData.length > 0
                  ? trendData.reduce((sum, t) => sum + (t.avgScore || 0), 0) / trendData.length
                  : 0);
              return `${(avg * 100).toFixed(1)}%`;
            })()}
          </div>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-xs text-[var(--muted)]">Max Score</div>
          <div className="text-lg font-semibold text-[var(--danger)]">
            {(() => {
              const max = trendStats?.maxScoreRecorded ??
                (trendData.length > 0 ? Math.max(...trendData.map(t => t.maxScore || 0)) : 0);
              return `${(max * 100).toFixed(1)}%`;
            })()}
          </div>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-xs text-[var(--muted)]">Critical Alerts</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">
            {trendStats?.criticalAlertsCount ??
              trendData.reduce((sum, t) => sum + (t.criticalAlerts || 0), 0)}
          </div>
        </div>
      </div>

      {/* Risk Assessment Summary */}
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Risk Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-[var(--muted)] mb-2">Current Trend</div>
            <div className={`text-2xl font-bold ${
              trendData.length >= 2 && (trendData[0]?.avgScore || 0) > (trendData[1]?.avgScore || 0)
                ? 'text-red-600'
                : 'text-green-600'
            }`}>
              {trendData.length >= 2 && (trendData[0]?.avgScore || 0) > (trendData[1]?.avgScore || 0) ? '↑' : '↓'}
              {' '}
              {trendData.length >= 2
                ? Math.abs(((trendData[0]?.avgScore || 0) - (trendData[1]?.avgScore || 0)) * 100).toFixed(1)
                : '0.0'}%
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)] mb-2">Recent Average (last 7 analyses)</div>
            <div className="text-2xl font-bold text-[var(--foreground)]">
              {trendData.slice(0, 7).length > 0
                ? (trendData.slice(0, 7).reduce((sum, d) => sum + (d.avgScore || 0), 0) / trendData.slice(0, 7).length * 100).toFixed(1)
                : '0.0'}%
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)] mb-2">Alerts in window</div>
            <div className="text-2xl font-bold text-[var(--foreground)]">
              {trendData.reduce((sum, d) => sum + (d.criticalAlerts || 0), 0)} / {trendPeriod}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Milestones */}
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Key Milestones</h3>
        <div className="space-y-3">
          {trendData
            .filter(d => (d.maxScore || 0) > 0.7 || (d.criticalAlerts || 0) > 0)
            .slice(0, 5)
            .map((milestone, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-lg">
                <div>
                  <div className="font-medium text-[var(--foreground)]">
                    {milestone.timestamp ? new Date(milestone.timestamp).toLocaleDateString() : 'Unknown date'}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    Max Score: {((milestone.maxScore || 0) * 100).toFixed(1)}%
                    {(milestone.criticalAlerts || 0) > 0 && ` • ${milestone.criticalAlerts} critical alerts`}
                  </div>
                </div>
                {(milestone.criticalAlerts || 0) > 0 && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
            ))}
          {trendData.filter(d => (d.maxScore || 0) > 0.7 || (d.criticalAlerts || 0) > 0).length === 0 && (
            <div className="text-sm text-[var(--muted)] text-center py-4">
              No significant milestones yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrendsTab;
