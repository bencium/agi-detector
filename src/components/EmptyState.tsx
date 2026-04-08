'use client';

import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'onboarding';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🔍',
  title,
  description,
  action,
  variant = 'default',
}) => {
  if (variant === 'onboarding') {
    return (
      <div className="bg-[var(--surface)] rounded-xl p-12 border border-[var(--border)] text-center">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-6">🚀</div>
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Welcome to AGI Monitor
          </h3>
          <p className="text-[var(--muted)] mb-6 leading-relaxed">
            No data collected yet. Here&apos;s how to get started:
          </p>
          <ol className="text-left text-sm text-[var(--muted)] space-y-3 mb-8">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs flex items-center justify-center font-medium">1</span>
              <span>Click &quot;Start Monitoring&quot; to begin crawling AI research sources</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs flex items-center justify-center font-medium">2</span>
              <span>Wait 2-3 minutes for initial data collection from 15+ sources</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs flex items-center justify-center font-medium">3</span>
              <span>Click &quot;Run Analysis&quot; to detect AGI signals using AI</span>
            </li>
          </ol>
          {action && (
            <button
              onClick={action.onClick}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl p-12 border border-[var(--border)] text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-[var(--muted)] mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
