# Repository Guidelines

## Project Structure & Module Organization
- App router and pages: `src/app` (API routes in `src/app/api/*/route.ts`).
- UI components: `src/app/components/*` and `src/components/*`.
- Libraries/services: `src/lib` (e.g., `openai.ts`, `firecrawl-crawler.ts`).
- Database: `prisma/` (schema + migrations), runtime client at `src/lib/prisma.ts`.
- Tests: `__tests__/` mirroring feature areas (api, components, utils).
- Static assets: `public/`.

## Build, Test, and Development Commands
- `npm run dev` — Start Next.js dev server.
- `npm run build` — Production build.
- `npm start` — Run built app.
- `npm run lint` — ESLint (Next + TypeScript rules).
- `npm test` / `npm run test:watch` — Jest unit/component tests.
- Database: `npx prisma migrate dev --name <change>` and `npx prisma generate` (requires `DATABASE_URL`).

## Coding Style & Naming Conventions
- Language: TypeScript/TSX, 2‑space indentation, strict mode enabled.
- Components: PascalCase filenames (e.g., `LoadingSpinner.tsx`), default export for pages, named exports for libs.
- Paths: use alias `@/` for `src/*` (see `tsconfig.json`).
- Linting: follow `next/core-web-vitals` + `next/typescript`; fix warnings before PR.

## Testing Guidelines
- Framework: Jest + Testing Library (`jest-environment-jsdom`).
- Location/Pattern: tests in `__tests__/**/*.test.{ts,tsx}`.
- Write tests for new logic and regressions; include component render/assertions and lib unit tests.
- Useful: `npm test -- --coverage` to inspect coverage locally.

## Commit & Pull Request Guidelines
- Commit style: Prefer Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Example: `fix(ui): prevent spinner flash`.
- PRs must include: clear summary, linked issues (e.g., `Closes #123`), screenshots/GIFs for UI changes, and test/lint status.
- If DB schema changes: include migration (`prisma/migrations/*`) and note any backfill/rollout steps.

## Security & Configuration Tips
- Secrets from env: `OPENAI_API_KEY` (or `API_KEY`), `FIRECRAWL_API_KEY`, `DATABASE_URL`. Store in `.env.local` / CI secrets; never commit.
- Avoid logging secrets; guard debug logs with env flags.
- Rate‑limit and cache external calls (see `src/lib/*`) to respect provider limits during development.
 - Optional: `BRAVE_API_KEY` enables site-restricted fallback search.
