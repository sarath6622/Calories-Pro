# CaloriesPro — Project Memory

This is a **Progressive Web App** for tracking calories, exercise, hydration, sleep, and body measurements with full offline support and a self-managed food database.

## Sources of truth

- **`PRD.md`** — product requirements. Every feature, schema, API endpoint, and acceptance criterion is here. Treat each numbered requirement as atomic.
- **`DELIVERY_PLAN.md`** — phased build order (Phase 0–10) with task lists, definitions of done, and a cross-phase verification checklist.

Read both at the start of any non-trivial session.

## Tech stack (locked, do not substitute)

Next.js 14+ App Router · TypeScript strict · MongoDB + Mongoose · NextAuth.js · MUI v5 · Zustand + TanStack Query · React Hook Form + Zod · Recharts · `idb` for IndexedDB · `next-pwa` · Vitest + RTL + Playwright · Vercel + MongoDB Atlas.

## Rules of engagement

1. **Stay in the current phase.** Do not skip ahead to a later phase. If the user says "execute Phase N", read PRD.md and DELIVERY_PLAN.md, then stop at the phase's Definition of Done before moving on.
2. **No invented features.** If a requirement isn't in the PRD, flag it and ask. Do not silently expand scope.
3. **Field names from the PRD §4 schemas are canonical.** Don't rename or restructure them.
4. **Authorization is mandatory.** Every database query for user-owned data must be scoped by `userId`. Admins may read any user's data; users only their own. Add a "tried to read another user's data → 403" test for every endpoint that touches user data.
5. **Snapshot invariant (PRD §4.3).** `FoodLogEntry.snapshot` freezes nutrition at log time. Editing or deleting a `Food` must NEVER change historical entries. Tests must cover this.
6. **Zod schemas are shared client/server.** Define once, import on both sides. Errors return `{error: string, details?: object}` (NFR-4).
7. **Mobile-first 360px floor (NFR-6).** Layouts must work at 360px width. Test in narrow viewport.
8. **No `any` without justification.** If you must use `any`, leave a one-line comment explaining why.
9. **Update `CHANGELOG.md` at the end of every phase.** Note migrations and index additions.
10. **One PR per phase**, small commits. Do not merge a phase until the cross-phase verification checklist passes.

## Available subagents

- **`code-reviewer`** — read-only. Invoke before merging each phase (or before declaring a phase done). It checks the cross-phase verification checklist plus project-specific invariants (userId scoping, snapshot preservation, Zod error shape, accessibility on icon-only buttons).

## Available skills

- **`phase-completion`** — runs the cross-phase verification checklist + the current phase's Definition of Done. Triggered by phrases like "phase done", "verify phase", "is this phase complete".

## Things to avoid

- Third-party food APIs (Open Food Facts, USDA, MyFitnessPal). The food DB is **user-owned only** (PRD §2.3).
- Soft-deletes on Food. Hard delete is correct because the snapshot pattern preserves history (PRD §F-FOOD-2 + Phase 3 task list).
- Any feature in the "Out-of-Scope Backlog" of `DELIVERY_PLAN.md` (barcode scanning, photo uploads, recipe builder, multi-user, health-platform sync).

## When patterns stabilise

The skills directory is intentionally minimal right now. As real code is written, extract these from working examples (do not pre-write them):

- `nextjs-app-router` — server vs client components, route groups, error/loading boundaries (after Phase 0–1).
- `mongoose-schema` — connection caching, snapshot pattern, indexing, userId scoping (after Phase 1).
- `zod-validation` — shared client/server schemas + error response shape (after Phase 1).
- `api-route-pattern` — auth → parse → authorise → logic → typed response (after Phase 1).
- `mui-component` — theme tokens, dark mode, ARIA, 360px floor (after Phase 3).
- `testing-conventions` — Vitest + Playwright structure, seed/teardown (after Phase 1).
- `offline-sync` — IndexedDB queue, replay endpoint, idempotency via UUIDs (write **before** Phase 8 — riskiest phase).
