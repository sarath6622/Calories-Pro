---
name: phase-completion
description: Verify that a phase of CaloriesPro is actually complete. Use this when the user says "phase done", "verify phase", "is this phase complete", "ready to merge phase N", or after declaring work on a phase finished. Runs the cross-phase verification checklist from DELIVERY_PLAN.md plus the specific Definition of Done for the current phase. Reports a pass/fail punch list.
---

# Phase completion verification

When this skill is triggered, the goal is to give the user a clear yes/no on whether the current phase can be merged, with a specific punch list of what's missing if not.

## Step 1 — Identify the phase

If the user named the phase, use it. Otherwise infer from `git log` / `git branch` / recent commits. If still ambiguous, ask which phase.

Read the matching `## Phase N` section of `DELIVERY_PLAN.md` to get the task list and Definition of Done.

## Step 2 — Run the automated checks

Run these in parallel where possible. Capture output; don't summarise away failures.

```
npm run typecheck      # or: npx tsc --noEmit
npm run lint
npm test               # Vitest unit tests
npm run e2e            # Playwright (if the phase requires e2e)
```

If any command doesn't exist yet (early phases), note it and continue.

## Step 3 — Cross-phase verification checklist (from DELIVERY_PLAN.md)

Tick each one with evidence:

- [ ] TypeScript compiles with `--strict`. (`tsc --noEmit` exit 0)
- [ ] No new `any` types without a justifying comment. (`grep -rn ': any' src/` filtered to changed files)
- [ ] New code has tests; coverage on new files ≥ 70%. (run with `--coverage` if configured)
- [ ] Authorisation tested: every endpoint touching user data has a "another user → 403" test. Spot-check by grepping `describe(` in test files for new routes.
- [ ] No secrets committed: `.env*` is in `.gitignore`; `git ls-files | grep -E '\.env($|\.)'` returns nothing.
- [ ] `CHANGELOG.md` has an entry for this phase, including any new MongoDB indexes or migrations.

## Step 4 — Phase-specific Definition of Done

Walk through every bullet in the current phase's "Definition of Done" block and confirm. Examples:

- Phase 0: `npm run dev` renders, all four scripts pass, CI green.
- Phase 1: F-AUTH-* satisfied, sessions persist across reload, reset token expires after 24h (mocked clock).
- Phase 3: F-FOOD-* satisfied, "cannot read another user's food" test exists and passes.
- Phase 4: Editing a Food after logging it does NOT change historical entry calories (snapshot preservation test passes).
- Phase 7: Dashboard interactive in <500ms after data loads.
- Phase 8: Lighthouse PWA score ≥ 90; offline log creation → online → entry appears (Playwright with `context.setOffline(true)`).

For each bullet, point at the specific test, file, or measurement that proves it.

## Step 5 — Report

Output one of:

**`PHASE N — READY TO MERGE`**, with a short list of what was verified.

Or:

**`PHASE N — NOT READY`**, with a numbered punch list of what's missing or failing, each item citing a file/line or command output.

Do not declare a phase ready if any check failed or any DoD bullet has no evidence. Be honest about checks that were skipped because tooling isn't set up yet — say "skipped: no e2e suite exists yet" rather than silently ticking it.

After the report, suggest invoking the `code-reviewer` subagent for a deeper diff review if not already done.
