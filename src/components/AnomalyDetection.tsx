'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/client/api';

interface Anomaly {
  id: string;
  title: string;
  url: string;
  score: number;
  avgDistance: number;
}

interface AnomalyDetectionProps {
  onResultClick?: (anomaly: Anomaly) => void;
  autoLoad?: boolean;
}

export const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({
  onResultClick,
  autoLoad = true
}) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'score'>('distance');

  const detectAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/anomalies?limit=15&minScore=0.2');
      const data = await res.json();

      if (data.success) {
        setAnomalies(data.data?.anomalies || []);
        setHasLoaded(true);
      } else {
        setError(data.error || 'Failed to detect anomalies');
        setAnomalies([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setAnomalies([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad && !hasLoaded) {
      detectAnomalies();
    }
  }, [autoLoad, hasLoaded, detectAnomalies]);

  const getAnomalyLevel = (avgDistance: number): { label: string; color: string; description: string } => {
    if (avgDistance >= 0.8) {
      return {
        label: 'Highly Unusual',
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        description: 'This content is semantically very different from typical patterns'
      };
    }
    if (avgDistance >= 0.6) {
      return {
        label: 'Notable Outlier',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        description: 'Content shows significant deviation from cluster center'
      };
    }
    if (avgDistance >= 0.4) {
      return {
        label: 'Moderate Deviation',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        description: 'Some unique characteristics compared to typical articles'
      };
    }
    return {
      label: 'Minor Outlier',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      description: 'Slight deviation from typical content patterns'
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-red-600';
    if (score >= 0.5) return 'text-orange-600';
    if (score >= 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };

  const sortedDistances = useMemo(
    () => anomalies.map(a => a.avgDistance).sort((a, b) => a - b),
    [anomalies]
  );

  const getDistancePercentile = (distance: number) => {
    if (sortedDistances.length <= 1) return 100;
    let count = 0;
    for (const value of sortedDistances) {
      if (value <= distance) count += 1;
    }
    const percentile = Math.round(((count - 1) / (sortedDistances.length - 1)) * 100);
    return Math.max(0, Math.min(100, percentile));
  };

  const sortedAnomalies = useMemo(() => {
    const list = [...anomalies];
    if (sortBy === 'score') {
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else {
      list.sort((a, b) => (b.avgDistance || 0) - (a.avgDistance || 0));
    }
    return list;
  }, [anomalies, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Semantic Anomaly Detection
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Articles that are semantically "unusual" - far from the cluster center of typical content.
              Useful for AGI detection since breakthroughs might look different from standard research.
            </p>
          </div>
          <button
            onClick={detectAnomalies}
            disabled={isLoading}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Detecting...
              </span>
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] text-sm">
          <div className="flex items-start gap-2">
            <span className="text-[var(--accent)] flex-shrink-0">i</span>
            <div className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">How it works:</strong> Uses pgvector to compute the
              centroid of embeddings within each source group (research/news/academic), then finds articles with
              the highest distance from their group center. Higher distance = more unusual semantic content.
              <div className="mt-1">
                Distance uses cosine distance (pgvector &lt;=&gt;). Percentile is relative to the current list
                (P100 = most unusual).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && !hasLoaded && (
        <div className="text-center py-12 text-[var(--muted)]">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
          <p>Analyzing semantic patterns...</p>
        </div>
      )}

      {/* Results */}
      {hasLoaded && !isLoading && (
        <>
          {anomalies.length === 0 ? (
            <div className="text-center py-12 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
              <div className="text-3xl mb-2">No anomalies detected</div>
              <p className="text-sm text-[var(--muted)]">
                No articles with embeddings found. Run analysis with embedding generation first.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="text-sm text-[var(--muted)]">
                  Found {sortedAnomalies.length} semantic outliers, ranked by {sortBy === 'distance' ? 'distance' : 'AGI score'} · Min AGI 20%
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--muted)]">Sort by</span>
                  <div className="flex overflow-hidden rounded-full border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setSortBy('distance')}
                      className={`px-3 py-1 ${sortBy === 'distance' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'}`}
                    >
                      Distance
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy('score')}
                      className={`px-3 py-1 ${sortBy === 'score' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-[var(--muted)]'}`}
                    >
                      AGI Score
                    </button>
                  </div>
                </div>
              </div>

              {sortedAnomalies.map((anomaly, index) => {
                const level = getAnomalyLevel(anomaly.avgDistance);
                const percentile = getDistancePercentile(anomaly.avgDistance);
                return (
                  <div
                    key={anomaly.id}
                    onClick={() => onResultClick?.(anomaly)}
                    className={`bg-[var(--surface)] rounded-xl p-5 border border-[var(--border)] hover:border-[var(--accent)] transition-colors ${onResultClick ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank Badge */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-sm font-medium text-[var(--muted)]">
                        #{index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title and URL */}
                        <h4 className="font-medium text-[var(--foreground)] mb-1">
                          {anomaly.title || 'Untitled'}
                        </h4>
                        {anomaly.url && (
                          <a
                            href={anomaly.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[var(--accent)] hover:underline truncate block mb-3"
                          >
                            {anomaly.url}
                          </a>
                        )}

                        {/* Metrics Row */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Anomaly Level Badge */}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${level.color}`}>
                            {level.label}
                          </span>

                          {/* Distance Score */}
                          <span className="text-xs text-[var(--muted)]">
                            Distance: <span className="font-mono font-medium text-[var(--foreground)]">{anomaly.avgDistance.toFixed(3)}</span>
                          </span>

                          {/* Percentile */}
                          <span className="text-xs text-[var(--muted)]">
                            Percentile: <span className="font-mono font-medium text-[var(--foreground)]">P{percentile}</span>
                          </span>

                          {/* AGI Score */}
                          <span className={`text-xs font-medium ${getScoreColor(anomaly.score)}`}>
                            AGI Score: {Math.round(anomaly.score * 100)}%
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[var(--muted)] mt-2">
                          {level.description}
                        </p>
                      </div>

                      {/* Visual Distance Indicator */}
                      <div className="flex-shrink-0 w-16">
                        <div className="text-center">
                          <div className="text-xs text-[var(--muted)] mb-1">Deviation</div>
                          <div className="h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-purple-500 rounded-full transition-all"
                              style={{ width: `${Math.min(anomaly.avgDistance * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {hasLoaded && anomalies.length > 0 && (
        <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Anomaly Levels</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-xs text-[var(--muted)]">Highly Unusual (0.8+)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-[var(--muted)]">Notable Outlier (0.6+)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-[var(--muted)]">Moderate (0.4+)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-[var(--muted)]">Minor Outlier</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyDetection;
