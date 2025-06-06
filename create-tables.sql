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