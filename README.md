# CaloriesPro

A Progressive Web App for tracking calories, exercise, hydration, sleep, and body measurements with full offline support and a self-managed food database.

See [`PRD.md`](./PRD.md) for product requirements and [`DELIVERY_PLAN.md`](./DELIVERY_PLAN.md) for the phased build plan.

## Tech stack

Next.js 14 (App Router) · TypeScript (strict) · MongoDB + Mongoose · NextAuth.js · MUI v5 · Zustand + TanStack Query · React Hook Form + Zod · Recharts · `idb` (IndexedDB) · `next-pwa` · Vitest + React Testing Library · Playwright.

## Prerequisites

- Node.js >= 18.17 (Node 20 LTS recommended)
- npm 9+
- MongoDB Atlas cluster or a local `mongod` (only required once Phase 1 lands)

## Setup

```bash
git clone <repo> caloriespro
cd caloriespro
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (`next/core-web-vitals` + Prettier compat) |
| `npm run typecheck` | `tsc --noEmit` against the strict tsconfig |
| `npm test` | Vitest unit tests (jsdom + RTL) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Playwright end-to-end tests (boots dev server) |
| `npm run e2e:install` | One-time install of Playwright browsers |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (used in CI on demand) |

## Project layout

```
app/                      Next.js App Router (layout, providers, pages)
lib/                      Shared server/client utilities (db, theme, …)
__tests__/                Vitest unit / component tests
e2e/                      Playwright end-to-end specs
.github/workflows/ci.yml  Lint + typecheck + unit tests on PR
```

## Phase status

This branch is at the end of **Phase 0 — Foundation & Project Skeleton**. See [`CHANGELOG.md`](./CHANGELOG.md) for what each phase shipped.

## Conventions

- TypeScript strict mode; no `any` without a one-line justification comment.
- All API endpoints validate input with shared Zod schemas; errors are returned as `{ error: string, details?: object }`.
- Every database query for user-owned data is scoped by `userId`; admins may read any user's data.
- `FoodLogEntry.snapshot` is a frozen copy of nutrition at log time — editing or deleting a `Food` must never mutate historical entries.
- Mobile-first: layouts must work down to 360px width.
