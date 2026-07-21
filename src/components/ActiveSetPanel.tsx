import { useState, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { upsertSetLog } from '@/hooks/useSetLogs'
import { useCommitGate } from '@/hooks/RestTimerContext'
import type { ExerciseSlot, SetLog, Weight } from '@/db/types'
import { cn } from '@/lib/utils'

/**
 * Pure input form for one set inside ExerciseSheet.
 *
 * Renders "Set N of M" with tap-stepper reps/RIR inputs and a big commit button.
 * On commit it stamps the working weight, writes the SetLog, and calls
 * `onCommitted()` — the parent sheet owns everything after that (rest timer,
 * advancing the set, closing). This component holds NO flow state, so remounting
 * it via `key` when the set changes is safe and gives clean per-set re-seeding.
 */
export function ActiveSetPanel({
  slot,
  setNumber,
  sessionId,
  workingWeight,
  existingLog,
  previousLog,
  isLastSet,
  isEditing,
  onCommitted,
  onSkip,
}: {
  slot: ExerciseSlot
  /** 1-based */
  setNumber: number
  sessionId: string
  workingWeight: Weight
  existingLog?: SetLog
  previousLog?: SetLog
  isLastSet: boolean
  /** true when re-opening an already-logged set from the done-strip. */
  isEditing: boolean
  /** Called after the SetLog is written. Parent handles timer/advance/close. */
  onCommitted: () => void
  onSkip: () => void
}) {
  const gate = useCommitGate()

  // Pre-fill: same set last time → previous set today → top of rep range
  const seedReps =
    existingLog?.reps ??
    previousLog?.reps ??
    (setNumber === 1 ? slot.scheme.repMax : undefined)
  const seedRir = existingLog?.rir ?? previousLog?.rir ?? slot.targetRir.max

  const [reps, setReps] = useState(seedReps ?? slot.scheme.repMax)
  const [rir, setRir] = useState(seedRir ?? slot.targetRir.max)

  // Re-seed if the persisted log arrives after mount (async resume/edit).
  useEffect(() => {
    if (existingLog && !existingLog.skipped) {
      setReps(existingLog.reps ?? slot.scheme.repMax)
      setRir(existingLog.rir ?? slot.targetRir.max)
    }
  }, [existingLog, slot.scheme.repMax, slot.targetRir.max])

  const commit = useCallback(async () => {
    if (!gate.shouldStart(slot.id, setNumber)) return
    await upsertSetLog({
      sessionId,
      slotId: slot.id,
      setNumber,
      reps,
      rir,
      weight: workingWeight, // always stamp — freezes the truth of this set
      skipped: false,
    })
    onCommitted()
  }, [gate, slot.id, setNumber, sessionId, reps, rir, workingWeight, onCommitted])

  const skipSet = async () => {
    await upsertSetLog({
      sessionId,
      slotId: slot.id,
      setNumber,
      skipped: true,
      weight: workingWeight,
    })
    onSkip()
  }

  const commitLabel = isEditing
    ? 'Update set'
    : isLastSet
      ? 'Log Set · Finish exercise'
      : 'Log Set'

  return (
    <div className="space-y-5">
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {isEditing ? `Editing set ${setNumber}` : `Set ${setNumber} of ${slot.scheme.sets}`}
      </p>

      {/* Reps stepper */}
      <div className="flex flex-col items-center gap-1.5">
        <label className="text-xs text-muted-foreground">Reps</label>
        <Stepper
          value={reps}
          onChange={setReps}
          min={1}
          max={99}
          label="reps"
          hint={`${slot.scheme.repMin}–${slot.scheme.repMax} target`}
        />
      </div>

      {/* RIR stepper */}
      <div className="flex flex-col items-center gap-1.5">
        <label className="text-xs text-muted-foreground">RIR</label>
        <Stepper
          value={rir}
          onChange={setRir}
          min={0}
          max={10}
          label="RIR"
          hint={`${slot.targetRir.min}–${slot.targetRir.max} target`}
        />
      </div>

      {/* Commit button */}
      <Button size="lg" className="w-full text-base font-semibold" onClick={commit}>
        <Check className="mr-2 h-5 w-5" />
        {commitLabel}
      </Button>

      {/* Skip set */}
      {!isEditing && (
        <button
          onClick={skipSet}
          className="block w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground"
        >
          Skip this set
        </button>
      )}
    </div>
  )
}

/** Tap stepper: [ − N + ] with an editable center. */
function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  hint,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  label: string
  hint?: string
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(String(value))

  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const commitEdit = () => {
    const n = parseInt(text, 10)
    if (Number.isFinite(n)) onChange(clamp(n))
    setEditing(false)
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/50 text-xl font-bold transition-colors active:bg-muted"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>

        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
            }}
            autoFocus
            className={cn(
              'w-16 rounded-md border border-primary bg-background text-center text-3xl font-bold',
              'outline-none ring-2 ring-primary/40',
            )}
          />
        ) : (
          <button
            onClick={() => {
              setText(String(value))
              setEditing(true)
            }}
            className="w-16 text-center text-3xl font-bold tabular-nums"
            aria-label={`${label}: ${value}. Tap to edit`}
          >
            {value}
          </button>
        )}

        <button
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/50 text-xl font-bold transition-colors active:bg-muted"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  )
}
