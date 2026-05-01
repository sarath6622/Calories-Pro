# Changelog

All notable changes per phase. Each phase ends with an entry here.

## [Unreleased]

### Phase 1 — Auth & User Profile

- `User` Mongoose model implemented per PRD §4.1, with `profile` / `goals` / `reminders` sub-docs and `toJSON` transform that strips `passwordHash` and exposes `id`. Profile fields are optional at signup so users can complete them later on `/profile`; Phase 2 will treat missing values as "needs onboarding" rather than schema errors.
- `PasswordResetToken` collection (separate from `User` to keep PRD §4.1 canonical): stores SHA-256 hash of a 32-byte random token + expiry. TTL index on `expiresAt` lets MongoDB auto-purge expired rows.
- Shared enums extracted into `lib/models/user-enums.ts` so client components can import `ACTIVITY_LEVELS`, `SEX_VALUES`, etc. without pulling Mongoose into the browser bundle.
- Shared Zod schemas (`lib/validation/auth.ts`, `lib/validation/profile.ts`) used on both client (RHF resolver) and server (route validation) per project rule #6.
- API error responses use the `{ error: string, details?: object }` shape (NFR-4) via `lib/api/errors.ts`.
- NextAuth configured with the Credentials provider, JWT session strategy, and a typed `session.user.id` / `session.user.role` (augmentations in `types/next-auth.d.ts`). bcrypt cost factor 12 (F-AUTH-1).
- Email sending via `nodemailer`: `jsonTransport` in dev (logs payload to the server console); SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) take over when set.
- API routes:
  - `POST /api/auth/signup` — creates user with bcrypt-hashed password.
  - `POST /api/auth/forgot-password` — generates a 24-hour reset token, persists hash, sends email; always returns `{ ok: true }` to avoid leaking which emails exist.
  - `POST /api/auth/reset-password` — verifies token hash + expiry, updates `passwordHash`, marks token used.
  - `GET / PATCH /api/profile` — session-scoped read/update; never accepts a userId from the client.
- Role-based middleware (`middleware.ts`) using `next-auth/middleware`'s `withAuth` to gate `/profile`, `/dashboard`, `/log/*`, `/foods/*`, `/measurements/*`, `/settings/*`. F-AUTH-5 ✓.
- Auth UI: `/signup`, `/login`, `/forgot-password`, `/reset-password` (RHF + Zod, MUI). After signup, the user is auto-signed-in and lands on `/profile`.
- Profile page (server-side session check + DB read; client form for editing) including units sub-form and a sign-out button (F-AUTH-4).
- `/` redirects to `/profile` if authenticated, else `/login` (PRD §8 IA).

#### Tests

- Unit:
  - `__tests__/auth/password.test.ts` — bcrypt cost 12, hash/verify, salt randomness.
  - `__tests__/auth/tokens.test.ts` — token entropy, deterministic SHA-256 hash, **24h expiry verified with mocked clock** (`vi.useFakeTimers()` + `vi.setSystemTime`).
  - `__tests__/validation/auth.test.ts` — Signup/Login/Forgot/Reset Zod schemas, edge cases.
- E2E:
  - `e2e/smoke.spec.ts` — `/` redirects to `/login` for unauth visitors.
  - `e2e/auth-flow.spec.ts` — signup → profile edit → reload (session persists) → sign out → sign back in. Plus a middleware-redirect test.

#### Migrations / indexes

- New collection: `users` — unique index on `email`; secondary index on `role`.
- New collection: `passwordresettokens` — index on `userId`, index on `tokenHash`, **TTL index on `expiresAt`** (auto-purge).
- `lib/db.ts` now connects to the `caloriespro` database explicitly (overridable via `MONGODB_DB`); Atlas URIs without a path no longer fall through to `test`.

#### Notes

- The "tried to read another user's data → 403" test required by project rule #4 is N/A for Phase 1: `GET/PATCH /api/profile` derive the user ID from the session and never accept a path/query userId, so there is no cross-user attack surface here. Cross-user 403 tests start in Phase 3 (`/api/foods/:id`) and onwards.

---

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
