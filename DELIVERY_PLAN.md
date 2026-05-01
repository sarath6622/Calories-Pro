# Phased Delivery Plan — Calorie & Wellness Tracker

> Companion to `PRD.md`. This file is structured for **Claude Code** to execute phase-by-phase. Each phase is self-contained, has a definition of done, and ends in a working, deployable state.

---

## How to Use This Plan with Claude Code

**For each phase**, run a session like:
```
"Read PRD.md and DELIVERY_PLAN.md. Execute Phase N. Stop at the Definition of Done and show me what you built before moving on."
```

**Rules of engagement** (paste these into the Claude Code prompt):
1. Do not skip ahead to a later phase.
2. Do not invent features not in the PRD — flag them and ask.
3. After each phase, run the verification checklist at the bottom of the phase before declaring it done.
4. Keep commits small and scoped; one PR per phase.
5. Update `CHANGELOG.md` at the end of every phase.

---

## Phase 0 — Foundation & Project Skeleton

**Goal**: A running Next.js app with TypeScript, MUI, MongoDB connection, ESLint, Prettier, and CI.

### Tasks
- [ ] `npx create-next-app@latest` with TypeScript + App Router + ESLint + Tailwind off (we use MUI).
- [ ] Install MUI v5, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`.
- [ ] Set up MUI theme provider with light/dark mode scaffold.
- [ ] Install Mongoose, set up `lib/db.ts` with cached connection (singleton pattern for serverless).
- [ ] Install Zod, React Hook Form, Zustand, TanStack Query, Recharts, `idb`, `bcryptjs`, `next-auth`.
- [ ] Configure `.env.example` with `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- [ ] Set up Vitest + React Testing Library; one passing smoke test.
- [ ] Set up Playwright; one passing smoke test (`/` loads).
- [ ] GitHub Actions CI: lint + typecheck + unit tests on PR.
- [ ] `README.md` with setup steps.

### Definition of Done
- `npm run dev` shows the default page.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e` all pass.
- CI green on a sample PR.

---

## Phase 1 — Auth & User Profile

**Goal**: Users can sign up, log in, log out, reset password, edit profile.

### Tasks
- [ ] Implement `User` Mongoose model per PRD §4.1.
- [ ] Configure NextAuth with Credentials provider; bcrypt cost 12.
- [ ] `/signup`, `/login`, `/forgot-password`, `/reset-password` pages with React Hook Form + Zod.
- [ ] Email sending stub (use `nodemailer` with a console transport in dev; SMTP config in env for prod).
- [ ] Role-based middleware (`middleware.ts`) protecting authenticated routes.
- [ ] `/profile` page: view + edit name, DOB, sex, height, activity level, timezone, units.
- [ ] API: `POST /api/auth/signup`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET/PATCH /api/profile`.
- [ ] Unit tests for password hashing, token generation/expiry.
- [ ] E2E: signup → login → edit profile → logout.

### Definition of Done
- All F-AUTH-* requirements pass.
- Sessions persist across reload.
- Reset token expires after 24h (test with mocked clock).

---

## Phase 2 — Goals & BMR/TDEE Calculator

**Goal**: User can compute their TDEE and set calorie / macro / water / sleep goals.

### Tasks
- [ ] Pure function `lib/nutrition/bmr.ts` implementing Mifflin-St Jeor; **fully unit-tested** with table-driven cases.
- [ ] Pure function `lib/nutrition/tdee.ts` with activity multipliers.
- [ ] `/settings` → Goals section: shows computed TDEE based on profile + most-recent weight (or fallback prompt to log weight first).
- [ ] Macro split presets + custom mode.
- [ ] Water goal default = 35 × weightKg ml; sleep default = 8h.
- [ ] API: `GET/PATCH /api/goals`.
- [ ] Tests cover edge cases: missing DOB, missing weight, both unit systems.

### Definition of Done
- F-GOAL-1 through F-GOAL-6 satisfied.
- Changing profile (e.g., weight) prompts goal recomputation.
- Unit tests cover ≥5 BMR scenarios per sex.

---

## Phase 3 — Food Database (User-owned)

**Goal**: User can create, edit, search, favorite their own foods.

### Tasks
- [ ] `Food` Mongoose model per PRD §4.2 with index on `(userId, name)`.
- [ ] `/foods` list page: search bar, filter tabs (All / Favorites / Recent), sortable.
- [ ] `/foods/new` and `/foods/[id]/edit` form pages.
- [ ] Favorite toggle (optimistic update).
- [ ] Soft-delete? **No** — hard delete; log entries already store snapshot per F-FOOD-2.
- [ ] API: `GET/POST /api/foods`, `GET/PATCH/DELETE /api/foods/:id`.
- [ ] Authorization: every food query scoped by `userId`.
- [ ] Unit tests for Zod schemas.
- [ ] E2E: create food → search → edit → favorite → delete.

### Definition of Done
- F-FOOD-1 through F-FOOD-6 satisfied.
- Cannot read or modify another user's food (test this).

---

## Phase 4 — Food Logging & Daily Log View

**Goal**: User can log food eaten and see a daily breakdown.

### Tasks
- [ ] `FoodLogEntry` model with snapshot logic in pre-save hook.
- [ ] `/log/food` page: date picker, grouped by mealType, totals at top.
- [ ] Quick-add flow: search food → pick servings → confirm meal type (auto-defaulted by time).
- [ ] Edit servings inline; delete with confirm.
- [ ] On log create: increment `food.timesLogged`, update `lastLoggedAt`.
- [ ] API: `GET/POST /api/logs/food`, `PATCH/DELETE /api/logs/food/:id`.
- [ ] Tests: snapshot is preserved when source food is later edited.

### Definition of Done
- F-LOG-1 through F-LOG-5 satisfied.
- Editing a food after logging it does NOT change the historical entry's calories.

---

## Phase 5 — Exercise, Water, Sleep Logs

**Goal**: Three more log types live and integrated with the daily view.

### Tasks
- [ ] `ExerciseEntry`, `WaterLogEntry`, `SleepEntry` models per PRD §4.4–§4.6.
- [ ] `/log/exercise`: simple form (calories burned + note).
- [ ] `/log/water`: quick-add buttons + custom; daily progress bar.
- [ ] `/log/sleep`: bedtime + wake time pickers, duration auto-computed, 5-star quality.
- [ ] APIs for each (see PRD §7).
- [ ] Tests for sleep duration computation (edge case: crosses midnight).

### Definition of Done
- F-EX-*, F-WTR-*, F-SLP-* requirements satisfied.

---

## Phase 6 — Body Measurements

**Goal**: Track weight, body fat, and circumference measurements with trends.

### Tasks
- [ ] `BodyMeasurementEntry` model per PRD §4.7. All numeric fields optional.
- [ ] `/measurements` cards page: most-recent value of each metric + delta vs previous.
- [ ] `/measurements/new`: form with all fields.
- [ ] `/measurements/history`: per-metric trend chart with range selector.
- [ ] `photos` field declared but ignored in v1 (no upload UI).
- [ ] APIs per PRD §7.
- [ ] Tests for delta computation when only some metrics logged.

### Definition of Done
- F-BM-1 through F-BM-4 satisfied.
- Logging only weight one day and only chest the next does not break delta display.

---

## Phase 7 — Dashboard

**Goal**: A unified today / week / month view tying it all together.

### Tasks
- [ ] `/dashboard` page with three tabs: Today, This Week, This Month.
- [ ] Today: calories in / out / net, macros ring, water bar, last sleep, current weight, remaining vs goal.
- [ ] Weekly: line chart of daily calories, macros stacked bar, weight trend, sleep avg, days within ±10% of goal.
- [ ] Monthly: same, 30-day window.
- [ ] Aggregation API: `GET /api/dashboard/today`, `GET /api/dashboard/summary?range=`.
- [ ] Use MongoDB aggregation pipelines (group by date) — write these as documented helpers in `lib/agg/`.
- [ ] Goal-met toast when target reached.
- [ ] Tests for aggregation (seed DB, assert sums).

### Definition of Done
- F-DSH-1 through F-DSH-5 satisfied.
- Page interactive in <500ms after data loads.

---

## Phase 8 — PWA & Offline Support

**Goal**: Installable, offline-capable, with a working sync queue.

### Tasks
- [ ] Generate icons (192, 512, maskable). Place in `/public/icons`.
- [ ] `manifest.json` with name, theme_color, display: standalone, scope, start_url.
- [ ] Service Worker via `next-pwa`:
  - Precache app shell.
  - Stale-while-revalidate for API GET.
  - Network-only for API POST/PATCH/DELETE (queued via Background Sync if offline).
- [ ] Install prompt component (capture `beforeinstallprompt`).
- [ ] IndexedDB store via `idb` for `OfflineSyncQueue` per PRD §4.8.
- [ ] Wrap all log-creation mutations: if offline, write to queue + show "queued" toast.
- [ ] `POST /api/sync/replay` endpoint that accepts a batch and creates entries (idempotent via client-generated UUIDs).
- [ ] Connectivity listener that drains queue with exponential backoff.
- [ ] Mark replayed entries `syncedFromOffline=true`.
- [ ] E2E test (Playwright with `context.setOffline(true)`): create entry offline → go online → verify it appears.

### Definition of Done
- F-PWA-1 through F-PWA-6 satisfied.
- Lighthouse PWA score ≥ 90 (NFR-2).
- App opens and shows last-cached dashboard while offline.

---

## Phase 9 — Notifications & Reminders

**Goal**: Web push for water, meal, sleep, and goal-achievement.

### Tasks
- [ ] Set up Firebase Cloud Messaging project; add web config.
- [ ] Permission request flow gated behind user enabling a reminder.
- [ ] Save push subscription to user record.
- [ ] Server-side scheduler: a Vercel cron job (`/api/cron/reminders`) that runs every 5 min, finds users due for a reminder in their timezone, and sends pushes.
- [ ] Goal-achievement push triggered after log mutations cross threshold.
- [ ] `/settings` reminders panel: toggles + time pickers.
- [ ] Tests for "is this user due for a reminder right now in their TZ" logic.

### Definition of Done
- F-NOT-1 through F-NOT-4 satisfied.
- Receiving a real push notification verified manually on desktop + mobile.

---

## Phase 10 — Polish, Export, Accessibility, Performance

**Goal**: Production-ready quality bar.

### Tasks
- [ ] Data export: `GET /api/export?format=json|csv&from=&to=` with streaming for large CSV.
- [ ] Settings UI: theme toggle, units, export buttons.
- [ ] Run `axe` on every page; fix all critical/serious issues.
- [ ] Run Lighthouse on dashboard, log pages, settings; fix until NFR-1 and NFR-2 met.
- [ ] Add empty-states and error-states to every list view.
- [ ] Add a global error boundary + 404 page.
- [ ] Skeleton loaders on all async content.
- [ ] Documentation pass: update `README.md` with deploy steps, env vars, seeding script.
- [ ] Seed script for demo data (one user, two weeks of logs).

### Definition of Done
- All NFR-1 through NFR-8 satisfied.
- Manual smoke test on Chrome desktop, Safari iOS (installed PWA), Chrome Android.

---

## Cross-Phase Verification Checklist

Run at the end of every phase:
- [ ] All TypeScript files compile with `--strict`.
- [ ] No `any` types added (or each is justified in a comment).
- [ ] New code has tests; coverage on new files ≥ 70%.
- [ ] Authorization checked: tried to access another user's data and got 403.
- [ ] No secrets committed; `.env` gitignored.
- [ ] Migrations / index updates documented in `CHANGELOG.md`.

---

## Phase Dependency Graph

```
0 ─→ 1 ─→ 2 ─→ 3 ─→ 4 ─→ 5 ─→ 6 ─→ 7 ─→ 8 ─→ 9 ─→ 10
                                  │
                                  └─ Phase 7 reads from 4, 5, 6
                                     so do not start 7 until those are merged
```

Phases 8 (PWA) and 9 (Notifications) can technically be parallelized after Phase 5, but for a solo developer the linear path is recommended.

---

## Estimated Effort (rough, for a solo dev)

| Phase | Days |
|---|---|
| 0  | 1   |
| 1  | 2–3 |
| 2  | 1   |
| 3  | 2   |
| 4  | 2–3 |
| 5  | 2   |
| 6  | 1–2 |
| 7  | 2–3 |
| 8  | 2–3 |
| 9  | 2   |
| 10 | 2   |
| **Total** | **~20–25 days** |

---

## Out-of-Scope Backlog (don't build, but track ideas)

- Barcode scanning via `BarcodeDetector` API.
- Photo uploads for measurement progress (the `photos` field is reserved).
- AI-suggested macro splits based on goals.
- Recipe builder (composite foods).
- Multi-user / household accounts.
- Apple Health / Google Fit sync.
