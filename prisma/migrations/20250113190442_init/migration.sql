-- CreateTable
CREATE TABLE "CrawlResult" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "CrawlResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "crawlId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "indicators" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlResult_url_idx" ON "CrawlResult"("url");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_crawlId_key" ON "AnalysisResult"("crawlId");

-- CreateIndex
CREATE INDEX "AnalysisResult_score_idx" ON "AnalysisResult"("score");

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_crawlId_fkey" FOREIGN KEY ("crawlId") REFERENCES "CrawlResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
