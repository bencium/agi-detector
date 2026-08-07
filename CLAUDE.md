# CLAUDE.md — AGI Detector

Guidance for AI coding agents working in this repository. Read this before touching code.

## What this app is

A Next.js dashboard + API that crawls AI-lab blogs / news / academic sources, scores each
article for "AGI signal" using OpenAI plus local heuristics, stores everything in Postgres
(Neon + pgvector), and visualizes trends, correlations, insights, and anomalies. It is a
signal-assessment tool, not an oracle — most of the domain logic exists to be *skeptical*
(noise triage, evidence gates, corroboration penalties).

## Hard rules

- **No drive-by refactoring.** Follow existing conventions even where they are imperfect.
  Do not refactor opportunistically while doing feature or fix work.
- **No new dependencies without asking.** Not even devDependencies.
- **No changes outside the stated scope of the task.** Touch existing files as little as
  possible; prefer extending (new module, new route) over modifying shared code.
- **Enhancements/refactors go in their own PR**, never mixed with features or fixes.
  Write characterization tests before refactoring; behavior must be identical after.
- **Diff budget:** a bugfix PR touching more than ~5 files, or a feature PR touching more
  than ~10, needs an explicit justification in the PR description.
- **Do not trust partial reading of legacy code.** Before changing anything on the core
  path (crawl → analyze → score → store), read the actual call chain and cite the files
  you read in your plan/PR.
- **Never commit secrets.** Env vars only (`.env.local`, see `.env.local.example`).

## Commands

```bash
npm run dev          # Next.js dev server (no DATABASE_URL → "no-DB mode", APIs return empty)
npm test             # Jest — full suite ~15s, no DB/network needed
npm run test:watch
npm test -- --coverage
npm run lint         # next lint (warnings allowed, see eslint.config.mjs)
npx tsc --noEmit     # typecheck (passes clean as of 2026-08)
npm run build        # ⚠ REQUIRES OPENAI_API_KEY to be set (dummy value works):
                     #   OPENAI_API_KEY=sk-dummy npm run build
                     # because src/lib/openai.ts instantiates the client at module load
                     # and Next build-time page-data collection imports the API routes.
```

There is no CI configured (no `.github/workflows`). Run tests + typecheck + build locally
before pushing.

Database: schema lives in `create-tables.sql` (raw SQL, run manually against Neon).
Several tables are also created lazily at runtime via `CREATE TABLE IF NOT EXISTS`
(e.g. `ensureAnalysisJobSchema` in `src/lib/jobs/analyzeAllWorker.ts`,
`ensureAnalysisScoreSchema` in `src/lib/scoring/schema.ts`). There are **no migrations** —
schema evolution is ad-hoc `ALTER TABLE IF NOT EXISTS`-style statements.

## Architecture

### Core data flow (the path that matters)

```
UI (src/app/page.tsx, 'use client')
 └─ src/lib/client/actions.ts  ──apiFetch (x-api-key header)──►  /api/* routes
     ├─ POST /api/crawl        → crawlAllSources() [src/lib/crawler.ts]
     │    └─ per source: crawlWithAdvancedMethods() [src/lib/advanced-crawler.ts]
     │         (strategy chain: RSS → Brave search → plain fetch → Playwright browser;
     │          sources listed in BLOCKED_SOURCES go Playwright-first)
     │       → dedupe by url/contentHash → INSERT "CrawlResult"
     │       → upsertEvidenceClaims [src/lib/evidence/storage.ts]
     ├─ POST /api/analyze-all  → creates "AnalysisJob" row, fire-and-forget worker
     │    └─ runAnalyzeAllJob [src/lib/jobs/analyzeAllWorker.ts]  (batches, timeouts)
     │         └─ analyzeArticle [src/lib/analysis/pipeline.ts]   ← THE core pipeline
     ├─ POST /api/analyze      → same analyzeArticle for a single article
     └─ GET  /api/data|trends|correlations|insights|anomalies|metrics|arc ...
```

`analyzeArticle` (src/lib/analysis/pipeline.ts) is the heart. Steps, in order:
Layer-0 triage (`analysis/triage.ts`, skip obvious noise) → optional CJK translation
(`analysis/translation.ts`) → OpenAI chat call with `AGI_DETECTION_PROMPT`
(`src/lib/openai.ts`) + 429 retry/backoff → parse via `parseOpenAIResponse`
(`utils/safeJson.ts`, never throws) → evidence claims (`evidence/*`) → heuristic score
(`scoring/multiSignal.ts`) → optional secrecy detection (`detection/silence-patterns.ts`)
→ corroboration penalty → combined score → signal assessment (`methodology/signals.ts`)
→ severity + critical-evidence gate (`severity.ts`) → embedding (512-dim,
text-embedding-3-small) → INSERT "AnalysisResult" + "HistoricalData" rows.

If you change scoring/severity behavior, the tests in `__tests__/lib/{multiSignal,
severity,signals,evidence}.test.ts` are the spec — update them deliberately, not incidentally.

### Module boundaries

| Layer | Where | Notes |
|---|---|---|
| API routes | `src/app/api/*/route.ts` | Thin-ish handlers; JSON `{ success, data?, error? }` |
| Domain logic | `src/lib/**` | Pure-ish modules; most testable code lives here |
| DB access | `src/lib/db.ts` only | Raw parameterized SQL via `pg` Pool. **No ORM.** No repository layer — routes/lib write SQL inline against helpers `query/queryOne/insert/execute/withTransaction` |
| Auth/limits | `src/middleware.ts` + `src/lib/security/*` | `x-api-key` == `LOCAL_API_KEY` for all `/api/*`; per-route in-memory rate limits; SSRF guard `urlValidator.ts` for all crawled URLs |
| Client state | `src/store/appStore.ts` (zustand) | Single store for the whole dashboard |
| Client API calls | `src/lib/client/{api,actions}.ts` | All fetches go through `apiFetch` (adds api key); page components call action functions, not fetch directly |
| Server "app state" | `src/lib/state/appState.ts` | Key/value in "AppState" table (e.g. last crawl time) — distinct from the zustand store despite the similar name |
| UI | `src/app/page.tsx` + `src/components/tabs/*` | Single-page, 5 tabs; presentational components receive store slices as props |

### Database (Neon Postgres + pgvector)

Tables (quoted CamelCase names, Prisma-era naming kept): `CrawlResult`, `AnalysisResult`
(1:1 via unique `crawlId`, `embedding vector(512)`), `HistoricalData`, `TrendAnalysis`,
`AnalysisJob`, `EvidenceClaim`, `CorrelationFinding`, `InsightFinding`, `AppState`,
`SecrecyPattern`, `AccuracyMetrics`, `ARCProgress`.

`src/lib/db.ts` gotchas:
- **No-DB mode**: without `DATABASE_URL`, `isDbEnabled` is false and `query/insert/execute`
  silently return empty results — routes must check `isDbEnabled` for honest 503s.
- `NEON_ONLY` (default on) refuses localhost DB hosts; the UI shows a full-screen blocker.
- Column names must be double-quoted in SQL (`"crawlId"`).

## Conventions (follow these; do not "improve" them opportunistically)

- **Error handling:** `try/catch` + `console.warn`/`console.error` with a `[Tag]` prefix
  (`[Crawler]`, `[Pipeline]`, `[DB]`, `[Analyze All]`…), then **degrade gracefully** —
  return `[]` / `null` / skip the enrichment rather than throw. Only the truly fatal path
  throws. API routes catch everything and return
  `NextResponse.json({ success: false, error, details? }, { status })`.
- **API response shape:** `{ success: boolean, data?, meta?, error?, details?, message? }`.
- **Config via env vars** parsed inline with defaults, e.g.
  `parseInt(process.env.ANALYZE_BATCH_SIZE || '2', 10)`. New tunables follow this pattern
  and get documented in `.env.local.example` + README.
- **Naming:** PascalCase component files; camelCase lib files; kebab-case only for
  multi-word lib modules that predate that (`advanced-crawler.ts`, `brave-search.ts`) —
  match the folder you're in. Path alias `@/*` → `src/*` everywhere; no deep relative imports.
- **Batch worker logging:** long-running jobs push human-readable strings into a `logs: string[]`
  and mirror to `console.log` — keep that dual-write pattern in worker code.
- **LLM calls:** always guard with timeout/retry, parse with `safeJson` helpers (never raw
  `JSON.parse` on model output), and treat model output fields as optional.
- **Crawling:** every outbound URL goes through `isUrlSafeWithDns` (SSRF guard) and the
  rate limiters; keep random delays and UA rotation as-is.
- **TypeScript:** strict mode; `any` is a lint *warning* and exists in legacy spots — don't
  add new ones, don't mass-fix old ones.
- **Commits:** Conventional Commits (`feat:`, `fix(crawler):`, `refactor:` …), imperative mood.

## Test setup

- Jest + ts-jest (ESM) + jsdom + Testing Library; config in `jest.config.js`;
  global setup only imports `@testing-library/jest-dom` (`src/lib/test-utils/setup.ts`).
- Tests live in `__tests__/**` mirroring `src/` areas; pattern `**/__tests__/**/*.{ts,tsx}`.
- Suite needs **no DB, no network, no env vars** — keep it that way. Anything touching
  `pg` or OpenAI must be mocked (see `__tests__/api/feedback.test.ts` for the style).

### Baseline (recorded 2026-08-07, two consecutive clean runs)

- **14 suites / 147 tests, all passing**, ~12–16s wall clock. No flaky tests observed.
- Coverage is concentrated in pure-logic leaf modules:
  well covered — `detection/silence-patterns` (98%), `utils/safeJson` (100%),
  `security/auth` (100%), `brave-search` (93%), `evals/metrics`, `evidence/extract`,
  `methodology/signals`, `scoring/multiSignal` (76–87%).
  Thin — `security/urlValidator` (59%), `severity` (54%), `arc-sources/*` (12–27%).
- **Zero test coverage on the core path**: `crawler.ts`, `advanced-crawler.ts`,
  `analysis/pipeline.ts`, `db.ts`, all API routes except feedback, `jobs/*`, `insights.ts`,
  `trends.ts`, `correlations.ts`, the zustand store, and every component except
  `LoadingSpinner`. **Before modifying any of these, write characterization tests first**
  (mock `db.query` and `openai`) — that is the ticket, not the feature.

## Ugly parts / known traps (verified 2026-08)

- **`AGENTS.md` is stale — this file supersedes it.** It references Prisma
  (`prisma/`, `src/lib/prisma.ts`, migrate commands) and `firecrawl-crawler.ts`; the code
  actually uses raw `pg` and the Firecrawl crawler is archived
  (`src/lib/firecrawl-crawler.ts.archived`). `.env.local.example` and README also retain
  Prisma-era comments (`DIRECT_URL`, "Prisma reads DATABASE_URL"). README badge says
  Next.js 14 / one section says GPT-4o-mini; reality is Next 15 / `gpt-5-mini` default.
- **Build requires `OPENAI_API_KEY`** (even a dummy) — module-load client in
  `src/lib/openai.ts:4`. Symptom: `next build` dies in "Collecting page data" on
  `/api/analyze`.
- **Two things named "app state"**: `src/store/appStore.ts` (client zustand) vs
  `src/lib/state/appState.ts` (server, DB-backed KV). Don't confuse them.
- **Two crawlers**: `crawler.ts` (cheerio/axios + per-source selectors) and
  `advanced-crawler.ts` (RSS/Brave/fetch/Playwright strategy chain). `crawlAllSources`
  tries advanced first and falls back to simple; source configs (selectors, flags like
  `playwrightFirst`, `isAnthropicNews`) live in `SOURCES` in `crawler.ts` and are
  interpreted by *both* files.
- **In-memory rate limiting and job state** (`security/rateLimit.ts`, module-level flags)
  assume a single long-lived server process — serverless/multi-instance deploys reset them.
- **Fire-and-forget batch jobs**: `/api/analyze-all` starts `runAnalyzeAllJob` without
  awaiting; progress is polled from the `AnalysisJob` table via `/api/analyze-status`.
  A crashed worker leaves the job row stuck in `running`.
- **Lazy schema creation** scattered in lib code (`ensure*Schema`) means the DB schema is
  the union of `create-tables.sql` + whatever `ensure*` functions have run — check both
  before assuming a column exists.
- **Maintenance/debug routes are production-reachable** (behind the api key):
  `backfill-*`, `fix-arxiv-urls`, `rebuild-trends`, `test-crawl`, `test-crawler`,
  `test-openai`, `db-info`. Be careful what you add there.
- **Selector fragility**: the per-source CSS selectors in `SOURCES` break whenever a lab
  redesigns its site; China-lab sources are especially flaky and have Playwright retries +
  sitemap fallbacks for that reason.
