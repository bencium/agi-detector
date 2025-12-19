'use client';

import React from 'react';

export interface AGIProgressData {
  topScore: number;
  humanBaseline: number;
  gapToHuman: number;
  status: 'baseline' | 'improving' | 'significant' | 'breakthrough' | 'near_agi' | 'agi';
  description: string;
  lastUpdated?: string;
}

interface AGIProgressIndicatorProps {
  data?: AGIProgressData | null;
  isLoading?: boolean;
}

const defaultData: AGIProgressData = {
  topScore: 0.04, // Current SOTA (o3-preview-low)
  humanBaseline: 1.0,
  gapToHuman: 0.96,
  status: 'baseline',
  description: 'Baseline - current AI capabilities on novel reasoning'
};

export const AGIProgressIndicator: React.FC<AGIProgressIndicatorProps> = ({
  data = defaultData,
  isLoading = false
}) => {
  const progressData = data || defaultData;

  // Calculate normalized progress (0-100)
  // 4% is baseline (0% progress), 100% is AGI (100% progress)
  const baseline = 0.04;
  const normalizedProgress = Math.max(0, Math.min(100,
    ((progressData.topScore - baseline) / (1 - baseline)) * 100
  ));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agi': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-500', glow: 'shadow-purple-500/50' };
      case 'near_agi': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', glow: 'shadow-red-500/50' };
      case 'breakthrough': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500', glow: 'shadow-orange-500/50' };
      case 'significant': return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', glow: 'shadow-yellow-500/50' };
      case 'improving': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500', glow: 'shadow-blue-500/50' };
      default: return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', glow: 'shadow-green-500/50' };
    }
  };

  const statusColors = getStatusColor(progressData.status);

  const getProgressBarColor = (progress: number) => {
    if (progress >= 75) return 'bg-gradient-to-r from-red-500 to-purple-500';
    if (progress >= 50) return 'bg-gradient-to-r from-orange-500 to-red-500';
    if (progress >= 25) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    if (progress >= 10) return 'bg-gradient-to-r from-blue-500 to-yellow-500';
    return 'bg-gradient-to-r from-green-500 to-blue-500';
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm animate-pulse">
        <div className="h-6 bg-[var(--surface-hover)] rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-[var(--surface-hover)] rounded w-2/3 mb-6"></div>
        <div className="h-8 bg-[var(--surface-hover)] rounded mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-[var(--surface-hover)] rounded"></div>
          <div className="h-16 bg-[var(--surface-hover)] rounded"></div>
          <div className="h-16 bg-[var(--surface-hover)] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--surface)] rounded-xl p-6 border-2 ${statusColors.border} shadow-lg ${progressData.status === 'agi' || progressData.status === 'near_agi' ? 'animate-pulse ' + statusColors.glow : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">AGI Progress Indicator</h3>
          <p className="text-xs text-[var(--muted)] mt-1">Based on ARC-AGI-2 Benchmark</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${statusColors.bg} ${statusColors.text}`}>
          {progressData.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Key Definition */}
      <div className="bg-[var(--surface-hover)] rounded-lg p-4 mb-6 border-l-4" style={{ borderColor: 'var(--accent-cyan)' }}>
        <p className="text-sm text-[var(--foreground)] font-medium italic">
          "When no remaining tasks challenge AI while remaining accessible to humans, AGI is achieved."
        </p>
        <p className="text-xs text-[var(--muted)] mt-2">
          - ARC Prize Definition
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-[var(--muted)] mb-2">
          <span>Current AI (Baseline 4%)</span>
          <span>Human Performance (100%)</span>
        </div>
        <div className="relative h-6 bg-[var(--surface-hover)] rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full ${getProgressBarColor(normalizedProgress)} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.max(2, normalizedProgress)}%` }}
          />
          {/* Current position marker */}
          <div
            className="absolute top-0 h-full w-1 bg-white shadow-lg"
            style={{ left: `${Math.max(1, normalizedProgress)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--foreground)] drop-shadow-sm">
              {normalizedProgress.toFixed(1)}% toward AGI
            </span>
          </div>
        </div>
        {progressData.lastUpdated && (
          <div className="text-[11px] text-[var(--muted)] text-right mt-2">
            As of {new Date(progressData.lastUpdated).toLocaleString()}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[var(--surface-hover)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {(progressData.topScore * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--muted)]">Top ARC Score</div>
        </div>
        <div className="bg-[var(--surface-hover)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {(progressData.humanBaseline * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-[var(--muted)]">Human Baseline</div>
        </div>
        <div className="bg-[var(--surface-hover)] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--accent-cyan)' }}>
            {(progressData.gapToHuman * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--muted)]">Gap to Human</div>
        </div>
      </div>

      {/* Status Description */}
      <div className="text-sm text-[var(--muted)] mb-3">
        {progressData.description}
      </div>

      {/* Threshold Legend */}
      <div className="border-t border-[var(--border)] pt-4 mt-4">
        <div className="text-xs text-[var(--muted)] mb-2">Progress Thresholds:</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Baseline', range: '0-10%', color: 'bg-green-500' },
            { label: 'Improving', range: '10-25%', color: 'bg-blue-500' },
            { label: 'Significant', range: '25-50%', color: 'bg-yellow-500' },
            { label: 'Breakthrough', range: '50-75%', color: 'bg-orange-500' },
            { label: 'Near AGI', range: '75-99%', color: 'bg-red-500' },
            { label: 'AGI', range: '100%', color: 'bg-purple-500' },
          ].map((threshold) => (
            <div key={threshold.label} className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${threshold.color}`} />
              <span className="text-xs text-[var(--muted)]">{threshold.label} ({threshold.range})</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default AGIProgressIndicator;
