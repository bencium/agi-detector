# AGI Detector: Prisma to Raw PostgreSQL Migration

## Overview

Completed full migration from Prisma ORM to raw PostgreSQL with pgvector support for semantic search capabilities.

**Date:** December 10, 2025

---

## Phase 1: Database Setup

### pgvector Installation
- Built pgvector v0.8.1 from source for PostgreSQL 14 (Homebrew)
- Commands used:
  ```bash
  cd /tmp
  git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
  cd pgvector
  export PG_CONFIG=/opt/homebrew/opt/postgresql@14/bin/pg_config
  make && make install
  ```

### Database Schema Updates
- Enabled vector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Added embedding column to AnalysisResult: `ALTER TABLE "AnalysisResult" ADD COLUMN embedding vector(512);`
- Created HNSW index for fast similarity search:
  ```sql
  CREATE INDEX analysis_embedding_idx ON "AnalysisResult" USING hnsw (embedding vector_cosine_ops);
  ```

---

## Phase 2: Replace Prisma with pg Library

### Dependencies Changed
- Removed: `@prisma/client`, `prisma`
- Added: `pg`, `@types/pg`

### Created: `src/lib/db.ts`
New database module with:
- Connection pool configuration (max 10 connections)
- Query helpers: `query<T>()`, `queryOne<T>()`, `insert<T>()`, `execute()`
- Transaction support: `withTransaction()`
- Vector search: `findSimilar()`, `findAnomalies()`
- Database status check: `isDbEnabled`

### API Routes Migrated (14 total)

| Route | File | Changes |
|-------|------|---------|
| `/api/data` | `src/app/api/data/route.ts` | Replaced Prisma queries with raw SQL |
| `/api/crawl` | `src/app/api/crawl/route.ts` | Migrated inserts and queries |
| `/api/analyze` | `src/app/api/analyze/route.ts` | Full migration with historical data |
| `/api/analyze-all` | `src/app/api/analyze-all/route.ts` | Batch analysis with raw SQL |
| `/api/trends` | `src/app/api/trends/route.ts` | Aggregation queries |
| `/api/db-health` | `src/app/api/db-health/route.ts` | Health check queries |
| `/api/db-info` | `src/app/api/db-info/route.ts` | Database metadata |
| `/api/feedback` | `src/app/api/feedback/route.ts` | User feedback CRUD |
| `/api/arc` | `src/app/api/arc/route.ts` | ARC progress tracking |
| `/api/validate` | `src/app/api/validate/route.ts` | Analysis validation |
| `/api/backfill-severities` | `src/app/api/backfill-severities/route.ts` | Batch severity updates |
| `/api/rebuild-trends` | `src/app/api/rebuild-trends/route.ts` | Trend snapshots |
| `/api/backfill-historical` | `src/app/api/backfill-historical/route.ts` | Historical data backfill |
| `/api/fix-arxiv-urls` | `src/app/api/fix-arxiv-urls/route.ts` | URL normalization |

### Learning Modules Migrated

| Module | File |
|--------|------|
| Trajectory Recorder | `src/lib/learning/trajectory-recorder.ts` |
| Feedback Handler | `src/lib/learning/feedback-handler.ts` |

---

## Phase 3: New Vector Search Endpoints

### Created: `/api/similar`
- File: `src/app/api/similar/route.ts`
- Purpose: Find semantically similar articles using pgvector
- Features:
  - Retrieves or generates embeddings on-demand
  - Uses cosine similarity for matching
  - Returns top N similar articles with similarity scores

### Created: `/api/anomalies`
- File: `src/app/api/anomalies/route.ts`
- Purpose: Detect outlier articles using embedding distance
- Features:
  - Finds articles furthest from cluster center
  - Useful for identifying unique or unusual content

### Created: `/api/backfill-embeddings`
- File: `src/app/api/backfill-embeddings/route.ts`
- Purpose: Generate embeddings for existing articles
- Features:
  - Batch processing with configurable limits
  - Uses OpenAI text-embedding-3-small model (512 dimensions)

### Added to `src/lib/openai.ts`
```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
    dimensions: 512
  });
  return response.data[0].embedding;
}
```

---

## Phase 4: Cleanup

### Removed Files
- `prisma/` directory (schema.prisma, migrations)
- `src/lib/prisma.ts`
- `src/app/lib/db/prisma.ts`

### Updated `package.json`
- Removed Prisma-related scripts: `db:gen`, `db:push`, `db:studio`
- Updated neon connection scripts to remove `--prisma` flag
- Removed Prisma packages from dependencies

---

## Phase 5: Testing & Bug Fixes

### Unit Tests
- **Result:** 178 tests passed across 10 test suites
- Test files:
  - `__tests__/lib/crawler-strategies.test.ts`
  - `__tests__/lib/severity.test.ts`
  - `__tests__/lib/safeJson.test.ts`
  - `__tests__/lib/silence-patterns.test.ts`
  - `__tests__/lib/arc-progress.test.ts`
  - `__tests__/lib/brave-search.test.ts`
  - `__tests__/api/feedback.test.ts`
  - `__tests__/api/health.test.ts`
  - `__tests__/utils/validation.test.ts`
  - `__tests__/components/LoadingSpinner.test.tsx`

### API Endpoint Tests

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/db-health` | GET | PASS | 1476 crawls, 104 analyses |
| `/api/data` | GET | PASS | Returns paginated data |
| `/api/trends` | GET | PASS | Returns trend analysis |
| `/api/feedback` | GET | PASS | Returns feedback stats |
| `/api/feedback` | POST | PASS | Creates feedback records |
| `/api/similar` | GET | PASS | Vector similarity search |
| `/api/anomalies` | GET | PASS | Returns outlier articles |
| `/api/db-info` | GET | PASS | Returns DB metadata |
| `/api/rebuild-trends` | POST | PASS | Creates trend snapshots |
| `/api/backfill-severities` | POST | PASS | Batch updates |

### Build Verification
- TypeScript compilation: PASS
- Production build: PASS (18 API routes compiled)

---

## Bugs Found & Fixed

### Bug 1: Missing UUID Generation
**Problem:** Several INSERT statements didn't generate UUIDs, causing "null value in column id" errors.

**Affected Files:**
- `src/app/api/feedback/route.ts` (UserFeedback table)
- `src/app/api/rebuild-trends/route.ts` (TrendAnalysis table)
- `src/app/api/analyze/route.ts` (HistoricalData table)
- `src/app/api/analyze-all/route.ts` (HistoricalData table)
- `src/app/api/backfill-historical/route.ts` (HistoricalData table)

**Fix:** Added `gen_random_uuid()` to all INSERT statements:
```sql
-- Before
INSERT INTO "UserFeedback" ("analysisId", "feedbackType", comment) VALUES ($1, $2, $3)

-- After
INSERT INTO "UserFeedback" (id, "analysisId", "feedbackType", comment) VALUES (gen_random_uuid(), $1, $2, $3)
```

### Bug 2: Embedding String Parsing
**Problem:** pgvector returns embeddings as strings like `"[0.1, 0.2, ...]"` but code expected arrays.

**Affected File:** `src/app/api/similar/route.ts`

**Error:** `embedding.join is not a function`

**Fix:** Added type checking and parsing:
```typescript
if (typeof analysis.embedding === 'string') {
  embedding = JSON.parse(analysis.embedding);
} else if (Array.isArray(analysis.embedding)) {
  embedding = analysis.embedding;
}
```

---

## Benefits Achieved

| Metric | Before (Prisma) | After (pg) |
|--------|-----------------|------------|
| Client Size | ~5MB | ~200KB |
| ORM Abstraction | Yes | None (direct SQL) |
| pgvector Support | Workarounds needed | Native |
| Query Control | Limited | Full |
| Dependencies | @prisma/client, prisma | pg, @types/pg |

---

## Database Statistics (Post-Migration)

```
CrawlResult: 1,476 articles
AnalysisResult: 104 analyses
TrendAnalysis: 7 snapshots
UserFeedback: 1 record
```

---

## Files Modified/Created Summary

### Created
- `src/lib/db.ts`
- `src/app/api/similar/route.ts`
- `src/app/api/anomalies/route.ts`
- `src/app/api/backfill-embeddings/route.ts`

### Modified (Major)
- `src/lib/openai.ts` (added generateEmbedding)
- `src/lib/learning/trajectory-recorder.ts`
- `src/lib/learning/feedback-handler.ts`
- All 14 API routes listed above

### Deleted
- `prisma/` directory
- `src/lib/prisma.ts`
- `src/app/lib/db/prisma.ts`

---

## Next Steps (Optional)

1. **Run embedding backfill:** `POST /api/backfill-embeddings` to generate embeddings for all existing articles (~$0.02 cost)
2. **Test semantic search:** Use `/api/similar` endpoint to find related articles
3. **Monitor anomalies:** Use `/api/anomalies` to detect unusual content patterns
