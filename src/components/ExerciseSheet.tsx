import { useEffect, useState, useRef, useMemo } from 'react'
import { Drawer } from 'vaul'
import { ArrowLeftRight, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActiveSetPanel } from './ActiveSetPanel'
import { WeightStepper } from './WeightStepper'
import { LastSessionRef } from './LastSessionRef'
import { SetProgressDots } from './SetProgressDots'
import { useSlotSetLogs, useSessionSlotLog, upsertSessionSlotLog } from '@/hooks/useSetLogs'
import { useLastSessionSlot } from '@/hooks/useLastSessionSlot'
import { useRestTimer } from '@/hooks/RestTimerContext'
import type { ExerciseSlot, Weight, SetLog } from '@/db/types'
import { formatScheme, formatRir, formatSet, formatWeight, formatSeconds, formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Bottom-sheet drawer for a single exercise slot.
 *
 * Flow ownership lives here (not in ActiveSetPanel):
 *   - `activeSet` is DERIVED from the logs (first unlogged set), so resuming
 *     after close/app-restart is always correct — no async seed race.
 *   - `editingSet` overrides it when the user taps a done-strip chip.
 *   - `mode` toggles between the input form and an inline rest countdown, so the
 *     timer is visible without leaving the sheet.
 */
export function ExerciseSheet({
  slot,
  sessionId,
  open,
  onOpenChange,
  onSubstitute,
}: {
  slot: ExerciseSlot
  sessionId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubstitute: () => void
}) {
  const logs = useSlotSetLogs(sessionId, slot.id)
  const slotLog = useSessionSlotLog(sessionId, slot.id)
  const lastSession = useLastSessionSlot(slot.id)
  const { start, remaining, total, skip: skipTimer } = useRestTimer()

  // Working weight: today's slotLog.performedWeight → last session → template default.
  const seedWeight = slotLog?.performedWeight ?? lastSession?.weight ?? slot.defaultWeight
  const [workingWeight, setWorkingWeight] = useState<Weight>(seedWeight)

  // Re-seed once if the async weight sources arrive after mount.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    const w = slotLog?.performedWeight ?? lastSession?.weight
    if (w) {
      setWorkingWeight(w)
      seeded.current = true
    }
  }, [slotLog?.performedWeight, lastSession?.weight])
  useEffect(() => {
    seeded.current = false
  }, [slot.id])

  const handleWeightChange = async (w: Weight) => {
    setWorkingWeight(w)
    await upsertSessionSlotLog({
      sessionId,
      slotId: slot.id,
      performedName: slotLog?.performedName ?? slot.name,
      performedWeight: w,
      skipped: slotLog?.skipped,
    })
  }

  // --- Derived active set (fixes the resume race) -------------------------
  // First set number with no log at all. A skipped set counts as handled, so
  // we never loop back to it.
  const nextUnloggedSet = useMemo(() => {
    for (let i = 1; i <= slot.scheme.sets; i++) {
      if (!logs.find((l) => l.setNumber === i)) return i
    }
    return slot.scheme.sets
  }, [logs, slot.scheme.sets])

  const [editingSet, setEditingSet] = useState<number | null>(null)
  const activeSet = editingSet ?? nextUnloggedSet

  const [mode, setMode] = useState<'logging' | 'resting'>('logging')

  // Leave rest mode when the timer is spent (natural finish or skip).
  useEffect(() => {
    if (mode === 'resting' && total === 0) setMode('logging')
  }, [mode, total])

  // All sets have a log (skipped or performed).
  const allDone = logs.length >= slot.scheme.sets

  const doneLogs = logs
    .filter((l) => !l.skipped)
    .sort((a, b) => a.setNumber - b.setNumber)

  const currentLog = logs.find((l) => l.setNumber === activeSet)
  const prevLog = logs.find((l) => l.setNumber === activeSet - 1)

  const handleCommitted = () => {
    // Editing a past set: no rest, just return to the live set.
    if (editingSet != null) {
      setEditingSet(null)
      return
    }
    const isLast = activeSet >= slot.scheme.sets
    const name = slotLog?.performedName ?? slot.name
    start(slot.restSeconds ?? 120, {
      title: 'Rest complete 💪',
      body: isLast
        ? `${name} — exercise done`
        : `${name} · Set ${activeSet + 1} of ${slot.scheme.sets} next`,
    })
    if (isLast) {
      // Rest still applies after the last set — hand it to the global pill and
      // drop back to the exercise list.
      setMode('logging')
      onOpenChange(false)
    } else {
      setMode('resting')
    }
  }

  const handleSkipSet = () => {
    setEditingSet(null)
    setMode('logging')
    if (activeSet >= slot.scheme.sets) onOpenChange(false)
  }

  const endRest = () => {
    skipTimer()
    setMode('logging')
  }

  const skipExercise = async () => {
    await upsertSessionSlotLog({
      sessionId,
      slotId: slot.id,
      performedName: slotLog?.performedName ?? slot.name,
      performedWeight: workingWeight,
      skipped: !slotLog?.skipped,
    })
    onOpenChange(false)
  }

  const displayName = slotLog?.performedName ?? slot.name
  const showPanel = editingSet != null || !allDone

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md',
            'flex flex-col rounded-t-2xl bg-background',
            'focus:outline-none',
          )}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-start gap-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Drawer.Title className="truncate text-lg font-bold">
                  {displayName}
                </Drawer.Title>
                {slotLog?.performedName && slotLog.performedName !== slot.name && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    sub
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatScheme(slot.scheme)} · {formatRir(slot.targetRir)} · {slot.muscleGroup}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={onSubstitute}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Substitute exercise"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-5 pb-8 space-y-5">
            {/* Last session reference */}
            <LastSessionRef slotId={slot.id} defaultSlotName={slot.name} />

            {/* Working weight stepper */}
            <div className="rounded-xl border border-border bg-muted/30 py-4">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Working weight
              </p>
              <WeightStepper
                todayWeight={slotLog?.performedWeight}
                lastWeight={lastSession?.weight}
                defaultWeight={slot.defaultWeight}
                onChange={handleWeightChange}
              />
            </div>

            {/* Done-strip: tappable chips for completed sets */}
            {doneLogs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Logged
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {doneLogs.map((log) => (
                    <button
                      key={log.setNumber}
                      onClick={() => {
                        setEditingSet(log.setNumber)
                        setMode('logging')
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-mono hover:border-primary/50 hover:bg-primary/10',
                        editingSet === log.setNumber
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/50',
                      )}
                      aria-label={`Re-open set ${log.setNumber}`}
                    >
                      <span className="text-muted-foreground">{log.setNumber}.</span>
                      {formatSet(log.reps, log.rir)}
                      <span className="text-muted-foreground/60">
                        · {formatWeight(log.weight ?? workingWeight)}
                      </span>
                      {log.loggedAt && (
                        <span className="text-muted-foreground/40">· {formatClock(log.loggedAt)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Set progress dots */}
            <div className="flex items-center justify-between">
              <SetProgressDots
                totalSets={slot.scheme.sets}
                logs={logs}
                slotLog={slotLog ?? undefined}
              />
              {allDone && (
                <span className="text-xs font-medium text-green-500">All sets done ✓</span>
              )}
            </div>

            {/* Body: rest countdown → input form → all-done */}
            {mode === 'resting' ? (
              <RestView
                remaining={remaining}
                onEnd={endRest}
                justLogged={doneLogs[doneLogs.length - 1]}
              />
            ) : showPanel ? (
              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <ActiveSetPanel
                  key={`${slot.id}-set${activeSet}`}
                  slot={slot}
                  setNumber={activeSet}
                  sessionId={sessionId}
                  workingWeight={workingWeight}
                  existingLog={currentLog}
                  previousLog={prevLog}
                  isLastSet={activeSet === slot.scheme.sets}
                  isEditing={editingSet != null}
                  onCommitted={handleCommitted}
                  onSkip={handleSkipSet}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 py-6">
                <p className="text-sm font-medium text-green-500">All sets logged ✓</p>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Back to workout
                </Button>
              </div>
            )}

            {/* Skip whole exercise */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={skipExercise}
            >
              <SkipForward className="mr-1.5 h-3.5 w-3.5" />
              {slotLog?.skipped ? 'Unskip exercise' : 'Skip exercise'}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** Inline rest countdown shown in place of the input form between sets. */
function RestView({
  remaining,
  onEnd,
  justLogged,
}: {
  remaining: number
  onEnd: () => void
  justLogged?: SetLog
}) {
  const done = remaining <= 0
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 py-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {done ? 'Rest done' : 'Rest'}
      </p>
      <span className="text-5xl font-bold tabular-nums">{formatSeconds(Math.max(0, remaining))}</span>
      {justLogged && justLogged.reps != null && (
        <p className="text-xs text-muted-foreground">
          Set {justLogged.setNumber} · {justLogged.reps} reps @ {justLogged.rir ?? '–'} RIR
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onEnd}>
        <SkipForward className="mr-1 h-4 w-4" />
        {done ? 'Next set' : 'Skip rest'}
      </Button>
    </div>
  )
}
