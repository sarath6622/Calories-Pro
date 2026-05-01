# Changelog

All notable changes per phase. Each phase ends with an entry here.

## [Unreleased]

### Phase 0 — Foundation & Project Skeleton

- Scaffolded Next.js 14 (App Router) with TypeScript strict mode (`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`).
- Added MUI v5 with light/dark theme scaffold (`lib/theme.ts`), wired through the App Router cache provider in `app/providers.tsx`.
- Wired TanStack Query provider alongside MUI.
- Added `lib/db.ts` Mongoose cached connection helper (serverless-safe, lazily reads `MONGODB_URI`).
- Added project dependencies: Zod, React Hook Form, Zustand, TanStack Query, Recharts, `idb`, `bcryptjs`, NextAuth.
- Tooling: ESLint (`next/core-web-vitals` + Prettier compat), Prettier, strict tsconfig.
- Tests: Vitest + React Testing Library with one passing smoke test rendering `app/page.tsx`.
- E2E: Playwright with one passing smoke spec for the home page; dev server auto-booted via `webServer`.
- CI: GitHub Actions workflow runs lint, typecheck, and unit tests on every PR and on pushes to `main`.
- Docs: `README.md` setup steps; `.env.example` for `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

#### Migrations / indexes

None — no Mongoose models registered yet.
