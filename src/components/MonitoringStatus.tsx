'use client';

import React from 'react';

export interface SourceStatus {
  name: string;
  displayName: string;
  type: 'research_lab' | 'corporate' | 'academic' | 'news' | 'benchmark' | 'github' | 'kaggle';
  status: 'connected' | 'active' | 'rate_limited' | 'error' | 'disabled';
  lastCheck?: string;
  articleCount?: number;
  errorMessage?: string;
  url?: string;
}

interface MonitoringStatusProps {
  sources?: SourceStatus[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const defaultSources: SourceStatus[] = [
  // Research Labs
  { name: 'openai', displayName: 'OpenAI', type: 'research_lab', status: 'active', url: 'openai.com' },
  { name: 'deepmind', displayName: 'DeepMind', type: 'research_lab', status: 'active', url: 'deepmind.com' },
  { name: 'anthropic', displayName: 'Anthropic', type: 'research_lab', status: 'active', url: 'anthropic.com' },
  { name: 'microsoft', displayName: 'Microsoft AI', type: 'corporate', status: 'active', url: 'microsoft.com/ai' },
  { name: 'baai', displayName: 'BAAI', type: 'research_lab', status: 'active', url: 'baai.ac.cn' },
  { name: 'bytedance_seed', displayName: 'ByteDance Seed', type: 'research_lab', status: 'active', url: 'seed.bytedance.com' },
  { name: 'tencent_ai_lab', displayName: 'Tencent AI Lab', type: 'research_lab', status: 'active', url: 'tencent.net.cn' },
  { name: 'shlab', displayName: 'Shanghai AI Lab', type: 'research_lab', status: 'active', url: 'shlab.org.cn' },
  { name: 'qwen', displayName: 'Qwen Releases', type: 'research_lab', status: 'active', url: 'github.com/QwenLM/Qwen' },
  { name: 'huawei_noah', displayName: 'Huawei Noah', type: 'research_lab', status: 'active', url: 'github.com/huawei-noah/noah-research' },
  { name: 'modelscope', displayName: 'ModelScope', type: 'research_lab', status: 'active', url: 'github.com/modelscope/modelscope' },

  // Academic & News
  { name: 'arxiv', displayName: 'arXiv AI', type: 'academic', status: 'active', url: 'arxiv.org' },
  { name: 'chinaxiv', displayName: 'ChinaXiv', type: 'academic', status: 'active', url: 'chinaxiv.org' },
  { name: 'techcrunch', displayName: 'TechCrunch', type: 'news', status: 'active', url: 'techcrunch.com' },
  { name: 'venturebeat', displayName: 'VentureBeat', type: 'news', status: 'active', url: 'venturebeat.com' },

  // ARC Sources
  { name: 'arc_official', displayName: 'ARC Prize Leaderboard', type: 'benchmark', status: 'active', url: 'arcprize.org/leaderboard' },
  { name: 'arc_kaggle', displayName: 'Kaggle ARC-AGI-2', type: 'kaggle', status: 'active', url: 'kaggle.com/competitions/arc-agi-2025' },
  { name: 'arc_github', displayName: 'ARC-AGI-2 GitHub', type: 'github', status: 'active', url: 'github.com/arcprize/ARC-AGI-2' },
];

export const MonitoringStatus: React.FC<MonitoringStatusProps> = ({
  sources = defaultSources,
  isLoading = false,
  onRefresh
}) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return { color: 'bg-green-500', text: 'Connected', textColor: 'text-green-600' };
      case 'active':
        return { color: 'bg-green-500', text: 'Active', textColor: 'text-green-600' };
      case 'rate_limited':
        return { color: 'bg-yellow-500', text: 'Rate Limited', textColor: 'text-yellow-600' };
      case 'error':
        return { color: 'bg-red-500', text: 'Error', textColor: 'text-red-600' };
      case 'disabled':
        return { color: 'bg-gray-400', text: 'Disabled', textColor: 'text-gray-600' };
      default:
        return { color: 'bg-gray-400', text: 'Unknown', textColor: 'text-gray-600' };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'research_lab':
        return { label: 'Research Lab', color: 'bg-purple-100 text-purple-700' };
      case 'corporate':
        return { label: 'Corporate', color: 'bg-blue-100 text-blue-700' };
      case 'academic':
        return { label: 'Academic', color: 'bg-indigo-100 text-indigo-700' };
      case 'news':
        return { label: 'News', color: 'bg-gray-100 text-gray-700' };
      case 'benchmark':
        return { label: 'Benchmark', color: 'bg-orange-100 text-orange-700' };
      case 'github':
        return { label: 'GitHub', color: 'bg-gray-800 text-white' };
      case 'kaggle':
        return { label: 'Kaggle', color: 'bg-cyan-100 text-cyan-700' };
      default:
        return { label: 'Other', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const formatLastCheck = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  // Group sources by type
  const groupedSources = sources.reduce((acc, source) => {
    const group = source.type === 'benchmark' || source.type === 'github' || source.type === 'kaggle'
      ? 'arc'
      : source.type === 'research_lab' || source.type === 'corporate'
        ? 'labs'
        : 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(source);
    return acc;
  }, {} as Record<string, SourceStatus[]>);

  const activeCount = sources.filter(s => s.status === 'active' || s.status === 'connected').length;
  const errorCount = sources.filter(s => s.status === 'error').length;
  const rateLimitedCount = sources.filter(s => s.status === 'rate_limited').length;

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm animate-pulse">
        <div className="h-6 bg-[var(--surface-hover)] rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-20 bg-[var(--surface-hover)] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Monitoring Status</h3>
          <div className="flex items-center space-x-3 mt-1">
            <span className="flex items-center space-x-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-green-600">{activeCount} Active</span>
            </span>
            {rateLimitedCount > 0 && (
              <span className="flex items-center space-x-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-yellow-600">{rateLimitedCount} Rate Limited</span>
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center space-x-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-red-600">{errorCount} Error</span>
              </span>
            )}
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm transition-colors hover:scale-110 p-2 rounded-lg hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--accent-cyan)' }}
            title="Refresh status"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* ARC Sources Section */}
      {groupedSources.arc && groupedSources.arc.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">ARC-AGI Benchmark Sources</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">NEW</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {groupedSources.arc.map((source) => {
              const statusConfig = getStatusConfig(source.status);
              const typeConfig = getTypeConfig(source.type);
              return (
                <div
                  key={source.name}
                  className="bg-[var(--surface-hover)] rounded-lg p-3 border border-[var(--border)] hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-[var(--foreground)] text-sm">{source.displayName}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className={`w-2 h-2 rounded-full ${statusConfig.color} ${source.status === 'active' ? 'animate-pulse' : ''}`}></span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className={statusConfig.textColor}>{statusConfig.text}</span>
                    <span>{formatLastCheck(source.lastCheck)}</span>
                  </div>
                  {source.articleCount !== undefined && source.articleCount > 0 && (
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {source.articleCount} entries
                    </div>
                  )}
                  {source.errorMessage && (
                    <div className="text-xs text-red-500 mt-1 truncate" title={source.errorMessage}>
                      {source.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Research Labs Section */}
      {groupedSources.labs && groupedSources.labs.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">AI Research Labs</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {groupedSources.labs.map((source) => {
              const statusConfig = getStatusConfig(source.status);
              const typeConfig = getTypeConfig(source.type);
              return (
                <div
                  key={source.name}
                  className="bg-[var(--surface-hover)] rounded-lg p-3 border-l-4 transition-all hover:shadow-md"
                  style={{ borderColor: source.status === 'active' ? 'var(--accent-cyan)' : 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--foreground)] text-sm">{source.displayName}</span>
                    <span className={`w-2 h-2 rounded-full ${statusConfig.color}`}></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${statusConfig.textColor}`}>{statusConfig.text}</span>
                    {source.articleCount !== undefined && source.articleCount > 0 && (
                      <span className="text-xs text-[var(--muted)]">{source.articleCount}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Sources Section */}
      {groupedSources.other && groupedSources.other.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">News & Academic Sources</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {groupedSources.other.map((source) => {
              const statusConfig = getStatusConfig(source.status);
              const typeConfig = getTypeConfig(source.type);
              return (
                <div
                  key={source.name}
                  className="bg-[var(--surface-hover)] rounded-lg p-3 transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--foreground)] text-sm">{source.displayName}</span>
                    <span className={`w-2 h-2 rounded-full ${statusConfig.color}`}></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    {source.articleCount !== undefined && source.articleCount > 0 && (
                      <span className="text-xs text-[var(--muted)]">{source.articleCount}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* System Status Footer */}
      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Total sources: {sources.length}</span>
          <span className="flex items-center space-x-1">
            <span className={`w-2 h-2 rounded-full ${activeCount === sources.length ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span>{activeCount === sources.length ? 'All systems operational' : `${activeCount}/${sources.length} operational`}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default MonitoringStatus;
