# Workout Logger — Core Interaction Recommendation

> Answer to `ux_redesign_decision.md`. Written after reading the real data model
> (`db/types.ts`), the hooks (`useToday.ts`, `useSetLogs.ts`, `RestTimerContext.tsx`),
> the current UI (`TodayPage`, `ExerciseCard`, `SetRow`, `LastSessionRef`), and the
> real training data (`db/seed.ts`: 5–7 exercises/day, 3–5 sets each, kg + per-side loads).

---

## TL;DR — the decision

**Go with Option A (bottom-sheet focus mode), as a refined hybrid.**
List stays as the map; a drawer per exercise is the cockpit. Reject B (too much
navigation, loses the overview you need to pace a 6-exercise session) and C (with
3–5 sets × 6–7 exercises, inline expansion makes cards tall and the rest timer
cramped — the exact clutter you're trying to escape).

**The single most important correction to the original doc:** stamp the effective
weight onto **each `SetLog` at commit time**. Do *not* resolve weight lazily from
`SessionSlotLog.performedWeight` at read time. Otherwise nudging the weight for set 3
silently rewrites the recorded weight of sets 1–2. See §2.

---

## 1. Interaction pattern — why A

The physical loop is: *pick exercise → set weight once → [do set → come back → one tap → rest] × N → next exercise.* The list-plus-drawer maps onto that 1:1:

- **The list is the pacing surface.** In a 6–7 exercise session you constantly ask "how much is left?" A compact, always-scannable list answers that. Full-screen (B) throws it away.
- **The drawer is the focus surface.** Once you tap in, everything on screen is *this* exercise: last time, working weight, the one set you're on. Nothing else competes for a sweaty thumb.
- **Dismissal is free and native.** Swipe-down / back-button / tap-scrim all close it — no custom nav to reason about. Use a **vaul `Drawer`** (bottom sheet with real drag physics), not shadcn `Dialog`, and not a route.
- **It fits the existing architecture.** The rest-timer is an App-level overlay via context; a drawer sits under that pill cleanly. Session is created lazily on first commit (`ensure()`), which the drawer's "Log Set" already triggers.

```
TODAY LIST (map)                      EXERCISE DRAWER (cockpit)
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ Wed, 22 Jul                 │      │ ╾  drag handle              │
│ Day 1 — Legs                │      │ Barbell Back Squat      swap│
│                             │      │ Last: 8@1 7@1 6@1 · 60kg    │
│ ● Back Squat   ●●●○  62.5kg │─tap─▶│                             │
│ ○ RDL          ○○○   60kg   │      │   WORKING WEIGHT             │
│ ○ Leg Press    ○○○   120kg  │      │   [ −2.5 ]  62.5 kg [ +2.5 ]│
│ ✓ Leg Curl     done         │      │            ( ) per-side     │
│ ⤫ Calf Raise   skipped      │      │                             │
│                             │      │  done: 8@1 · 7@1  (tap edit)│
│      [ Finish session ]     │      │  ┌───────────────────────┐  │
└─────────────────────────────┘      │  │      SET 3 of 4       │  │
                                      │  │  reps [ − 6 + ]       │  │
   ● in progress  ✓ done              │  │  RIR  [ − 1 + ]       │  │
   ○ not started  ⤫ skipped           │  │  ┌─────────────────┐  │  │
                                      │  │  │   Log Set  ✓    │  │  │
                                      │  └──┴─────────────────┴──┘  │
                                      └─────────────────────────────┘
```

---

## 2. Weight UX (the important part)

### Where and when
One **working-weight stepper** at the top of the drawer, above the active set. Set once, applies to every set of the exercise.

**Pre-fill priority** (first hit wins):
1. `SessionSlotLog.performedWeight` — already chosen for this exercise *today* (resume case)
2. last **completed** session's `performedWeight` for this slot — "what you did last time" ← the default you want
3. `slot.defaultWeight` — template fallback for a brand-new exercise

`LastSessionRef` already fetches (2); reuse that query to seed the stepper instead of only displaying it.

### The stepper
`[ −2.5 ]  62.5 kg  [ +2.5 ]` + a `per-side` toggle (real: dumbbells & calf raise seed as `perSide:true`). Tap the number to type an arbitrary value (0.5 kg gyms exist). Each nudge **upserts `SessionSlotLog.performedWeight`** — that field is the live "current working weight" pointer.

### ⚠️ Stamp weight per set — don't resolve lazily
`performedWeight` is a *moving* pointer. If a `SetLog`'s weight is computed as `performedWeight` at **read** time, this happens:

```
set 1 logged @ 60   → SetLog{set1, reps, no weight}
set 2 logged @ 60   → SetLog{set2, reps, no weight}
drop to 55, log set3 → performedWeight = 55
history now reads:  60 became → 55, 55, 55   ✗ sets 1–2 falsified
```

**Fix:** on "Log Set", write the current working weight straight into `SetLog.weight`
(the field already exists — just always populate it instead of only on override).
Now every set carries the truth of what was lifted, and later nudges never rewrite
history. `performedWeight` degrades to a convenience pointer for pre-fill; `LastSessionRef`
can keep showing it as the headline number.

This also deletes the need for a separate per-set override UI: a per-set difference is
just "nudge the stepper, then log that set." One mental model, one control.

---

## 3. The "Log Set" commit

- **A single big button.** No swipe (sweaty hands, no discoverability tax). Reps and RIR are **pre-filled** — reps from the same set last time → else previous set today → else top of rep range; RIR from `targetRir.max`. The default happy path is literally *come back, glance, tap once.*
- Reps/RIR are **tap steppers** (`− n +`), not raw text fields — no keyboard summon mid-set. Keep an editable center for odd numbers.
- **On tap, atomically:** write `SetLog{reps, rir, weight: workingWeight}` → `ensure()` session → `start(restSeconds)` → advance. Reuse `useCommitGate` so a double-tap doesn't double-fire the timer.
- **After commit the active panel becomes the rest countdown** in place: `Rest 1:47  [skip] [+30]`. When it hits 0 (or you tap *Next set*), it flips to "Set N+1 of M". The global `RestTimerPill` still exists for when you've closed the drawer mid-rest — one timer, two surfaces, driven by the same context.
- **Last set of the exercise:** button reads **"Log Set · Finish exercise"**; on commit, still start the rest timer (you rest after the last set too), then **auto-close the drawer** back to the list (your confirmed A3). List row flips to ✓.

---

## 4. Per-exercise progress on the list

Each row: `status · name · set dots · working-weight`.

- **not started** `○○○` (hollow dots = scheme.sets), shows next weight (last session / default)
- **in progress** `●●●○` filled = logged sets, shows working weight, row accent
- **done** `✓` collapsed to one line
- **skipped** `⤫` struck-through / dimmed (existing `slotLog.skipped`)

Dot count comes straight from `scheme.sets`; filled count = `setLogs.length`. All already reactive via `useSlotSetLogs` / `useSessionSlotLog`.

---

## 5. Edge cases

| Case | Handling |
|------|----------|
| **Resume mid-exercise** (logged set 1, closed app) | Drawer opens at the **first set number in `1..sets` with no `SetLog`**. Derived from DB every open, so it's crash-proof — no local "current set" state to lose. |
| **Skip whole exercise** | Keep skip affordance in the drawer header *and* as a swipe/long-press on the list row → toggles `SessionSlotLog.skipped`. Struck on the list. |
| **Skip one set** | Small "skip set" on the active panel → `SetLog{skipped:true}`; counts as done for advancing, renders as a gap dot. |
| **Edit a committed set** | The "done: 8@1 · 7@1" strip above the active set — tap any chip to re-open that set number in the panel; upsert overwrites by `setNumber`. |
| **Weight changed after some sets** | Handled by §2 stamping — earlier sets keep their real weight. |
| **Substituted exercise** | `SubstitutionDialog` stays as-is; drawer reads `performedName`, and pre-fill priority (2) naturally uses the sub's own last weight if present. |

---

## 6. Component plan

**Add**
- `Drawer` primitive — install vaul (`npx shadcn add drawer`). Bottom sheet w/ drag.
- `ExerciseSheet.tsx` — orchestrates one exercise: header + `LastSessionRef` + `WeightStepper` + done-strip + `ActiveSetPanel`; computes resume set; auto-closes on finish.
- `WeightStepper.tsx` — session weight, ±2.5, per-side toggle, tap-to-type. Writes `performedWeight`.
- `ActiveSetPanel.tsx` — "Set N of M", reps/RIR steppers, "Log Set" button, morphs into inline rest countdown.
- `ExerciseListItem.tsx` — compact row: status glyph, name, progress dots, weight. Replaces the card in the list.
- `SetProgressDots.tsx` — small reusable dots.

**Modify**
- `TodayPage.tsx` — render `ExerciseListItem` list; hold `openSlotId` state; mount `ExerciseSheet`. Timer-start logic moves into the panel's commit.
- `LastSessionRef.tsx` — keep display; **export its query** (or a `useLastSessionSlot(slotId)` hook) so the stepper can seed from it.

**Retire from the primary flow** (keep files until the drawer ships, then delete)
- `ExerciseCard.tsx`, `SetRow.tsx` (onBlur commit), `WeightChip.tsx` (per-set chip — superseded by §2).

**Unchanged**
- `RestTimerContext.tsx` / `RestTimerPill.tsx`, `SubstitutionDialog.tsx`, DB layer.
  No schema migration needed — we're only *populating* `SetLog.weight` more consistently.

---

## Build order (each independently shippable)
1. `useLastSessionSlot(slotId)` hook (extract from `LastSessionRef`).
2. `WeightStepper` writing `performedWeight` — verify pre-fill priority.
3. `ActiveSetPanel` with stamped-weight commit + timer start (the §2 fix).
4. `ExerciseSheet` shell (drawer, resume-set, done-strip, auto-close).
5. `ExerciseListItem` + swap into `TodayPage`.
6. Delete retired components.
