# Repository Guidelines

**Read `CLAUDE.md` — it is the authoritative onboarding doc for AI coding agents**
(architecture map, conventions, hard rules, test baseline, known traps). This file is
just a pointer plus the essentials.

## Quick facts

- Next.js 15 App Router + React 19 + TypeScript (strict). Path alias `@/*` → `src/*`.
- Database: raw parameterized SQL via `pg` against Postgres + pgvector (Neon by default;
  `NEON_ONLY=false` allows other hosts). **No Prisma, no ORM, no migrations** — schema
  bootstrap is `create-tables.sql`, evolution is ad-hoc `ensure*Schema()` functions.
- Tests: Jest + ts-jest + Testing Library in `__tests__/**`; the suite needs no DB,
  network, or env vars. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and
  `npm run build` before pushing (there is no CI).
- Commits: Conventional Commits (`feat:`, `fix(crawler):`, …), imperative mood.
- Secrets via `.env.local` only (see `.env.local.example`); never commit them.

## Hard rules (details in CLAUDE.md)

- No drive-by refactoring; follow existing conventions.
- No new dependencies without asking.
- No changes outside the stated task scope; enhancements/refactors go in their own PR.
- Write characterization tests before touching core-path modules that lack coverage.
