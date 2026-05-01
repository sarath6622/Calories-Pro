# Calorie & Wellness Tracker — Product Requirements Document

> A Progressive Web App (PWA) for tracking calorie intake, exercise, hydration, sleep, and body measurements with full offline support and a self-managed food database.

---

## 1. Document Purpose

This document is the **single source of truth** for the product. It is structured to be machine-readable so that an AI coding assistant (e.g., Claude Code) can use it to generate scaffolding, schemas, API routes, and UI components without requiring further clarification.

When implementing, the AI assistant should:
- Treat each numbered requirement as atomic and testable.
- Prefer explicit field names from the schemas below over inventing new ones.
- Reject scope additions that are not listed here without flagging them as "out of scope."

---

## 2. Product Overview

### 2.1 Vision
A self-hosted, offline-capable calorie and wellness tracker where the user has full control over their food database (no third-party API dependency) and a holistic view of intake, expenditure, hydration, sleep, and body composition.

### 2.2 Target User
A single user (initially) who wants:
- Granular control over what enters their food database.
- Tracking across calories, macros, water, sleep, and body measurements.
- An installable, fast, offline-first experience on mobile and desktop.

### 2.3 Non-Goals (Explicitly Out of Scope)
- No third-party food API integration (e.g., Open Food Facts, USDA, MyFitnessPal sync).
- No barcode scanning in v1.
- No social features, sharing, or community.
- No AI-generated meal suggestions.
- No native mobile app — PWA only.
- No payment / subscription tier.

---

## 3. Tech Stack (Locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | React Server Components where appropriate |
| Language | **TypeScript** | Strict mode |
| Database | **MongoDB** | Use Mongoose for schema modeling |
| Auth | **NextAuth.js (Auth.js)** | Credentials provider + email/password |
| UI Library | **Material-UI (MUI v5+)** | With custom theme |
| State Management | **Zustand** | Lightweight; React Query for server state |
| Forms | **React Hook Form + Zod** | Schema validation shared client/server |
| Charts | **Recharts** | For dashboard graphs |
| Offline Storage | **IndexedDB** via `idb` library | For offline log queue |
| PWA | **next-pwa** or custom Service Worker | Workbox under the hood |
| Notifications | **Web Push API + Firebase Cloud Messaging** | For reminders |
| Testing | **Vitest + React Testing Library + Playwright** | Unit + e2e |
| Hosting | **Vercel** (frontend) + **MongoDB Atlas** (DB) | Free tier acceptable |

---

## 4. Data Models

All timestamps in ISO 8601 UTC. All IDs are MongoDB ObjectIds unless noted.

### 4.1 User
```ts
{
  _id: ObjectId,
  email: string,                    // unique, lowercase
  passwordHash: string,
  name: string,
  role: "user" | "admin",
  profile: {
    dateOfBirth: Date,
    sex: "male" | "female" | "other",
    heightCm: number,
    activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active",
    timezone: string,               // IANA, e.g., "Asia/Kolkata"
    units: {
      weight: "kg" | "lb",
      height: "cm" | "ft",
      water: "ml" | "fl_oz"
    }
  },
  goals: {
    dailyCalories: number,          // kcal
    dailyProteinG: number,
    dailyCarbsG: number,
    dailyFatG: number,
    dailyWaterMl: number,
    targetWeightKg: number | null,
    sleepHoursTarget: number        // default 8
  },
  reminders: {
    waterIntervalMinutes: number,   // 0 = disabled
    mealReminders: { mealType: string, time: string }[], // "08:00"
    sleepReminderTime: string | null
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 Food (User-owned database)
```ts
{
  _id: ObjectId,
  userId: ObjectId,                 // owner; foods are NOT global
  name: string,                     // e.g., "Boiled egg"
  brand: string | null,
  servingSize: number,              // e.g., 100
  servingUnit: "g" | "ml" | "piece" | "cup" | "tbsp" | "tsp",
  caloriesPerServing: number,       // kcal
  macrosPerServing: {
    proteinG: number,
    carbsG: number,
    fatG: number,
    fiberG: number | null,
    sugarG: number | null
  },
  isFavorite: boolean,
  timesLogged: number,              // for "frequent foods" sorting
  lastLoggedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 FoodLogEntry
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  foodId: ObjectId,                 // ref Food
  date: Date,                       // user's local date, stored as start-of-day UTC
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  servings: number,                 // multiplier of food.servingSize
  // Denormalized snapshot for historical accuracy if food is edited later
  snapshot: {
    name: string,
    caloriesPerServing: number,
    macrosPerServing: { proteinG, carbsG, fatG, fiberG, sugarG }
  },
  loggedAt: Date,
  syncedFromOffline: boolean        // true if originally created offline
}
```

### 4.4 ExerciseEntry
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  date: Date,
  caloriesBurned: number,           // simple manual entry per user's preference
  note: string | null,              // e.g., "30 min run"
  loggedAt: Date
}
```

### 4.5 WaterLogEntry
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  date: Date,
  amountMl: number,
  loggedAt: Date
}
```

### 4.6 SleepEntry
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  date: Date,                       // the date the sleep ENDED (wake date)
  bedtime: Date,
  wakeTime: Date,
  durationMinutes: number,          // computed
  quality: 1 | 2 | 3 | 4 | 5,       // self-rated
  note: string | null
}
```

### 4.7 BodyMeasurementEntry
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  date: Date,
  weightKg: number | null,
  bodyFatPercent: number | null,
  measurementsCm: {
    chest: number | null,
    waist: number | null,
    hips: number | null,
    leftBicep: number | null,
    rightBicep: number | null,
    leftThigh: number | null,
    rightThigh: number | null,
    leftCalf: number | null,
    rightCalf: number | null,
    neck: number | null,
    shoulders: number | null
  },
  note: string | null,
  photos: string[]                  // optional storage URLs (out of scope for v1, keep field)
}
```

### 4.8 OfflineSyncQueue (IndexedDB only — client-side)
```ts
{
  id: string,                       // uuid
  type: "food_log" | "exercise" | "water" | "sleep" | "measurement",
  payload: object,
  createdAt: number,                // epoch ms
  retries: number
}
```

---

## 5. Functional Requirements

### 5.1 Authentication & User Management
- **F-AUTH-1**: Email/password signup with bcrypt hashing (cost factor 12).
- **F-AUTH-2**: Login with session-based auth (NextAuth JWT strategy).
- **F-AUTH-3**: Password reset via emailed token (24-hour expiry).
- **F-AUTH-4**: Logout clears session everywhere.
- **F-AUTH-5**: Role-based middleware: `admin` can view any user; `user` only their own data.
- **F-AUTH-6**: Profile page to edit name, DOB, sex, height, activity level, timezone, units.

### 5.2 Goal Setting & BMR/TDEE
- **F-GOAL-1**: BMR calculation using **Mifflin-St Jeor** equation:
  - Male: `10*weightKg + 6.25*heightCm - 5*age + 5`
  - Female: `10*weightKg + 6.25*heightCm - 5*age - 161`
- **F-GOAL-2**: TDEE = BMR × activity multiplier:
  - sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9
- **F-GOAL-3**: User can accept the suggested TDEE as their daily calorie goal or override manually.
- **F-GOAL-4**: Macro split presets: balanced (30/40/30 P/C/F), high-protein (40/30/30), low-carb (35/25/40). User can also set custom grams.
- **F-GOAL-5**: Water goal default = 35 ml × weightKg, overridable.
- **F-GOAL-6**: Sleep goal default = 8 hours, overridable.

### 5.3 Food Database (User-owned)
- **F-FOOD-1**: Form-based food creation with all fields in §4.2.
- **F-FOOD-2**: Edit and delete own foods. Deleting a food does NOT delete past log entries (snapshot preserved).
- **F-FOOD-3**: Search foods by name (case-insensitive, partial match).
- **F-FOOD-4**: List sorted by `lastLoggedAt DESC` then `timesLogged DESC` (frequent-first).
- **F-FOOD-5**: Mark/unmark favorite.
- **F-FOOD-6**: Filter view: All / Favorites / Recent.

### 5.4 Food Logging
- **F-LOG-1**: Add entry with food, mealType, servings, date.
- **F-LOG-2**: Default date = today; default mealType inferred by current time:
  - 04:00–10:30 breakfast, 10:30–15:00 lunch, 15:00–18:00 snack, 18:00–04:00 dinner.
- **F-LOG-3**: On log creation: increment `food.timesLogged`, update `lastLoggedAt`, write snapshot.
- **F-LOG-4**: Edit servings or delete entry.
- **F-LOG-5**: Daily food log view grouped by mealType showing each entry's calories and macros.

### 5.5 Exercise Logging
- **F-EX-1**: Simple form: date, caloriesBurned (number), optional note.
- **F-EX-2**: Multiple entries per day allowed; dashboard shows the sum.
- **F-EX-3**: Edit/delete entries.

### 5.6 Water Logging
- **F-WTR-1**: Quick-add buttons: +250ml, +500ml, +750ml, custom.
- **F-WTR-2**: Daily total visible on dashboard with progress vs goal.
- **F-WTR-3**: Configurable interval reminders (every 30/60/90/120 min, or off) during user-defined waking hours.

### 5.7 Sleep Logging
- **F-SLP-1**: Form: bedtime (datetime), wakeTime (datetime), quality (1–5 stars), optional note.
- **F-SLP-2**: Duration auto-computed.
- **F-SLP-3**: 7-day and 30-day average duration and average quality on dashboard.

### 5.8 Body Measurements
- **F-BM-1**: Form for all fields in §4.7; all numeric fields optional so user can log only what they want that day.
- **F-BM-2**: Trend charts per metric over selectable time range (1 week / 1 month / 3 months / 1 year / all).
- **F-BM-3**: Most recent value of each metric shown as cards on the measurements page.
- **F-BM-4**: Compare-to-previous: each metric shows delta vs the previous logged value.

### 5.9 Dashboard
- **F-DSH-1**: Today view shows: calories consumed, calories burned, **net calories** (consumed − burned), remaining vs goal, macros breakdown ring/bar, water progress, last night's sleep, current weight.
- **F-DSH-2**: Weekly summary tab: 7-day calorie average, days within goal, total exercise calories, average sleep, weight trend.
- **F-DSH-3**: Monthly summary: same metrics over 30 days.
- **F-DSH-4**: Visual graphs (Recharts): calorie trend line, macro stacked bar, weight line, sleep duration bar, water bar.
- **F-DSH-5**: Goal-achievement notification when daily calorie target met (within ±10%).

### 5.10 PWA & Offline Support
- **F-PWA-1**: Valid web manifest (`manifest.json`) with icons in 192, 512, maskable variants.
- **F-PWA-2**: Service Worker caches app shell (precache) and uses stale-while-revalidate for API GETs.
- **F-PWA-3**: "Install" prompt component shown on supported browsers.
- **F-PWA-4**: All log creation forms (food, exercise, water, sleep, measurement) work offline; entries are queued in IndexedDB.
- **F-PWA-5**: Background Sync API replays the queue when connectivity returns; entries flagged `syncedFromOffline=true`.
- **F-PWA-6**: Conflict policy: last-write-wins by `loggedAt`.

### 5.11 Notifications
- **F-NOT-1**: Web Push permission requested only after user enables a reminder type.
- **F-NOT-2**: Water reminders, meal reminders, sleep wind-down reminder.
- **F-NOT-3**: Goal-achievement notification on calorie / water target reached.
- **F-NOT-4**: All notifications respect user timezone.

### 5.12 Data Export
- **F-EXP-1**: Export user data as JSON (full dump) or CSV per collection.
- **F-EXP-2**: Date range filter for CSV export.

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | First Contentful Paint < 2s on 3G; LCP < 2.5s. |
| NFR-2 | Lighthouse PWA score ≥ 90; Accessibility ≥ 95. |
| NFR-3 | All forms keyboard-navigable; ARIA labels on icon-only buttons. |
| NFR-4 | All API endpoints return Zod-validated payloads; errors as `{error: string, details?: object}`. |
| NFR-5 | Passwords never logged; PII redacted from error reports. |
| NFR-6 | Mobile-first responsive: layouts must work at 360px width. |
| NFR-7 | Dark mode toggle; preference persisted per user. |
| NFR-8 | All dates rendered in user's selected timezone. |

---

## 7. API Surface (REST, under `/api`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create user |
| POST | `/api/auth/login` | NextAuth handles |
| POST | `/api/auth/forgot-password` | Send reset token |
| POST | `/api/auth/reset-password` | Consume token |
| GET / PATCH | `/api/profile` | Read/update profile |
| GET / PATCH | `/api/goals` | Read/update goals (auto-recompute TDEE on profile change) |
| GET / POST | `/api/foods` | List/create user foods |
| GET / PATCH / DELETE | `/api/foods/:id` | Single food |
| GET / POST | `/api/logs/food` | Date-filtered list / create |
| PATCH / DELETE | `/api/logs/food/:id` | |
| GET / POST | `/api/logs/exercise` | |
| PATCH / DELETE | `/api/logs/exercise/:id` | |
| GET / POST | `/api/logs/water` | |
| DELETE | `/api/logs/water/:id` | |
| GET / POST | `/api/logs/sleep` | |
| PATCH / DELETE | `/api/logs/sleep/:id` | |
| GET / POST | `/api/measurements` | |
| PATCH / DELETE | `/api/measurements/:id` | |
| GET | `/api/dashboard/today?date=YYYY-MM-DD` | Aggregated today payload |
| GET | `/api/dashboard/summary?range=week\|month` | Aggregated summary |
| POST | `/api/sync/replay` | Bulk-create offline-queued entries |
| GET | `/api/export?format=json\|csv&from=&to=` | Data export |
| POST | `/api/notifications/subscribe` | Save push subscription |

---

## 8. Information Architecture (Routes)

```
/                       → redirect to /dashboard if auth, else /login
/login
/signup
/forgot-password
/reset-password?token=
/dashboard              → today + tabs for week/month
/log
  /food                 → daily food log + add
  /exercise
  /water
  /sleep
/foods                  → manage food database
  /new
  /[id]/edit
/measurements           → cards + history + add
  /new
  /history
/profile
/settings               → goals, reminders, units, theme, export
```

---

## 9. Acceptance Criteria Conventions

Each requirement above is testable. For Phase work, "Done" means:
1. Implemented with TypeScript types matching §4.
2. Unit-tested where logic is non-trivial (BMR calc, TDEE, sync queue, snapshotting).
3. E2E happy-path covered (Playwright) for user-facing flows.
4. Lighthouse run passes NFR-2 thresholds.
5. Accessibility check (axe) passes with 0 critical violations.

---

## 10. Glossary

- **BMR** — Basal Metabolic Rate (calories burned at rest).
- **TDEE** — Total Daily Energy Expenditure (BMR × activity).
- **Net calories** — calories consumed minus calories burned through exercise.
- **Snapshot** — frozen copy of food nutrition data on a log entry, immune to later edits to the source food.
- **Sync queue** — client-side IndexedDB store of pending writes made offline.
