'use client';

import React from 'react';

export interface CategoryStatus {
  name: string;
  description: string;
  status: 'testing' | 'partial' | 'achieved' | 'unknown';
  currentScore?: number;
  examples?: string[];
}

interface ARCChallengeCategoriesProps {
  categories?: CategoryStatus[];
  isLoading?: boolean;
}

// Note: ARC-AGI-2 does not publish category-level breakdowns publicly
// These categories represent the types of reasoning challenges but scores are not available
const defaultCategories: CategoryStatus[] = [
  {
    name: 'Symbolic Interpretation',
    description: 'Symbols carry meaning beyond visual patterns. AI must understand that symbols represent concepts, not just pixel arrangements.',
    status: 'testing',
    currentScore: undefined, // Score not publicly available
    examples: [
      'Recognizing that a colored square represents a concept',
      'Understanding abstract relationships between symbols',
      'Interpreting context-dependent symbol meanings'
    ]
  },
  {
    name: 'Compositional Reasoning',
    description: 'Multiple rules interacting simultaneously. AI must apply several transformation rules at once to solve tasks.',
    status: 'testing',
    currentScore: undefined, // Score not publicly available
    examples: [
      'Combining rotation + color change + scaling',
      'Applying conditional rules based on position',
      'Hierarchical rule application'
    ]
  },
  {
    name: 'Contextual Rule Application',
    description: 'Rules that vary by situation. The same visual pattern may require different transformations depending on context.',
    status: 'testing',
    currentScore: undefined, // Score not publicly available
    examples: [
      'Same input → different output based on surrounding context',
      'Rules that change based on global properties',
      'Exception handling in pattern recognition'
    ]
  }
];

export const ARCChallengeCategories: React.FC<ARCChallengeCategoriesProps> = ({
  categories = defaultCategories,
  isLoading = false
}) => {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'achieved':
        return {
          label: 'Achieved',
          color: 'bg-green-100 text-green-700 border-green-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          description: 'AI systems have demonstrated this capability'
        };
      case 'partial':
        return {
          label: 'Partial',
          color: 'bg-yellow-100 text-yellow-700 border-yellow-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          description: 'Some progress demonstrated but not fully solved'
        };
      case 'testing':
        return {
          label: 'Testing',
          color: 'bg-blue-100 text-blue-700 border-blue-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          ),
          description: 'Currently being evaluated in ARC-AGI-2'
        };
      default:
        return {
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-700 border-gray-500',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          description: 'Status not determined'
        };
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm animate-pulse">
        <div className="h-6 bg-[var(--surface-hover)] rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[var(--surface-hover)] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">ARC Challenge Categories</h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          Core capabilities required for AGI as defined by ARC-AGI-2
        </p>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((category, idx) => {
          const statusInfo = getStatusInfo(category.status);
          return (
            <div
              key={idx}
              className={`border-l-4 rounded-lg p-4 bg-[var(--surface-hover)] transition-all hover:shadow-md ${statusInfo.color.split(' ').pop()}`}
            >
              {/* Category Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${statusInfo.color.split(' ').slice(0, 2).join(' ')}`}>
                    {statusInfo.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">{category.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {category.currentScore !== undefined ? (
                    <>
                      <div className="text-lg font-bold text-[var(--foreground)]">
                        {(category.currentScore * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--muted)]">Current Score</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-[var(--muted)] italic">
                        N/A
                      </div>
                      <div className="text-xs text-[var(--muted)]">Not published</div>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[var(--muted)] mb-3">
                {category.description}
              </p>

              {/* Examples */}
              {category.examples && category.examples.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="text-xs font-medium text-[var(--muted)] mb-2">Examples:</div>
                  <ul className="space-y-1">
                    {category.examples.map((example, exIdx) => (
                      <li key={exIdx} className="text-xs text-[var(--muted)] flex items-start">
                        <span className="mr-2 text-[var(--accent)]">-</span>
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progress Bar for Score */}
              {category.currentScore !== undefined && (
                <div className="mt-3">
                  <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.max(1, category.currentScore * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Overall Progress</span>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-[var(--muted)]">
                {categories.filter(c => c.status === 'achieved').length} Achieved
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-xs text-[var(--muted)]">
                {categories.filter(c => c.status === 'partial').length} Partial
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-xs text-[var(--muted)]">
                {categories.filter(c => c.status === 'testing').length} Testing
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Link to ARC Prize */}
      <div className="mt-4 text-center">
        <a
          href="https://arcprize.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Learn more at arcprize.org →
        </a>
      </div>
    </div>
  );
};

export default ARCChallengeCategories;
