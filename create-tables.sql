-- Create tables for AGI Detector

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

-- TrendAnalysis dedupe support (if table already exists)
ALTER TABLE "TrendAnalysis" ADD COLUMN IF NOT EXISTS "dateBucket" DATE;
CREATE UNIQUE INDEX IF NOT EXISTS "TrendAnalysis_period_dateBucket_key"
  ON "TrendAnalysis"(period, "dateBucket");

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
