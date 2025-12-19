'use client';

import React, { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/client/api';

interface SearchResult {
  id: string;
  crawlId: string;
  title: string;
  url: string;
  score: number;
  similarity: number;
}

interface SemanticSearchProps {
  onResultClick?: (result: SearchResult) => void;
}

export const SemanticSearch: React.FC<SemanticSearchProps> = ({ onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query || query.length < 2) {
      setError('Query must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await apiFetch(`/api/semantic-search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();

      if (data.success) {
        setResults(data.data?.results || []);
      } else {
        setError(data.error || 'Search failed');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'bg-green-100 text-green-700';
    if (similarity >= 0.6) return 'bg-blue-100 text-blue-700';
    if (similarity >= 0.4) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-red-600';
    if (score >= 0.5) return 'text-orange-600';
    if (score >= 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Semantic Search</h3>
        <p className="text-sm text-[var(--muted)]">
          Search articles by meaning, not just keywords
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by meaning (e.g., 'alignment faking', 'emergent capabilities')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
        <button
          onClick={search}
          disabled={isLoading || query.length < 2}
          className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              <div className="text-3xl mb-2">No results found</div>
              <p className="text-sm">Try different search terms or ensure articles have embeddings generated</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-[var(--muted)] mb-3">
                Found {results.length} semantically similar articles
              </div>
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onResultClick?.(result)}
                  className={`p-4 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors ${onResultClick ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[var(--foreground)] truncate">
                        {result.title || 'Untitled'}
                      </h4>
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-[var(--accent)] hover:underline truncate block mt-1"
                        >
                          {result.url}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSimilarityColor(result.similarity)}`}>
                        {Math.round(result.similarity * 100)}% match
                      </span>
                      <span className={`text-xs font-medium ${getScoreColor(result.score)}`}>
                        AGI: {Math.round(result.score * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Help Text */}
      {!hasSearched && (
        <div className="text-center py-4 text-[var(--muted)] text-sm">
          <p>Enter a concept or phrase to find semantically related articles</p>
          <p className="mt-1 text-xs">Uses OpenAI embeddings and pgvector for similarity search</p>
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;
