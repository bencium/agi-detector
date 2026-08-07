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
npm run build        # no env vars needed (the OpenAI client is lazily instantiated;
                     # OPENAI_API_KEY is only required at runtime for analysis calls)
```

There is no CI configured (no `.github/workflows`). Run tests + typecheck + build locally
before pushing.

Database: schema lives in `create-tables.sql` (raw SQL, run manually against the Postgres
instance — Neon or any Postgres with pgvector; `NEON_ONLY=false` allows non-Neon hosts).
It is a complete bootstrap as of 2026-08, but several tables are *also* created lazily at
runtime by per-module `ensure*Schema()` functions (`insights.ts`, `trends.ts`,
`evidence/storage.ts`, `evals/storage.ts`, `scoring/schema.ts`, `state/appState.ts`,
`jobs/analyzeAllWorker.ts`, `semantic-correlations.ts`). There are **no migrations**;
schema evolution is ad-hoc `ALTER TABLE … IF NOT EXISTS`. When adding a table, add it to
**both** an `ensure*Schema()` function and `create-tables.sql`, keeping the DDL identical.

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
| Client state | `src/store/appStore.ts` (zustand, `persist` to localStorage) | Single store; `page.tsx` is the **sole** `useAppStore()` consumer and passes slices down as props |
| Client API calls | `src/lib/client/{api,actions}.ts` | All fetches go through `apiFetch` (adds `x-api-key`); async UI logic lives in `actions.ts` functions taking the store as first arg — components never call `fetch` directly (known exceptions: `AnomalyDetection.tsx`, `SemanticSearch.tsx` self-fetch with local state) |
| Server "app state" | `src/lib/state/appState.ts` | Key/value in "AppState" table (e.g. last crawl time) — distinct from the zustand store despite the similar name |
| UI | `src/app/page.tsx` + `src/components/tabs/*` | Single-page, 5 tabs; tab components are pure presentational (props in, callbacks out) |

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
- **Lazy schema pattern:** modules that own a table export an `ensure<X>Schema()` that runs
  `CREATE TABLE IF NOT EXISTS` behind a module-level `let ensured = false` guard, wrapped
  in try/catch that only warns. New tables follow this pattern *and* get added to
  `create-tables.sql`.
- **Table naming:** quoted PascalCase tables and camelCase columns (`"AnalysisResult"`,
  `"crawlId"`) — a Prisma-era convention that all live code follows. (The dead `learning/*`
  modules use snake_case; do not copy them.)
- **Components:** most export both a named and a default export; tab components stay
  presentational — data fetching belongs in `client/actions.ts`, state in the zustand store.
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

### Baseline (updated 2026-08-07)

- **16 suites / 164 tests, all passing**, ~7–16s wall clock. No flaky tests observed.
- Coverage is concentrated in pure-logic leaf modules:
  well covered — `detection/silence-patterns` (98%), `utils/safeJson` (100%),
  `security/auth` (100%), `brave-search` (93%), `evals/metrics`, `evidence/extract`,
  `methodology/signals`, `scoring/multiSignal` (76–87%).
  Thin — `security/urlValidator` (59%), `severity` (54%), `arc-sources/*` (12–27%).
- Core-path modules with characterization tests (mock only the `@/lib/db` /
  `@/lib/openai` / `next/server` edges — use these as templates):
  `analysis/pipeline.ts` (`__tests__/lib/pipeline.test.ts`),
  `jobs/analyzeAllWorker.ts` (`analyzeAllWorker.test.ts`),
  `security/rateLimit.ts` (`rateLimit.test.ts`).
- **Still zero test coverage**: `crawler.ts`, `advanced-crawler.ts`, `db.ts`, all API
  routes, `insights.ts`, `trends.ts`, `semantic-correlations.ts`, the zustand store, and
  all components. **Before modifying any of these, write characterization tests first** —
  that is the ticket, not the feature.

## Dead code

The large dead trees were removed in 2026-08 (`lib/correlations.ts`, `lib/learning/*`,
`app/components/**`, `app/types/**`, `lib/validation/schema.ts`,
`hooks/useConsoleCapture.ts`, the archived Firecrawl crawler + its two root docs) — see
git history if you need them (e.g. `learning/*` was a never-wired ruvector experiment;
the README roadmap still mentions reviving that idea).

Still present but unused (left in place deliberately — removing exports touches live
files): `scoreLabels.getSeverityLabel`, `urlValidator.filterSafeUrls`,
`kaggle-integration.trackTeamProgress`, and the `"CorrelationFinding"` table
(in `create-tables.sql`; nothing writes to it since semantic correlations replaced the
SQL-aggregate approach in commit `02c1e66`).

## Docs: what to trust

- **Current & authoritative:** `docs/methodology.md` (mirrors `lib/methodology/signals.ts` —
  the watch-priority vs evidence-confidence split), this file.
- **Partially stale:** `README.md` (badge says Next 14, one section says GPT-4o-mini;
  reality: Next 15, `gpt-5-mini` default; feature list is otherwise roughly right).
  `.env.local.example` retains Prisma-era comments (`DIRECT_URL`, "Prisma reads
  DATABASE_URL") — the vars themselves are still correct.
- **Stale — historical artifacts only:** `AGENTS.md` (Prisma/Firecrawl era),
  `docs/Specification|Pseudocode|Architecture|Refinement|Completion.md` (original SPARC
  planning docs describing a MongoDB/pages-router app that was never built this way),
  `docs/ruv.md` (raw research dump).

## Ugly parts / known traps (verified 2026-08)

- **Auth is skipped entirely in dev** when `LOCAL_API_KEY` is unset
  (`src/middleware.ts:5`) — every `/api/*` route is open. Deliberate, but don't rely on
  middleware auth in anything security-sensitive you add.
- **Two things named "app state"**: `src/store/appStore.ts` (client zustand; its interface
  is even named `AppState`) vs `src/lib/state/appState.ts` (server, DB-backed KV). Same
  trap with `SourceStatus`: a UI card model in `components/MonitoringStatus.tsx` vs a
  freshness enum in `methodology/signals.ts`. `Severity` is declared in three places
  (`severity.ts`, `utils/safeJson.ts`, `types/index.ts`).
- **Two crawlers**: `crawler.ts` (cheerio/axios + per-source selectors) and
  `advanced-crawler.ts` (RSS/Brave/fetch/Playwright strategy chain). `crawlAllSources`
  tries advanced first and falls back to simple; source configs (selectors, flags like
  `playwrightFirst`, `isAnthropicNews`) live in `SOURCES` in `crawler.ts` and are
  interpreted by *both* files.
- **In-memory everything**: rate limiting (`security/rateLimit.ts` — a `Map` on
  `globalThis`), the analyze-all job queue (`jobs/analyzeAllQueue.ts`, in-process FIFO),
  and all `ensured` schema flags assume one long-lived server process.
  Serverless/multi-instance deploys (e.g. Vercel) reset or duplicate them; a crashed
  worker leaves its `AnalysisJob` row stuck in `running`, and no worker resumes it.
- **"Analyze all" is really "analyze next 50"** (`ANALYZE_JOB_LIMIT`).
- **Scoring subtleties** (`scoring/multiSignal.ts:110`): the combined score is
  `max(modelScore, weighted) + boosts − penalties`, so the heuristic can *raise* but never
  *lower* the model score — the MODEL/HEURISTIC weight env vars are largely decorative.
  Severity is monotonic (`computeSeverity` never decreases) and `enforceCriticalEvidenceGate`
  demotes critical→high without a benchmark delta. Understand this before "fixing" scores.
- **Insights window floor**: `insights.ts:182` clamps the SQL window to ≥180 days, so a
  "30-day" insight is computed from 180 days of data; only the row's `windowDays` label
  differs.
- **Client actions auto-widen windows**: `fetchCorrelations`/`fetchInsights`
  (`client/actions.ts`) recursively retry with a bigger window on empty results — one call
  can issue up to three requests. The widened window is shown in the UI badge.
- **SSRF validator escape hatch**: `urlValidator.ts:106-144` allowlists ~10 Chinese
  research hostnames to pass when DNS resolution *fails* (GFW flakiness) — a deliberate
  bypass of IP validation for those hosts. Don't widen that list casually.
- **Maintenance/debug routes are production-reachable** (behind the api key):
  `backfill-*`, `fix-arxiv-urls`, `rebuild-trends`, `test-crawl`, `test-crawler`,
  `test-openai`, `db-info`. Be careful what you add there.
- **Selector fragility**: the per-source CSS selectors in `SOURCES` break whenever a lab
  redesigns its site; China-lab sources are especially flaky and have Playwright retries +
  sitemap fallbacks for that reason.
