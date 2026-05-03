# Changelog

All notable changes per phase. Each phase ends with an entry here.

## [Unreleased]

### Phase 4 — Food Logging & Daily Log View

- `FoodLogEntry` model per PRD §4.3 with the **snapshot subdocument**: `name`, `caloriesPerServing`, and `macrosPerServing` are denormalised at log time so that future edits to the source `Food` never mutate historical entries (the headline invariant of this phase). `loggedAt` defaults to `new Date()`; `syncedFromOffline: false` is reserved for Phase 8.
- Pure helpers (server + client safe):
  - `lib/log/meal-type.ts` — `MEAL_TYPES`, `MEAL_TYPE_ORDER` (`breakfast → lunch → snack → dinner` for UI grouping), `MEAL_TYPE_LABELS`, and `defaultMealType(now)` implementing the F-LOG-2 windows (04:00–10:30 breakfast, 10:30–15:00 lunch, 15:00–18:00 snack, 18:00–04:00 dinner including across midnight).
  - `lib/log/date.ts` — `isIsoDate`, `startOfDayUTC`, `endOfDayUTC`, `todayIsoDate`. Per PRD §4.3 the `date` field stores midnight UTC of the user's calendar day.
  - `lib/log/snapshot.ts` — `buildFoodSnapshot(food)` deep-copies the nutrition fields with explicit `null` normalisation for `fiberG` / `sugarG`. Tested for independence from the source after build (mutating the food after snapshot does not change the snapshot).
- `lib/validation/food-log.ts` — strict Zod for both create (`foodId`, `date`, `mealType`, `servings`) and update (`servings` only — F-LOG-4 forbids changing the entry's food / date / meal). PATCH explicitly rejects extra keys including `foodId` and `mealType` so the snapshot stays frozen.
- API routes:
  - `GET /api/logs/food?date=YYYY-MM-DD` — userId-scoped, sorted by `loggedAt asc`. Returns the date's entries with their snapshots.
  - `POST /api/logs/food` — validates the food belongs to the caller (rejects another user's `foodId` with 403), builds the snapshot from the current Food values, persists the entry. **F-LOG-3 atomic update on Food**: `$inc: { timesLogged: 1 }, $set: { lastLoggedAt: now }`.
  - `PATCH /api/logs/food/:id` — only edits `servings`. Cross-user → 403. The snapshot is intentionally NOT refreshed on edit; only the multiplier changes.
  - `DELETE /api/logs/food/:id` — cross-user → 403.
- `/log/food` page:
  - Date picker (defaults to today, "Today" shortcut button when off).
  - Daily totals card at the top: total kcal + protein/carbs/fat in grams, computed from the entries' snapshots.
  - Four meal sections (Breakfast → Lunch → Snack → Dinner), each with its own Add button (so the dialog opens with the meal pre-selected) and a per-section total.
  - Each entry row shows `<food name> · <servings> ×`, derived `kcal · P/C/F`, plus edit and delete icon buttons.
  - **`LogFoodDialog`** is shared by add and edit. In create mode it has a debounced search over `/api/foods` and a clickable list; in edit mode it shows a banner with the snapshot's frozen kcal and only the servings field is editable. Live-preview of derived kcal as the user types servings.
- `/log/food` is also wired through the existing role-based middleware so unauth visits redirect to `/login?callbackUrl=/log/food`.

#### Tests

- Unit (33 new across 4 files):
  - `__tests__/log/meal-type.test.ts` — table-driven: 3 cases per meal at boundary + middle, including the dinner window crossing midnight (00:00, 03:59).
  - `__tests__/log/snapshot.test.ts` — copy correctness; **mutating the source food after build does not change the snapshot**; mutating the snapshot after build does not change rebuilds.
  - `__tests__/log/date.test.ts` — accepts YYYY-MM-DD, rejects malformed strings and impossible dates (Feb 30, month 13). UTC anchoring asserted via `toISOString()`.
  - `__tests__/validation/food-log.test.ts` — strict-mode rejection on both schemas; servings-only on PATCH.
- E2E (4 new):
  - **`log-food.spec.ts:1` — log → totals → edit servings → delete.** Logs `TestEgg` (78 kcal) at 2 servings, asserts 156 kcal in the totals; edits to 3 servings, asserts 234 kcal; deletes the row.
  - **`log-food.spec.ts:2` — snapshot preserved across food edit (PRD §4.3 invariant).** Logs `SnapEgg` at 100 kcal/serving × 1 serving; edits the source Food's `caloriesPerServing` to 999 via the API; reloads `/log/food` and asserts the entry still shows 100 kcal. Also re-fetches the food itself and asserts it really did change to 999 (so we know we're not catching a stale-cache illusion).
  - **`log-food.spec.ts:3` — F-LOG-3 counters.** Logs the same food twice via the API; asserts `food.timesLogged` = 2 and `lastLoggedAt` is non-null.
  - **`log-food.spec.ts:4` — cross-user 403.** A logs an entry; B in a fresh browser context attempts to PATCH and DELETE A's entry id and asserts each is 403; B's GET listing for the same date is empty (never includes A's entry); A's entry survives intact.

#### Migrations / indexes

- New collection: `foodlogentries`
  - `(userId, date)` — daily lookup
  - `(userId, date, mealType)` — meal-grouped daily reads
  - `(userId, foodId)` — for "what does this user log most often" / future reverse lookups when a food is deleted
- Existing `foods` collection now has its `timesLogged` and `lastLoggedAt` fields actually written by the POST handler; no schema change required (these were declared with defaults in Phase 3).

#### Notes / decisions

- **PATCH does NOT refresh the snapshot.** Only servings is editable, and even when the user edits their own log, the frozen snapshot wins. This is the strictest reading of the PRD §4.3 invariant; if a user wants up-to-date nutrition, they can delete and re-log.
- **`food.lastLoggedAt` uses wall-clock `now`, not the entry's `date`.** A user backdating a log entry to last month should not push a food forward in the "Recent" tab — recency tracks when the user logged it, not what calendar day they assigned it to.
- **Snapshot is built in the route handler, not a Mongoose pre-save hook.** Explicit-over-magic; tests can verify the produced snapshot directly without spinning up the model.

---

### Phase 3 — Food Database (User-owned)

- `Food` Mongoose model per PRD §4.2 with required `userId`, `name`, `servingSize`, `servingUnit`, `caloriesPerServing`, and `macrosPerServing` (proteinG/carbsG/fatG required ≥0; fiberG/sugarG nullable). Compound indexes on `(userId, name)` for lookup, `(userId, lastLoggedAt -1, timesLogged -1)` for the F-FOOD-4 sort, and `(userId, isFavorite)` for the Favorites filter. `toJSON` exposes `id` and drops `_id` and the version key.
- `lib/models/food-enums.ts` — pure `SERVING_UNITS` and `FOOD_FILTERS` so client components can import them without dragging Mongoose into the bundle (same split pattern as `user-enums`).
- `lib/validation/food.ts` — `FoodCreateSchema` (strict) and `FoodUpdateSchema` = `FoodCreateSchema.partial().strict()` so PATCH bodies validate the same shape and never silently drop typos.
- **`lib/api/session.ts` — first appearance of the project's auth helper for parameterised endpoints.** `getSessionUser()` returns `{ userId, role }` from the JWT; `ownerFilter(user)` returns `{ userId }` for regular users and `{}` for admins (project rule #4: every user-data query is scoped by userId; admins are exempt). `canActOn(user, ownerId)` is the mutation-side equivalent.
- API routes:
  - `GET /api/foods?q=&filter=all|favorites|recent` — userId-scoped list with case-insensitive partial-match name search (F-FOOD-3, regex with input escaping). Sorted by `lastLoggedAt desc, timesLogged desc, name asc` (F-FOOD-4). `filter=favorites` adds `isFavorite: true`; `filter=recent` adds `lastLoggedAt: { $ne: null }`. Capped at 200 results.
  - `POST /api/foods` — creates a food owned by the current user. The client never supplies `userId`.
  - `GET / PATCH / DELETE /api/foods/:id` — load → exists check → `canActOn` ownership check → act. **Returns 403 for another user's food** (project rule #4).
- `/foods` page (server shell + client `FoodsList`):
  - Three filter tabs (All / Favorites / Recent), debounced search (250ms), TanStack Query for the list.
  - Each row shows name + brand, calories per serving, macro breakdown (P/C/F), times logged + last-logged date when present, plus icon-button actions (favorite toggle, edit, delete).
  - **Optimistic favorite toggle** (F-FOOD-5): updates the cached list immediately on click, rolls back on API error.
  - **Hard delete** with a confirm dialog (F-FOOD-2 — log entries' future snapshots will preserve history per PRD §4.3, so soft-delete is unnecessary).
  - Empty-state messages tailored per tab (no favorites yet / no recents yet / database empty with link to add).
- `/foods/new` and `/foods/[id]/edit` share a single client `FoodForm` (RHF + Zod) with serving-unit dropdown, calorie / macro inputs, optional fiber + sugar, and an "Mark as favorite" toggle. The edit page is a server component that loads the food and 404s for ids that aren't valid ObjectIds *or* belong to another user (UI mirrors the API's 403 by returning 404 to avoid leaking existence).
- After save, the FoodForm invalidates the `["foods"]` TanStack Query cache so the list reflects edits immediately on navigation back.

#### Tests

- Unit (11 new): `__tests__/validation/food.test.ts` covers required fields, serving-unit enum, positive serving size, non-negative calories/macros, nullable fiber/sugar, strict-mode rejection of unknown keys for both create and update schemas.
- E2E:
  - `foods-flow.spec.ts` — full CRUD: create two foods → search "egg" matches one and not the other → favorite toggle reflected on the Favorites tab → edit calorie value → list refreshes with the new value → delete with confirm dialog → row removed.
  - **Second e2e: cross-user 403** — user A creates a food, user B signs in in a fresh context, attempts GET / PATCH / DELETE on A's food id and asserts each returns **403**. Unauth request gets 401. A's food survives intact. This is the first place project rule #4's "tried to read another user's data → 403" test convention is exercised.

#### Migrations / indexes

- New collection: `foods`
  - Compound index `{ userId: 1, name: 1 }` (lookup / search)
  - Compound index `{ userId: 1, lastLoggedAt: -1, timesLogged: -1 }` (frequent-first sort)
  - Compound index `{ userId: 1, isFavorite: 1 }` (favorites filter)
- No data migration; the collection is created lazily on first insert.

#### Notes / decisions

- **Hard delete, no soft delete.** Per F-FOOD-2 + DELIVERY_PLAN.md Phase 3 task list, the snapshot pattern (Phase 4) preserves history on log entries, so cascading the delete to the food doc is correct.
- **Status code for cross-user access: 403, not 404.** Project rule #4 is explicit about 403. This does technically leak existence (404 vs 403 distinguishes "doesn't exist" from "exists but not yours"), but the rule prioritises clarity over enumeration-resistance for this app's threat model.
- **`timesLogged` and `lastLoggedAt` are read-only in this phase.** They're declared on the schema with sensible defaults; Phase 4 will increment them when food logs are created.

---

### Phase 2 — Goals & BMR / TDEE

- Pure nutrition helpers (no DB, no React) so they're trivially unit-testable:
  - `lib/nutrition/bmr.ts` — Mifflin-St Jeor for male / female; returns `null` for `sex: "other"` (the equation isn't defined there) so the UI can fall back to manual override per F-GOAL-3. `ageInYears(dob)` lives here too.
  - `lib/nutrition/tdee.ts` — `BMR × ACTIVITY_MULTIPLIERS[level]` with the F-GOAL-2 constants (sedentary 1.2 … very_active 1.9), rounded.
  - `lib/nutrition/macros.ts` — `MACRO_PRESET_SPLITS` mirrors the F-GOAL-4 PRD splits (P/C/F balanced 30/40/30, high-protein 40/30/30, low-carb 35/25/40); `macroGramsFromPreset(kcal, preset)` converts kcal → grams using 4/4/9 kcal/g.
  - `lib/nutrition/water.ts` — `defaultWaterGoalMl(weightKg) = round(weightKg × 35)` (F-GOAL-5); `DEFAULT_SLEEP_HOURS = 8` (F-GOAL-6).
- Schema additions:
  - `User.profile.weightKg` — Phase 2 placeholder so the goals form has a current weight to compute against. Phase 6 will switch the read source to the latest `BodyMeasurementEntry.weightKg`; this field stays as a fallback for users who haven't logged a measurement yet.
  - `User.goals.macroPreset` — `"balanced" | "high_protein" | "low_carb" | "custom"` so the goals form can round-trip preset choice.
- `lib/validation/goals.ts` — strict Zod schema (`.strict()`) for the PATCH body; integer guards on macro grams; sleep ∈ [0, 24].
- `GET / PATCH /api/goals` — session-scoped; PATCH validates with `GoalsUpdateSchema` and `$set: { goals: parsed.data }`.
- `/settings` page (server component → client `GoalsForm`):
  - Suggested-energy card shows BMR + TDEE when DOB / sex / height / weight are all known. When they aren't, an info alert points back to `/profile`. When `sex === "other"`, a different alert says the equation can't be auto-applied and to set the goal manually (F-GOAL-3).
  - **Use {N} kcal as my goal** button writes the TDEE into `dailyCalories` and recomputes preset macros.
  - Macro split dropdown with the three presets + custom; preset modes lock the gram fields and recompute on calorie / preset change.
  - **Use 35 ml/kg** shortcut for the water field, disabled when weight is missing.
  - Sleep target and optional target weight inputs round out the form.
- Profile form gains a Weight (kg) input that drives BMR/TDEE on `/settings` and the water default. `PATCH /api/profile` accepts `weightKg`.

#### Tests

- Unit (40 new across 5 files):
  - `bmr.test.ts` — 6 male table-driven cases + 6 female (≥5 per sex per Phase 2 DoD), age computation, all edge cases (`other`, non-positive weight/height, negative age).
  - `tdee.test.ts` — every activity multiplier asserted explicitly, plus null/zero BMR guards.
  - `macros.test.ts` — preset constants pinned to PRD §5.2, kcal→grams round-trip with all three presets.
  - `water.test.ts` — 35 ml/kg formula, null guards, sleep default.
  - `validation/goals.test.ts` — strict mode rejects unknown keys, negative numbers, non-integer grams.
- E2E:
  - `goals-flow.spec.ts` — signup → fill profile (DOB, sex, height, weight, activity) → `/settings` → BMR/TDEE preview visible → "Use kcal" → preset switch → "Use 35 ml/kg" → save → reload persists.
  - Second test: with default `sex="other"` and no weight, the "Use 35 ml/kg" shortcut is disabled.

#### Migrations / indexes

- `users` collection: two new optional fields — `profile.weightKg` (Number, nullable) and `goals.macroPreset` (String, default `"balanced"`). No new indexes; no migration needed because both are optional with sensible defaults.

#### Notes / decisions

- **`sex: "other"` ≠ broken UI.** The form shows an info alert telling the user to set their daily calorie goal manually; everything downstream still works.
- **`weightKg` lives on `profile` for now.** When Phase 6 introduces `BodyMeasurementEntry`, the goals page should read the latest measurement first and only fall back to `profile.weightKg` if nothing is logged. The PRD §4.7 schema is already canonical there; this is a temporary residence, not a long-term design choice.
- **Activity-multiplier rounding.** TDEE rounds to the nearest kcal. Frontend BMR display also rounds for readability; the underlying number is full precision in unit tests.

---

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
