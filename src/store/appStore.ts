import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CrawlResult,
  AnalysisResult,
  ValidationMeta,
  JobProgress,
  TrendDataPoint,
  TrendStats,
  TrendMeta,
  CorrelationItem,
  InsightItem,
  TabType,
  TrendPeriod,
  RiskLevel,
} from '@/types';
import type { AGIProgressData } from '@/components/AGIProgressIndicator';
import type { SourceStatus } from '@/components/MonitoringStatus';

export interface AppState {
  // Data
  crawlResults: CrawlResult[];
  analyses: AnalysisResult[];
  sourceStats: Record<string, number>;
  totalArticles: number;
  totalAnalyses: number;

  // UI State
  activeTab: TabType;
  isLoading: boolean;
  isAutoCrawling: boolean;
  isInitialLoading: boolean;
  error: string | null;
  dataLoadError: string | null;

  // Crawl state
  lastCrawlTime: string | null;
  nextScheduledCrawl: string | null;

  // Job progress
  jobProgress: JobProgress | null;
  totalAnalyzed: number;

  // Trends
  trendData: TrendDataPoint[];
  trendPeriod: TrendPeriod;
  trendStats: TrendStats | null;
  trendMeta: TrendMeta | null;

  // Correlations & Insights
  correlations: CorrelationItem[];
  correlationsWindowDays: number;
  insights: InsightItem[];
  insightsWindowDays: number;
  insightsError: string | null;

  // Validation
  validatingId: string | null;
  validationMeta: Record<string, ValidationMeta>;

  // ARC Progress
  arcProgressData: AGIProgressData | null;
  monitoringSourceStatus: SourceStatus[];

  // Console
  isConsoleExpanded: boolean;
  logs: string[];

  // Actions
  setActiveTab: (tab: TabType) => void;
  setIsLoading: (loading: boolean) => void;
  setIsAutoCrawling: (crawling: boolean) => void;
  setError: (error: string | null) => void;
  setDataLoadError: (error: string | null) => void;
  setCrawlResults: (results: CrawlResult[] | ((prev: CrawlResult[]) => CrawlResult[])) => void;
  setAnalyses: (analyses: AnalysisResult[] | ((prev: AnalysisResult[]) => AnalysisResult[])) => void;
  setSourceStats: (stats: Record<string, number>) => void;
  setTotalArticles: (count: number) => void;
  setTotalAnalyses: (count: number) => void;
  setLastCrawlTime: (time: string | null) => void;
  setNextScheduledCrawl: (time: string | null) => void;
  setJobProgress: (progress: JobProgress | null) => void;
  setTotalAnalyzed: (count: number) => void;
  setTrendData: (data: TrendDataPoint[]) => void;
  setTrendPeriod: (period: TrendPeriod) => void;
  setTrendStats: (stats: TrendStats | null) => void;
  setTrendMeta: (meta: TrendMeta | null) => void;
  setCorrelations: (correlations: CorrelationItem[]) => void;
  setCorrelationsWindowDays: (days: number) => void;
  setInsights: (insights: InsightItem[]) => void;
  setInsightsWindowDays: (days: number) => void;
  setInsightsError: (error: string | null) => void;
  setValidatingId: (id: string | null) => void;
  setValidationMeta: (meta: Record<string, ValidationMeta> | ((prev: Record<string, ValidationMeta>) => Record<string, ValidationMeta>)) => void;
  setArcProgressData: (data: AGIProgressData | null) => void;
  setMonitoringSourceStatus: (status: SourceStatus[] | ((prev: SourceStatus[]) => SourceStatus[])) => void;
  setIsConsoleExpanded: (expanded: boolean) => void;
  setIsInitialLoading: (loading: boolean) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;

  // Computed
  getRiskLevel: () => RiskLevel;
}

const buildMonitoringStatus = (stats: Record<string, number>): SourceStatus[] => ([
  { name: 'openai', displayName: 'OpenAI', type: 'research_lab', status: 'active', articleCount: stats['OpenAI Blog'] || 0 },
  { name: 'deepmind', displayName: 'DeepMind', type: 'research_lab', status: 'active', articleCount: stats['DeepMind Research'] || 0 },
  { name: 'anthropic', displayName: 'Anthropic', type: 'research_lab', status: 'active', articleCount: stats['Anthropic Blog'] || 0 },
  { name: 'microsoft', displayName: 'Microsoft AI', type: 'corporate', status: 'active', articleCount: stats['Microsoft AI Blog'] || 0 },
  { name: 'baai', displayName: 'BAAI', type: 'research_lab', status: 'active', articleCount: stats['BAAI Research'] || 0 },
  { name: 'bytedance_seed', displayName: 'ByteDance Seed', type: 'research_lab', status: 'active', articleCount: stats['ByteDance Seed Research'] || 0 },
  { name: 'tencent_ai_lab', displayName: 'Tencent AI Lab', type: 'research_lab', status: 'active', articleCount: stats['Tencent AI Lab'] || 0 },
  { name: 'shlab', displayName: 'Shanghai AI Lab', type: 'research_lab', status: 'active', articleCount: stats['Shanghai AI Lab'] || 0 },
  { name: 'arxiv', displayName: 'arXiv AI', type: 'academic', status: 'active', articleCount: stats['arXiv AI'] || 0 },
  { name: 'chinaxiv', displayName: 'ChinaXiv', type: 'academic', status: 'active', articleCount: stats['ChinaXiv'] || 0 },
  { name: 'qwen', displayName: 'Qwen Releases', type: 'research_lab', status: 'active', articleCount: stats['Qwen GitHub Releases'] || 0 },
  { name: 'huawei_noah', displayName: 'Huawei Noah', type: 'research_lab', status: 'active', articleCount: stats['Huawei Noah Research'] || 0 },
  { name: 'modelscope', displayName: 'ModelScope', type: 'research_lab', status: 'active', articleCount: stats['ModelScope Releases'] || 0 },
  { name: 'techcrunch', displayName: 'TechCrunch', type: 'news', status: 'active', articleCount: stats['TechCrunch AI'] || 0 },
  { name: 'venturebeat', displayName: 'VentureBeat', type: 'news', status: 'active', articleCount: stats['VentureBeat AI'] || 0 },
  { name: 'arc_official', displayName: 'ARC Prize Leaderboard', type: 'benchmark', status: 'active', lastCheck: new Date().toISOString() },
  { name: 'arc_kaggle', displayName: 'Kaggle ARC-AGI-2', type: 'kaggle', status: 'active', lastCheck: new Date().toISOString() },
  { name: 'arc_github', displayName: 'ARC-AGI-2 GitHub', type: 'github', status: 'active', lastCheck: new Date().toISOString() }
]);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial data
      crawlResults: [],
      analyses: [],
      sourceStats: {},
      totalArticles: 0,
      totalAnalyses: 0,

      // UI State
      activeTab: 'overview',
      isLoading: false,
      isAutoCrawling: false,
      isInitialLoading: true,
      error: null,
      dataLoadError: null,

      // Crawl state
      lastCrawlTime: null,
      nextScheduledCrawl: null,

      // Job progress
      jobProgress: null,
      totalAnalyzed: 0,

      // Trends
      trendData: [],
      trendPeriod: 'daily',
      trendStats: null,
      trendMeta: null,

      // Correlations & Insights
      correlations: [],
      correlationsWindowDays: 7,
      insights: [],
      insightsWindowDays: 90,
      insightsError: null,

      // Validation
      validatingId: null,
      validationMeta: {},

      // ARC Progress
      arcProgressData: null,
      monitoringSourceStatus: buildMonitoringStatus({}),

      // Console
      isConsoleExpanded: false,
      logs: [],

      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setIsAutoCrawling: (crawling) => set({ isAutoCrawling: crawling }),
      setError: (error) => set({ error }),
      setDataLoadError: (error) => set({ dataLoadError: error }),
      setCrawlResults: (results) => set((state) => ({
        crawlResults: typeof results === 'function' ? results(state.crawlResults) : results
      })),
      setAnalyses: (analyses) => set((state) => ({
        analyses: typeof analyses === 'function' ? analyses(state.analyses) : analyses
      })),
      setSourceStats: (stats) => set({
        sourceStats: stats,
        monitoringSourceStatus: buildMonitoringStatus(stats)
      }),
      setTotalArticles: (count) => set({ totalArticles: count }),
      setTotalAnalyses: (count) => set({ totalAnalyses: count }),
      setLastCrawlTime: (time) => set({ lastCrawlTime: time }),
      setNextScheduledCrawl: (time) => set({ nextScheduledCrawl: time }),
      setJobProgress: (progress) => set({ jobProgress: progress }),
      setTotalAnalyzed: (count) => set({ totalAnalyzed: count }),
      setTrendData: (data) => set({ trendData: data }),
      setTrendPeriod: (period) => set({ trendPeriod: period }),
      setTrendStats: (stats) => set({ trendStats: stats }),
      setTrendMeta: (meta) => set({ trendMeta: meta }),
      setCorrelations: (correlations) => set({ correlations }),
      setCorrelationsWindowDays: (days) => set({ correlationsWindowDays: days }),
      setInsights: (insights) => set({ insights }),
      setInsightsWindowDays: (days) => set({ insightsWindowDays: days }),
      setInsightsError: (error) => set({ insightsError: error }),
      setValidatingId: (id) => set({ validatingId: id }),
      setValidationMeta: (meta) => set((state) => ({
        validationMeta: typeof meta === 'function' ? meta(state.validationMeta) : meta
      })),
      setArcProgressData: (data) => set({ arcProgressData: data }),
      setMonitoringSourceStatus: (status) => set((state) => ({
        monitoringSourceStatus: typeof status === 'function' ? status(state.monitoringSourceStatus) : status
      })),
      setIsConsoleExpanded: (expanded) => set({ isConsoleExpanded: expanded }),
      setIsInitialLoading: (loading) => set({ isInitialLoading: loading }),
      addLog: (log) => set((state) => ({
        logs: [...state.logs.slice(-99), log]
      })),
      clearLogs: () => set({ logs: [] }),

      // Computed
      getRiskLevel: () => {
        const { analyses } = get();
        if (analyses.length === 0) {
          return { level: 'LOW', color: 'text-green-600', bg: 'bg-green-50', details: 'No data' };
        }

        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentAnalyses = analyses.filter(a => {
          if (!a.timestamp) return true;
          return new Date(a.timestamp).getTime() >= cutoff;
        });

        const hasDelta = (analysis: AnalysisResult) => {
          const claims = analysis.crawl?.metadata?.evidence?.claims || [];
          return claims.some(c => c.benchmark && typeof c.delta === 'number');
        };

        const evidenceBacked = recentAnalyses.filter(a => hasDelta(a));
        const pool = evidenceBacked.length > 0 ? evidenceBacked : recentAnalyses;

        const avgScore = pool.reduce((acc, a) => acc + a.score, 0) / Math.max(pool.length, 1);
        const highRiskCount = pool.filter(a => (a.severity || '').toLowerCase() === 'high').length;
        const criticalCount = pool.filter(a => (a.severity || '').toLowerCase() === 'critical').length;

        if (criticalCount > 0) {
          return {
            level: 'HIGH',
            color: 'text-red-600',
            bg: 'bg-red-50',
            details: `${criticalCount} critical findings${evidenceBacked.length === 0 ? ' (unverified)' : ''}`
          };
        }

        if (highRiskCount >= 5) {
          return {
            level: 'MEDIUM',
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            details: `${highRiskCount} high-risk articles${evidenceBacked.length === 0 ? ' (unverified)' : ''}`
          };
        }

        if (avgScore < 0.3) {
          return { level: 'LOW', color: 'text-green-600', bg: 'bg-green-50', details: `Avg: ${(avgScore * 100).toFixed(1)}%` };
        }
        if (avgScore < 0.6) {
          return { level: 'MEDIUM', color: 'text-yellow-600', bg: 'bg-yellow-50', details: `Avg: ${(avgScore * 100).toFixed(1)}%` };
        }
        return {
          level: evidenceBacked.length > 0 ? 'HIGH' : 'MEDIUM',
          color: evidenceBacked.length > 0 ? 'text-red-600' : 'text-yellow-600',
          bg: evidenceBacked.length > 0 ? 'bg-red-50' : 'bg-yellow-50',
          details: `Avg: ${(avgScore * 100).toFixed(1)}%${evidenceBacked.length === 0 ? ' (unverified)' : ''}`
        };
      },
    }),
    {
      name: 'agi-detector-store',
      partialize: (state) => ({
        crawlResults: state.crawlResults,
        analyses: state.analyses,
        sourceStats: state.sourceStats,
        lastCrawlTime: state.lastCrawlTime,
        totalArticles: state.totalArticles,
        totalAnalyses: state.totalAnalyses,
        trendData: state.trendData,
      }),
    }
  )
);

export type AppStore = typeof useAppStore;
