# Changelog

All notable changes per phase. Each phase ends with an entry here.

## [Unreleased]

### Phase 6 — Body Measurements

- `BodyMeasurementEntry` model per PRD §4.7 with the eleven `measurementsCm` sub-fields plus `weightKg`, `bodyFatPercent`, `note`, and the reserved `photos: string[]` (declared but never written in v1 — DELIVERY_PLAN.md Phase 6 says no upload UI). All numeric fields default to `null` so a user can log only what they care about that day (F-BM-1). Compound `(userId, date desc)` index for the cards-page "give me everything sorted newest-first" read pattern; `timestamps: true` so the route can also tiebreak by `createdAt` when two entries land on the same calendar day.
- `lib/models/measurement-enums.ts` — pure constants (`CM_METRICS`, `ALL_METRICS`, `METRIC_LABELS`, `METRIC_UNITS`) so the cards / form / history client components can import them without dragging Mongoose into the bundle (same split pattern as `user-enums`, `food-enums`).
- `lib/measurements/delta.ts` — **the heart of Phase 6's "delta vs previous" semantics**. `summariseMetrics(entries)` returns, per metric, `{latest, previous, delta}` where "previous" is the previous *non-null* value of THE SAME metric — not the second-most-recent entry overall. This is what makes the Phase 6 DoD line "logging only weight one day and only chest the next does not break delta display" actually true: each metric has its own per-metric history, computed independently. `metricSeries(entries, metric)` produces an oldest→newest array suitable for the Recharts `<LineChart>` on the history page. Both helpers are pure (no DB, no React) and accept either ISO-string or `Date` for the `date` field. Deltas are rounded to 3 decimals to avoid IEEE-754 fuzz like `70.2 - 70.1 = 0.10000000000000142`.
- `lib/validation/measurement.ts` — strict Zod for both create and update. Numeric fields are `number().positive().nullable().optional()`; `bodyFatPercent` is `[0, 100]` (clamped per the physical units). Both schemas `.refine()` that **at least one numeric metric must be set** — a measurement entry with just a date and a note is meaningless, so the API 400s rather than persisting an empty doc. Update schema additionally rejects an empty body (`{}` → 400) and is `.strict()` so a sneak-in of `userId` or `photos` (the v1-reserved field) is rejected. Top-level *and* nested `measurementsCm` objects are strict — `{measurementsCm: {ankle: 25}}` fails because "ankle" isn't in PRD §4.7.
- API routes (all `userId`-scoped, error shape `{error, details?}` per NFR-4):
  - `GET /api/measurements?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N` — sorted `date desc, createdAt desc`. Default cap = 1000 entries, hard cap also 1000 (the cards page needs *all* of a metric's history to compute "previous", but a single user is unlikely to ever exceed this; pagination can come later if it does).
  - `POST /api/measurements` — validates with `MeasurementCreateSchema`, persists `date` as midnight UTC of the user's calendar day (PRD §4.3 / §4.7 convention shared with the other log models). `photos` is forced to `[]` server-side regardless of payload — the v1 reserved field cannot be written.
  - `PATCH /api/measurements/[id]` — cross-user → 403 (project rule #4). Circumferences are **merged**, not replaced, so a PATCH like `{measurementsCm: {chest: 101}}` updates only chest and leaves waist/hips/etc untouched. `markModified("measurementsCm")` is required because Mongoose's nested-doc change detection misses key-by-key writes.
  - `DELETE /api/measurements/[id]` — cross-user → 403.
- Pages (all gated by the existing `withAuth` middleware — `/measurements/:path*` was already in the matcher from Phase 1, so unauth visits redirect to `/login?callbackUrl=…` for free):
  - **`/measurements`** — cards page. `MeasurementsCardsView` calls `summariseMetrics` over the full entry list, renders a `Grid` of one card per metric **that has at least one logged value** (others are hidden so the page stays uncluttered for a new user). Each card shows the latest value, the date it was logged, and a `Chip` with the signed delta (e.g., `−0.8 kg since Apr 15`) or `First entry` when no previous sample exists. The chip uses a `−` minus glyph for negative deltas (`-` would render too thin against `+`); colour is by magnitude (≥0.1 → warning) since up vs down has no universally "good" direction (gaining weight can be a goal). Each card has `data-testid="metric-card-${metric}"` and the chip `data-testid="metric-delta-${metric}"` so the e2e can target them deterministically.
  - **`/measurements/new`** — form page. One Date input plus inputs for `weightKg`, `bodyFatPercent`, all eleven circumferences, and a multiline note. Empty inputs are dropped from the POST body (not sent as `null`), so the user genuinely "logs only what they want today". Client-side guard mirrors the Zod `.refine()`: at least one numeric metric must be set before the request fires. After save, the TanStack Query `["measurements"]` cache is invalidated and the user is redirected back to the cards page so the new value shows up.
  - **`/measurements/history`** — trend chart page. A metric selector (one entry per metric in PRD order) and a 1W / 1M / 3M / 1Y / All toggle group. The selected range becomes a `?from=` query param on `/api/measurements`; "All" omits the param entirely. The chart itself is a Recharts `<LineChart>` rendered through `next/dynamic` with `ssr: false` — Recharts is sizable runtime code that we don't want shipped on the cards page. Empty-state message when no data falls in the selected range. The chart container has `data-testid="history-chart-${metric}"` for the e2e.

#### Tests

- Unit (33 new across 2 files):
  - `__tests__/measurements/delta.test.ts` — 14 cases. Covers: empty input → all-null map; first-ever entry has `previous=null, delta=null`; signed deltas in both directions; input-order independence; **the Phase 6 DoD edge case** (weight one day, chest the next — both metrics get a latest, neither has a delta because each has only one sample); the trickier variant where chest-only / weight-only / chest-only entries interleave (chest's "previous" is the *first* entry, skipping the middle weight-only one); null and missing keys treated identically; rounding to 3 decimals (`70.2 - 70.1` must yield `0.1`, not `0.10000000000000142`); `Date` instance accepted for the `date` field as well as an ISO string. `metricSeries` covers the chronological-order guarantee, the metric-not-present case, and null-skipping inside mixed entries.
  - `__tests__/validation/measurement.test.ts` — 19 cases. Create: weight-only / circumference-only accepted; **no-metrics-only-note rejected** (the `.refine()` that backs the Zod-level "at least one number" rule); negative weight rejected; zero weight rejected (positive only — a 0 kg measurement is a typo, not data); body fat 0/100 boundaries accepted, 101 rejected; malformed date rejected; strict rejection of unknown keys at the top level *and* inside `measurementsCm` (e.g. `{ankle: 25}`); explicit `null` accepted for an optional metric (skips it). Update: single-field PATCH allowed for any of date / weight / bodyFat / measurementsCm / note; **empty body rejected** (an empty PATCH is a 400, not a no-op); strict rejects `photos` and `userId` sneak-ins.
- E2E (`e2e/measurements-flow.spec.ts`, 2 tests):
  - **`measurements-flow.spec.ts:17` — log → cards page shows latest + delta vs previous.** Seeds an Apr 15 weight (72 kg) via the API, then logs May 1 (70 kg + chest 100 cm) through the form. Asserts the weight card shows `70 kg` and a delta chip containing `−2 kg`; asserts the chest card shows `100 cm` and a `First entry` chip (because chest has only one sample). Then opens History, switches to All, and asserts the weight chart container becomes visible (Recharts having mounted in the dynamically-loaded chunk).
  - **`measurements-flow.spec.ts:50` — cross-user 403, no-metrics 400, body-fat range 400.** A creates an entry; A's own no-metrics POST → 400; A's body-fat=150 POST → 400; B in a fresh browser context cannot see the entry in their listing, gets 403 on PATCH and DELETE; anon GET → 401; A's entry survives intact (weight 70 + chest 100 still present after B's failed attacks).

#### Migrations / indexes

- New collection: `bodymeasuremententries`
  - `(userId)` (single-field index from the schema — for cross-collection user dashboards in Phase 7)
  - `(userId, date -1)` — for the date-desc list endpoint and the Phase 7 dashboard's "current weight" lookup. Descending because the cards-page query is "give me the newest entry first"; an ascending index would still work but `date -1` matches the read pattern exactly.

Created lazily on first insert; no data migration required.

#### Notes / decisions

- **"At least one numeric metric" is enforced in Zod, not just in the UI.** F-BM-1 says all numeric fields are optional, but a measurement entry with no numbers (just a date and a maybe-note) is meaningless data. The `.refine()` on `MeasurementCreateSchema` blocks this at the API layer so a bad client (or a future replay endpoint in Phase 8) can't sneak it in. The error message tells the user what they need to provide.
- **Per-metric "previous", not per-entry.** This is the part of the spec that's easy to get subtly wrong. If user logs only weight on Mon and only chest on Tue, then chest's "previous" must be `null` (the user has never logged chest before) — not Monday's weight value. The `summariseMetrics` algorithm walks the entry list in date-desc order and tracks the first two non-null samples *of each metric independently*. Two of the unit tests pin this behaviour explicitly so a future refactor can't regress it.
- **`photos` is reserved but never written.** The schema declares `photos: string[]`, the route forces `photos: []` on POST regardless of payload, and the Update Zod schema is `.strict()` so a PATCH cannot set it either. When the photo upload feature lands (deliberately deferred to the out-of-scope backlog in DELIVERY_PLAN.md), the API surface is already shaped for it.
- **PATCH merges `measurementsCm`, doesn't replace it.** A user updating just chest should not nuke their previously-logged waist value. The route iterates `CM_METRICS` and only touches the keys present in the payload. `markModified("measurementsCm")` is needed because Mongoose's dirty-tracking on nested sub-docs misses single-key writes — without it the save would silently drop the change.
- **Recharts is dynamically imported on the history page only.** It's a non-trivial runtime (≈100 kB minified) that never needs to load on the cards page. `dynamic(..., {ssr: false})` keeps the cards page's bundle lean and matches Phase 0's intent to use Recharts only where charts actually appear.
- **Cards page hides metrics with no data.** A brand-new user logging only weight should see one weight card, not thirteen empty cards with "—" placeholders. When the user logs more metrics over time, more cards appear.
- **No pagination on `GET /api/measurements`.** The cards page genuinely needs the full per-metric history to compute "previous", and a year of daily measurements is ~365 entries — well under the 1000-entry cap. If a power user crosses that, the cap silently limits the read; pagination is a Phase 10 concern (or whenever it actually breaks).

---

### Phase 5 — Exercise, Water, Sleep Logs

- Three new Mongoose models per PRD §4.4–§4.6, each `userId`-indexed and with a compound `(userId, date)` index for the per-day queries the dashboard (Phase 7) and these pages need:
  - `ExerciseEntry` — required `caloriesBurned` (≥0), nullable `note`, `loggedAt` defaulted to `new Date()`. Multiple per day permitted (F-EX-2 — the dashboard sums them).
  - `WaterLogEntry` — required `amountMl` (≥1), `loggedAt` defaulted to `new Date()`. The PRD field name is preserved verbatim (project rule #3).
  - `SleepEntry` — `bedtime`, `wakeTime`, `durationMinutes` (computed at write time), `quality` ∈ [1,5] integer, nullable `note`. `date` is the wake date (PRD §4.6 explicit choice), midnight UTC, so `?date=YYYY-MM-DD` queries return "the night that ended on this date".
- `lib/log/sleep.ts` — `sleepDurationMinutes(bedtime, wakeTime)` computes duration from two `Date` instants, rounded to the nearest minute. **Cross-midnight just works** because both inputs are full datetimes — no calendar arithmetic, just `(end - start) / 60_000`. Returns `null` when wakeTime ≤ bedtime or either input is invalid; the API turns that into a 400. The route handler computes duration on POST (and recomputes on PATCH if either timestamp changes) so clients can never desync `bedtime`/`wakeTime` from `durationMinutes`.
- Zod validation schemas (shared client/server per project rule #6, all `.strict()`):
  - `lib/validation/exercise-log.ts` — `ExerciseCreateSchema` requires `date` + `caloriesBurned`; note is optional/nullable. `ExerciseUpdateSchema` is partial but `.refine()`'d to require at least one of caloriesBurned/note (an empty PATCH is a 400, not a no-op).
  - `lib/validation/water-log.ts` — `WaterCreateSchema`: integer `amountMl` ∈ [1, 10_000]. No update schema (water entries are immutable; only DELETE is exposed, matching PRD §7).
  - `lib/validation/sleep-log.ts` — `SleepCreateSchema` cross-field-validates `wakeTime > bedtime`. `SleepUpdateSchema` mirrors that constraint **only when both timestamps are sent** so a quality-only or note-only PATCH still works.
- API routes (all userId-scoped, error shape `{error, details?}` per NFR-4):
  - `GET /api/logs/exercise?date=YYYY-MM-DD`, `POST /api/logs/exercise`, `PATCH/DELETE /api/logs/exercise/:id`.
  - `GET /api/logs/water?date=YYYY-MM-DD`, `POST /api/logs/water`, `DELETE /api/logs/water/:id` (no PATCH per PRD §7 — water is "log it again" not "edit it").
  - `GET /api/logs/sleep?date=YYYY-MM-DD`, `POST /api/logs/sleep`, `PATCH/DELETE /api/logs/sleep/:id`. POST and the timestamp-touching branch of PATCH both run `sleepDurationMinutes` and return 400 if it's null, so the persisted `durationMinutes` is always consistent with its timestamps.
- Pages (all under the existing `withAuth` middleware so unauth visits redirect to `/login?callbackUrl=…`):
  - `/log/exercise` — date picker + Today button, daily-total card (sum of `caloriesBurned` for the date — F-EX-2), inline form with `caloriesBurned` (number, required) and optional `note`, entries list with delete (F-EX-3).
  - `/log/water` — date picker + Today button, daily-total card with **`LinearProgress` against the user's `goals.dailyWaterMl`** + percent label (F-WTR-2), three quick-add buttons (`+250`/`+500`/`+750` ml — F-WTR-1) + custom integer input, entries list with delete. When the user has no water goal yet, the progress bar is replaced with an info alert pointing to Settings.
  - `/log/sleep` — wake-date picker, bedtime + wake-time `datetime-local` pickers (defaults: yesterday 23:00 → today 07:00 in the browser's local TZ), live duration preview (`<testid="sleep-duration-preview">`), MUI `Rating` 5-star quality input, optional multiline note, entries list with delete. Times are converted to ISO via `Date.toISOString()` before POST so the server sees a UTC instant regardless of the user's TZ.

#### Tests

- Unit (36 new across 4 files):
  - `__tests__/log/sleep.test.ts` — 8 cases covering whole-hour duration, **the cross-midnight edge case (PRD §4.6)** at 23:30 → 07:15 = 7h 45m, daytime nap, sub-minute rounding, equal-times → null, inverted → null, invalid Date → null, and a multi-day sanity case.
  - `__tests__/validation/exercise-log.test.ts` — 11 cases: zero calories accepted, negative rejected, malformed date rejected, strict rejection of unknown keys; update schema rejects empty body and rejects sneak-in of `date` or `userId`.
  - `__tests__/validation/water-log.test.ts` — 6 cases: zero/negative/fractional/oversized rejected, malformed date rejected, strict rejection of unknown keys.
  - `__tests__/validation/sleep-log.test.ts` — 11 cases: wakeTime ≤ bedtime rejected on both create and update (only when both timestamps present), quality ∈ {1,2,3,4,5}, malformed datetime rejected, strict rejection of `durationMinutes` (server-computed, never client-supplied).
- E2E (6 new across 3 files):
  - **`log-exercise.spec.ts:17` — log → totals sum → delete.** Logs 250 kcal + a note, asserts both visible; logs 100 more, asserts 350 kcal total; deletes the 250 row, asserts the note is gone and 100 kcal remains.
  - **`log-exercise.spec.ts:41` — cross-user 403.** A creates an entry; B in a fresh browser context cannot see it in their date listing, gets 403 on PATCH and DELETE; anon GET → 401; A's entry survives intact.
  - **`log-water.spec.ts:17` — quick-add → custom → progress → delete.** Sets `dailyWaterMl: 2000` via `/api/goals`; uses `+250` quick-add (asserts 250 ml + 13% progress), then `+500` (asserts 750 ml total), then a custom 100 ml (asserts 850 ml), then deletes the 100 ml row (asserts 750 ml).
  - **`log-water.spec.ts:57` — cross-user 403.** A logs 250 ml; B cannot see/delete; anon → 401; A's entry survives.
  - **`log-sleep.spec.ts:17` — sleep crossing midnight → duration → delete.** Uses the deterministic past date 2026-05-02 23:30 → 2026-05-03 07:15 (TZ-flake-resistant: a fixed past date doesn't depend on "today"); asserts the duration preview shows `7h 45m`, picks 4-star quality, logs the entry, asserts it appears with the same duration, then deletes.
  - **`log-sleep.spec.ts:48` — cross-user 403 + invalid time POST 400.** A creates an entry, asserts the API computed `durationMinutes` = 480 server-side (8h); B cannot see/PATCH/DELETE; anon → 401; A's POST with bedtime > wakeTime is 400 (cross-field validation honoured even when payload is otherwise well-formed).

#### Migrations / indexes

- New collection: `exerciseentries`
  - `(userId)` (single-field index from the schema — for cross-collection user dashboards in Phase 7)
  - `(userId, date)` — for the date-filtered list endpoint and dashboard aggregations
- New collection: `waterlogentries`
  - `(userId)` and `(userId, date)` — same pattern
- New collection: `sleepentries`
  - `(userId)` and `(userId, date)` — same pattern. Wake-date is the indexed field per PRD §4.6.

All three collections are created lazily on first insert; no data migration required.

#### Notes / decisions

- **Water has no PATCH endpoint.** PRD §7 lists `DELETE /api/logs/water/:id` only, and the UX matches: a wrong amount is logged again or removed, not edited. This matches the F-WTR-1 quick-add philosophy — entries are atomic mini-events rather than long-form records.
- **Sleep `durationMinutes` is server-computed, not client-supplied.** Even though the form previews it, the API recomputes it from `bedtime` and `wakeTime` on POST and on any timestamp-touching PATCH. The Zod schema's `.strict()` mode actively rejects a client-sent `durationMinutes` so a bad client can't desync the field from its timestamps.
- **Sleep `date` = wake date.** PRD §4.6 is explicit; this matches how users think ("how did I sleep last night?" → asks about the date you woke up). It also makes the per-day GET semantics intuitive: `?date=2026-05-03` returns the night that ended this morning.
- **Sleep duration uses real `Date` instants, not local time arithmetic.** That's why crossing midnight Just Works — the difference of two ms-since-epoch is timezone-independent. The unit test for the 23:30 → 07:15 case pins this behaviour so a future regression to "local time of bedtime + delta" would fail loudly.
- **Exercise `note` and sleep `note` Zod allow `null` *and* `undefined`.** Forms send `null` to clear; admin tools that PATCH only one field can omit the key. Both shapes are equivalent server-side (`undefined` means "leave alone", explicit `null` means "clear").

---

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
