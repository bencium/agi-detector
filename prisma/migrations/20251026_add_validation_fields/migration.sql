-- Add persistent validation metadata to AnalysisResult
ALTER TABLE "AnalysisResult"
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastValidation" JSONB;

