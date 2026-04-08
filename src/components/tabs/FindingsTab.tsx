'use client';

import React from 'react';
import type { CrawlResult } from '@/types';
import { formatDateTime } from '@/lib/scoreLabels';
import { EmptyState } from '@/components/EmptyState';

interface FindingsTabProps {
  crawlResults: CrawlResult[];
  onStartMonitoring?: () => void;
}

export const FindingsTab: React.FC<FindingsTabProps> = ({
  crawlResults,
  onStartMonitoring,
}) => {
  if (crawlResults.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="No findings yet"
        description="Start monitoring to collect AI development data"
        action={onStartMonitoring ? {
          label: 'Start Monitoring',
          onClick: onStartMonitoring,
        } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {crawlResults.map((result) => {
        const evidenceSnippets = result.metadata?.evidence?.snippets || [];
        const preview =
          result.content?.trim() ||
          evidenceSnippets[0]?.trim() ||
          'Open the source article to review the full content.';
        const sourceName = result.metadata?.source || 'Unknown source';
        const timestampLabel = result.metadata?.timestamp
          ? formatDateTime(new Date(result.metadata.timestamp))
          : 'Unknown time';
        const sourceHost = (() => {
          try {
            return new URL(result.metadata?.canonicalUrl || result.url).hostname;
          } catch {
            return result.url;
          }
        })();

        return (
          <div
            key={result.id}
            className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--foreground)] mb-2">
                  {result.title}
                </h3>
                <p className="text-sm text-[var(--muted)] mb-3 line-clamp-2">
                  {preview}
                </p>

                {evidenceSnippets.length > 1 && (
                  <div className="mb-3">
                    <div className="text-xs text-[var(--muted)] mb-1">Evidence</div>
                    <div className="space-y-1">
                      {evidenceSnippets.slice(0, 2).map((snippet, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-[var(--foreground)] bg-[var(--surface-hover)] rounded px-2 py-1"
                        >
                          &quot;{snippet}&quot;
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">
                      Source: {sourceHost}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-4 text-xs text-[var(--muted)]">
                  <span>{sourceName}</span>
                  <span>•</span>
                  <span>{timestampLabel}</span>
                </div>
              </div>

              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FindingsTab;
