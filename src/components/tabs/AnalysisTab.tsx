'use client';

import React, { useState } from 'react';
import type { AnalysisResult, ValidationMeta } from '@/types';
import { getScoreLabel, formatClaim, formatDateTime } from '@/lib/scoreLabels';
import { EmptyState } from '@/components/EmptyState';
import SemanticSearch from '@/components/SemanticSearch';

interface AnalysisTabProps {
  analyses: AnalysisResult[];
  isLoading: boolean;
  jobProgress: { status: string; progress: number } | null;
  validatingId: string | null;
  validationMeta: Record<string, ValidationMeta>;
  onAnalyze: () => void;
  onValidate: (id: string) => void;
}

// Analysis Card with Progressive Disclosure
const AnalysisCard: React.FC<{
  analysis: AnalysisResult;
  validatingId: string | null;
  validationMeta: Record<string, ValidationMeta>;
  onValidate: (id: string) => void;
}> = ({ analysis, validatingId, validationMeta, onValidate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const breakdown = (analysis.scoreBreakdown || {}) as Record<string, unknown>;
  const secrecyBoost = typeof breakdown.secrecyBoost === 'number' ? breakdown.secrecyBoost : 0;
  const corroborationPenalty = typeof breakdown.corroborationPenalty === 'number' ? breakdown.corroborationPenalty : 0;
  const signalAssessment = (breakdown.signalAssessment || {}) as Record<string, unknown>;
  const watchPriority = typeof signalAssessment.watchPriority === 'string' ? signalAssessment.watchPriority : analysis.severity || 'low';
  const evidenceConfidence = typeof signalAssessment.evidenceConfidence === 'string' ? signalAssessment.evidenceConfidence : analysis.evidenceQuality || 'weak';
  const uncertaintyReason = typeof signalAssessment.uncertaintyReason === 'string'
    ? signalAssessment.uncertaintyReason
    : 'This is a signal assessment, not a verified AGI conclusion.';
  const sourceStatus = typeof signalAssessment.sourceStatus === 'string' ? signalAssessment.sourceStatus : 'not_assessed';
  const requiredVerification = Array.isArray(signalAssessment.requiredVerification)
    ? signalAssessment.requiredVerification.filter((item): item is string => typeof item === 'string')
    : [];
  const claimTypes = Array.isArray(signalAssessment.claimTypes)
    ? signalAssessment.claimTypes.filter((item): item is string => typeof item === 'string')
    : [];
  const filteredReason = typeof breakdown.filterReason === 'string' ? breakdown.filterReason : null;
  const claims = analysis.crawl?.metadata?.evidence?.claims || [];
  const deltaClaims = claims.filter(c => c.benchmark && typeof c.delta === 'number');
  const snippetCount = analysis.crawl?.metadata?.evidence?.snippets?.length || 0;
  const severityKey = (analysis.severity || '').toLowerCase();
  const isHighSignal = severityKey === 'high' || severityKey === 'critical';
  const potentialSignal = isHighSignal || watchPriority === 'high' || watchPriority === 'critical';
  const modelScoreValue = typeof analysis.modelScore === 'number' ? analysis.modelScore : 0;
  const heuristicScoreValue = typeof analysis.heuristicScore === 'number' ? analysis.heuristicScore : 0;

  const scoreLabel = getScoreLabel(analysis.score);
  const indicatorCount = analysis.indicators.length;
  const sourceCount = analysis.crossReferences?.length || 0;
  const timestamp = analysis.timestamp ? new Date(analysis.timestamp) : null;

  // Determine if validation should be shown
  const severityRank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const minSeverity = (process.env.NEXT_PUBLIC_VALIDATION_MIN_SEVERITY || 'medium').toLowerCase();
  const minRank = severityRank[minSeverity] ?? 2;
  const sev = (analysis.severity || 'none').toLowerCase();
  const always = process.env.NEXT_PUBLIC_VALIDATION_ALWAYS === 'true';
  const meetsSeverity = (severityRank[sev] ?? 0) >= minRank;
  const flag = !!analysis.requiresVerification;
  const showValidate = always || meetsSeverity || flag;

  return (
    <div
      id={`analysis-card-${analysis.id}`}
      className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden"
    >
      {/* Collapsed Summary */}
      <div
        className="p-6 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="font-semibold text-[var(--foreground)] mb-2 truncate">
              {analysis.crawl?.title || 'Untitled Analysis'}
            </h3>

            {/* Watch + Evidence Row */}
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${scoreLabel.bgColor} ${scoreLabel.textColor}`}>
                {(analysis.score * 100).toFixed(0)}%
              </span>
              <span className="text-sm font-medium text-[var(--foreground)]">
                {scoreLabel.label}
              </span>
              {analysis.severity && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  analysis.severity === 'critical' ? 'bg-red-50 text-red-600' :
                  analysis.severity === 'high' ? 'bg-orange-50 text-orange-600' :
                  analysis.severity === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {analysis.severity.toUpperCase()}
                </span>
              )}
              {potentialSignal && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  NEEDS VERIFICATION
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--foreground)]">
                Watch: {watchPriority.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--foreground)]">
                Evidence: {evidenceConfidence.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--foreground)]">
                Source status: {sourceStatus.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
              <span>{indicatorCount} indicator{indicatorCount !== 1 ? 's' : ''}</span>
              {sourceCount > 0 && <span>{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>}
              {timestamp && <span>{formatDateTime(timestamp)}</span>}
            </div>
          </div>

          {/* Expand/Collapse indicator */}
          <button
            className="ml-4 p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          >
            <svg
              className={`w-5 h-5 text-[var(--muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-[var(--border)] pt-4 space-y-4">
          {/* Score Breakdown */}
          <div className="text-xs text-[var(--muted)]">
            <span className="font-medium">Breakdown:</span>{' '}
            Model {(modelScoreValue * 100).toFixed(0)}% ·
            Heuristic {(heuristicScoreValue * 100).toFixed(0)}% ·
            Secrecy +{(secrecyBoost * 100).toFixed(0)}% ·
            Corroboration -{(corroborationPenalty * 100).toFixed(0)}% ·
            Evidence {claims.length} claims (Δ: {deltaClaims.length}) · {snippetCount} snippets
            {filteredReason && ` · Filtered: ${filteredReason}`}
          </div>

          <div className="text-xs bg-[var(--surface-hover)] rounded-lg p-3 text-[var(--foreground)]">
            <div className="font-medium mb-1">Why this may be wrong</div>
            <div className="text-[var(--muted)]">{uncertaintyReason}</div>
            {claimTypes.length > 0 && (
              <div className="mt-2 text-[var(--muted)]">
                Claim types: {claimTypes.join(', ')}
              </div>
            )}
            {requiredVerification.length > 0 && (
              <div className="mt-2 text-[var(--muted)]">
                Needs: {requiredVerification.join('; ')}
              </div>
            )}
          </div>

          {/* Indicators */}
          {analysis.indicators.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Detected Indicators</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.indicators.map((indicator, idx) => (
                  <span key={idx} className="px-3 py-1 bg-[var(--surface-hover)] rounded-full text-sm text-[var(--foreground)]">
                    {indicator}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cross-References */}
          {analysis.crossReferences && analysis.crossReferences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Cross-References</h4>
              <div className="text-xs text-[var(--muted)]">
                Check: {analysis.crossReferences.join(', ')}
              </div>
            </div>
          )}

          {/* Source link */}
          {analysis.crawl?.url && (
            <div>
              <a
                href={analysis.crawl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] hover:underline"
                title={analysis.crawl.url}
              >
                View source: {new URL(analysis.crawl.url).hostname}
              </a>
            </div>
          )}

          {/* Evidence Snippets */}
          {(analysis.crawl?.metadata?.evidence?.snippets?.length || 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Evidence</h4>
              <div className="space-y-2">
                {(analysis.crawl?.metadata?.evidence?.snippets || []).slice(0, 3).map((snippet, idx) => (
                  <div key={idx} className="text-xs text-[var(--foreground)] bg-[var(--surface-hover)] rounded px-3 py-2">
                    &quot;{snippet}&quot;
                  </div>
                ))}
              </div>
              {analysis.crawl?.url && (
                <div className="text-[10px] text-[var(--muted)] mt-1">
                  Source: {new URL(analysis.crawl.metadata?.canonicalUrl || analysis.crawl.url).hostname}
                </div>
              )}
            </div>
          )}

          {/* Structured Claims */}
          {(analysis.crawl?.metadata?.evidence?.claims?.length || 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">Structured Claims</h4>
              <div className="space-y-1">
                {(analysis.crawl?.metadata?.evidence?.claims || []).slice(0, 3).map((claim, idx) => (
                  <div key={idx} className="text-xs text-[var(--muted)]">
                    {formatClaim({ ...claim, claim: claim.claim })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Info */}
          {(analysis.lastValidation || validationMeta[analysis.id]) && (
            <div className="text-xs text-[var(--muted)] bg-[var(--surface-hover)] rounded-lg p-3">
              <div className="font-medium mb-1">
                Last validated: {formatDateTime(new Date((analysis.lastValidation?.timestamp || analysis.validatedAt || validationMeta[analysis.id]?.timestamp) || new Date().toISOString()))}
              </div>
              {(() => {
                const meta = analysis.lastValidation || validationMeta[analysis.id];
                if (!meta) return null;
                return (
                  <div>
                    Score: {((meta.prevScore || analysis.score) * 100).toFixed(0)}% → {((meta.newScore || analysis.score) * 100).toFixed(0)}% ·
                    Confidence: {((meta.prevConfidence || analysis.confidence) * 100).toFixed(0)}% → {((meta.newConfidence || analysis.confidence) * 100).toFixed(0)}%
                    {(meta.addedIndicators || 0) > 0 && (
                      <> · +{meta.addedIndicators} indicators</>
                    )}
                    {meta.recommendation && (
                      <> · {meta.recommendation}</>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Explanation */}
          <p className="text-sm text-[var(--muted)] leading-relaxed">{analysis.explanation}</p>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {showValidate && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onValidate(analysis.id)}
                  disabled={validatingId === analysis.id}
                  className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  title="Get a second AI opinion that can raise, lower, hold, or dismiss this signal"
                >
                  {validatingId === analysis.id ? 'Validating...' : 'Validate'}
                </button>
                <span className="text-xs text-[var(--muted)]">Corrective second opinion</span>
              </div>
            )}
            <div className="text-xs text-[var(--muted)]">
              Confidence: {(analysis.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  analyses,
  isLoading,
  jobProgress,
  validatingId,
  validationMeta,
  onAnalyze,
  onValidate,
}) => {
  // Sort analyses by severity then timestamp
  const sortedAnalyses = [...analyses].sort((a, b) => {
    const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const ra = rank[(a.severity || 'none').toLowerCase()] ?? 0;
    const rb = rank[(b.severity || 'none').toLowerCase()] ?? 0;
    if (rb !== ra) return rb - ra;
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with action button */}
      <div className="flex items-center justify-between bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
        <div className="text-sm font-semibold text-[var(--foreground)]">Analysis</div>
        <button
          onClick={onAnalyze}
          disabled={isLoading || jobProgress?.status === 'running'}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isLoading || jobProgress?.status === 'running'
              ? 'bg-[var(--accent)] text-white processing-button scale-105'
              : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
          } disabled:cursor-not-allowed`}
        >
          {jobProgress?.status === 'running' ? 'Analyzing…' : 'Run Analysis'}
        </button>
      </div>

      {/* Semantic Search */}
      <SemanticSearch
        onResultClick={(result) => {
          const el = document.getElementById(`analysis-card-${result.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {/* Empty State or Analysis Cards */}
      {analyses.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No analyses yet"
          description="Run analysis to score crawled data for AGI indicators."
          action={{
            label: 'Run Analysis',
            onClick: onAnalyze,
          }}
        />
      ) : (
        <div className="space-y-4">
          {sortedAnalyses.map((analysis) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              validatingId={validatingId}
              validationMeta={validationMeta}
              onValidate={onValidate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalysisTab;
