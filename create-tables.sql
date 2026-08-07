-- Create tables for AGI Detector

-- Enable pgvector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create CrawlResult table
CREATE TABLE IF NOT EXISTS "CrawlResult" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "CrawlResult_pkey" PRIMARY KEY ("id")
);

-- Create AnalysisResult table
CREATE TABLE IF NOT EXISTS "AnalysisResult" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "crawlId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "modelScore" DOUBLE PRECISION,
    "heuristicScore" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "indicators" TEXT[] NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "embedding" vector(512),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "CrawlResult_url_idx" ON "CrawlResult"("url");
CREATE INDEX IF NOT EXISTS "AnalysisResult_score_idx" ON "AnalysisResult"("score");

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "AnalysisResult_crawlId_key" ON "AnalysisResult"("crawlId");

-- Add foreign key constraint
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_crawlId_fkey" 
    FOREIGN KEY ("crawlId") REFERENCES "CrawlResult"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create HistoricalData table (per-analysis metric rows written by the pipeline)
CREATE TABLE IF NOT EXISTS "HistoricalData" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "analysisId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalData_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricalData_analysisId_idx" ON "HistoricalData"("analysisId");
CREATE INDEX IF NOT EXISTS "HistoricalData_timestamp_idx" ON "HistoricalData"("timestamp");

-- Create TrendAnalysis table (daily/weekly/monthly snapshots)
CREATE TABLE IF NOT EXISTS "TrendAnalysis" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "period" TEXT NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "totalAnalyses" INTEGER NOT NULL DEFAULT 0,
    "criticalAlerts" INTEGER NOT NULL DEFAULT 0,
    "dateBucket" DATE,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendAnalysis_pkey" PRIMARY KEY ("id")
);

-- TrendAnalysis dedupe support (kept for databases that predate the CREATE above)
ALTER TABLE "TrendAnalysis" ADD COLUMN IF NOT EXISTS "dateBucket" DATE;
CREATE UNIQUE INDEX IF NOT EXISTS "TrendAnalysis_period_dateBucket_key"
  ON "TrendAnalysis"(period, "dateBucket");

-- Secrecy patterns detected by the analysis pipeline
CREATE TABLE IF NOT EXISTS "SecrecyPattern" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT,
    "riskLevel" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecrecyPattern_pkey" PRIMARY KEY ("id")
);

-- ARC-AGI benchmark progress snapshots
CREATE TABLE IF NOT EXISTS "ARCProgress" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "topScore" DOUBLE PRECISION NOT NULL,
    "baseline" DOUBLE PRECISION,
    "status" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ARCProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ARCProgress_timestamp_idx" ON "ARCProgress"("timestamp");

-- User feedback on analyses (written by /api/feedback, read by /api/evals)
CREATE TABLE IF NOT EXISTS "UserFeedback" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "analysisId" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "comment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserFeedback_analysisId_idx" ON "UserFeedback"("analysisId");
CREATE INDEX IF NOT EXISTS "UserFeedback_timestamp_idx" ON "UserFeedback"("timestamp");

-- Semantic correlations (LLM-detected cross-source patterns)
CREATE TABLE IF NOT EXISTS "SemanticCorrelation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "windowDays" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "correlationType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "articleIds" TEXT[] NOT NULL DEFAULT '{}',
    "sources" TEXT[] NOT NULL DEFAULT '{}',
    "urls" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemanticCorrelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SemanticCorrelation_window_title_key"
  ON "SemanticCorrelation"("windowDays", "title");

-- App state (last crawl run time, etc.)
CREATE TABLE IF NOT EXISTS "AppState" (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Correlation findings (co-occurrence across sources)
CREATE TABLE IF NOT EXISTS "CorrelationFinding" (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    "windowDays" INTEGER NOT NULL,
    indicator TEXT NOT NULL,
    benchmark TEXT NOT NULL,
    metric TEXT,
    "avgDelta" DOUBLE PRECISION,
    "maxDelta" DOUBLE PRECISION,
    "analysisCount" INTEGER NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    sources TEXT[] NOT NULL DEFAULT '{}',
    "analysisIds" TEXT[] NOT NULL DEFAULT '{}',
    urls TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorrelationFinding_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS "CorrelationFinding_window_indicator_benchmark_metric_key"
  ON "CorrelationFinding"("windowDays", indicator, benchmark, metric);
CREATE INDEX IF NOT EXISTS "CorrelationFinding_updatedAt_idx"
  ON "CorrelationFinding"("updatedAt");

-- LLM insights (natural interpretations across sources)
CREATE TABLE IF NOT EXISTS "InsightFinding" (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    "windowDays" INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    sources TEXT[] NOT NULL DEFAULT '{}',
    urls TEXT[] NOT NULL DEFAULT '{}',
    "evidenceSnippets" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightFinding_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsightFinding_window_title_key"
  ON "InsightFinding"("windowDays", title);
CREATE INDEX IF NOT EXISTS "InsightFinding_updatedAt_idx"
  ON "InsightFinding"("updatedAt");

-- Analyze-all job tracking
CREATE TABLE IF NOT EXISTS "AnalysisJob" (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    status TEXT NOT NULL,
    "totalArticles" INTEGER NOT NULL DEFAULT 0,
    "processedArticles" INTEGER NOT NULL DEFAULT 0,
    "successfulAnalyses" INTEGER NOT NULL DEFAULT 0,
    "failedAnalyses" INTEGER NOT NULL DEFAULT 0,
    "currentArticle" TEXT,
    "avgBatchTime" DOUBLE PRECISION,
    "estimatedTimeRemaining" DOUBLE PRECISION,
    error TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "AnalysisJob_startedAt_idx"
  ON "AnalysisJob"("startedAt");

-- Evidence claims table
CREATE TABLE IF NOT EXISTS "EvidenceClaim" (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    "crawlId" TEXT NOT NULL,
    claim TEXT NOT NULL,
    evidence TEXT NOT NULL,
    benchmark TEXT,
    metric TEXT,
    value DOUBLE PRECISION,
    delta DOUBLE PRECISION,
    unit TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    numbers DOUBLE PRECISION[] NOT NULL DEFAULT '{}',
    url TEXT,
    "canonicalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceClaim_crawlId_claim_key" ON "EvidenceClaim"("crawlId", claim);
CREATE INDEX IF NOT EXISTS "EvidenceClaim_crawlId_idx" ON "EvidenceClaim"("crawlId");
CREATE INDEX IF NOT EXISTS "EvidenceClaim_benchmark_idx" ON "EvidenceClaim"(benchmark);

-- Accuracy metrics (evals snapshots)
CREATE TABLE IF NOT EXISTS "AccuracyMetrics" (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    period TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "truePositives" INTEGER NOT NULL,
    "falsePositives" INTEGER NOT NULL,
    "trueNegatives" INTEGER NOT NULL,
    "falseNegatives" INTEGER NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    recall DOUBLE PRECISION NOT NULL,
    "f1Score" DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL,
    "falsePositiveRate" DOUBLE PRECISION NOT NULL,
    "falseNegativeRate" DOUBLE PRECISION NOT NULL,
    "totalReviewed" INTEGER NOT NULL,
    "avgConfidence" DOUBLE PRECISION,
    notes TEXT,
    CONSTRAINT "AccuracyMetrics_pkey" PRIMARY KEY (id)
);
