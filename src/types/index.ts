// Shared types for AGI Detector

export interface CrawlResult {
  id: string;
  title: string;
  url: string;
  content?: string;
  metadata?: {
    source?: string;
    timestamp?: string;
    canonicalUrl?: string;
    evidence?: {
      snippets?: string[];
      claims?: EvidenceClaim[];
    };
  } | null;
}

export interface EvidenceClaim {
  claim: string;
  benchmark?: string;
  metric?: string;
  value?: number;
  delta?: number;
  unit?: string;
}

export interface AnalysisResult {
  id: string;
  score: number;
  modelScore?: number;
  heuristicScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  confidence: number;
  indicators: string[];
  explanation: string;
  severity?: string;
  evidenceQuality?: string;
  requiresVerification?: boolean;
  crossReferences?: string[];
  crawl?: {
    url?: string;
    title?: string;
    metadata?: {
      canonicalUrl?: string;
      evidence?: {
        snippets?: string[];
        claims?: EvidenceClaim[];
      };
    } | null;
  };
  validatedAt?: string;
  timestamp?: string | Date;
  lastValidation?: ValidationMeta;
}

export interface ValidationMeta {
  prevScore?: number;
  newScore?: number;
  scoreDelta?: number;
  prevConfidence?: number;
  newConfidence?: number;
  addedIndicators?: number;
  recommendation?: string;
  uncertaintyReason?: string;
  corroborationPenalty?: number;
  timestamp?: string;
  signalAssessment?: Record<string, unknown>;
}

export interface AnalyzeAllResponse {
  success: boolean;
  error?: string;
  jobId?: string | null;
  status?: string;
  totalArticles?: number;
  message?: string;
}

export interface JobProgress {
  status: string;
  progress: number;
  processedArticles: number;
  totalArticles: number;
  currentArticle: string | null;
  eta: string | null;
  successfulAnalyses: number;
  failedAnalyses: number;
}

export interface TrendDataPoint {
  timestamp?: string;
  avgScore?: number;
  maxScore?: number;
  minScore?: number;
  totalAnalyses?: number;
  criticalAlerts?: number;
}

export interface TrendStats {
  averageScore?: number;
  maxScoreRecorded?: number;
  criticalAlertsCount?: number;
}

export interface TrendMeta {
  latestAnalysisTimestamp?: string;
  windowDays?: number;
  totalAnalyses?: number;
}

export interface CorrelationItem {
  id?: string;
  title: string;
  summary?: string;
  correlationType?: string;
  confidence?: number;
  sources?: string[];
  urls?: string[];
}

export interface InsightItem {
  id?: string;
  title: string;
  summary: string;
  confidence?: number;
  sources?: string[];
  evidenceSnippets?: string[];
}

export interface DbInfoResponse {
  success: boolean;
  env?: {
    DATABASE_URL_set?: boolean;
    DIRECT_URL_set?: boolean;
    NEON_ONLY?: boolean;
  };
  info?: {
    host?: string | null;
    envHost?: string | null;
  };
}

export interface CacheShape {
  crawlResults: CrawlResult[];
  analyses: AnalysisResult[];
  sourceStats: Record<string, number>;
  lastCrawlTime: string | null;
  totalArticles?: number;
  totalAnalyses?: number;
  trends?: Record<string, TrendDataPoint[]>;
}

export type TabType = 'overview' | 'findings' | 'analysis' | 'trends' | 'anomalies';

export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

export interface RiskLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
  bg: string;
  details: string;
}
