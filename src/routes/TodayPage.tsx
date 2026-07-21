import { useState, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExerciseListItem } from '@/components/ExerciseListItem'
import { ExerciseSheet } from '@/components/ExerciseSheet'
import { SubstitutionDialog } from '@/components/SubstitutionDialog'
import { useNextDay, useTodaySession, finishSession } from '@/hooks/useToday'
import { useExerciseSlots, useAppState, updateAppState } from '@/hooks/useDb'
import { format } from 'date-fns'

export default function TodayPage() {
  const { day, days, setOverrideId } = useNextDay()
  const slots = useExerciseSlots(day?.id)
  const { sessionId, ensure } = useTodaySession(day?.id)
  const appState = useAppState()

  const [openSlotId, setOpenSlotId] = useState<string | null>(null)
  const [substitutingSlotId, setSubstitutingSlotId] = useState<string | null>(null)

  // Retain the opened slot id so the drawer can animate closed (and preserve
  // state on same-slot reopen) instead of unmounting the instant it clears.
  const [renderedSlotId, setRenderedSlotId] = useState<string | null>(null)
  useEffect(() => {
    if (openSlotId) setRenderedSlotId(openSlotId)
  }, [openSlotId])

  if (!day || !days) {
    return <div className="flex h-48 items-center justify-center text-muted-foreground">Loading…</div>
  }

  const today = format(new Date(), 'EEEE, d MMM')
  const subSlot = (slots ?? []).find((s) => s.id === substitutingSlotId)
  const renderedSlot = (slots ?? []).find((s) => s.id === renderedSlotId)

  const handleFinish = async () => {
    if (!sessionId) return
    await finishSession(sessionId, day.order)
  }

  /** Ensure session exists then open the drawer. */
  const handleOpenSlot = async (slotId: string) => {
    await ensure()
    setOpenSlotId(slotId)
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {today}
          </div>
          <h1 className="mt-0.5 text-2xl font-bold leading-tight">{day.name}</h1>
          <p className="text-sm text-muted-foreground">{day.focus}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Sound toggle */}
          <button
            onClick={() =>
              appState && updateAppState({ soundEnabled: !appState.soundEnabled })
            }
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={appState?.soundEnabled ? 'Mute timer' : 'Unmute timer'}
          >
            {appState?.soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>

          {/* Day picker */}
          <DayPicker days={days} selectedId={day.id} onSelect={setOverrideId} />
        </div>
      </header>

      {/* Exercise list */}
      <div className="divide-y divide-border/50 border-t border-border/50">
        {(slots ?? []).map((slot) => (
          <ExerciseListItem
            key={slot.id}
            slot={slot}
            sessionId={sessionId ?? undefined}
            onTap={() => handleOpenSlot(slot.id)}
          />
        ))}
      </div>

      {/* Finish session */}
      <div className="sticky bottom-20 z-10 px-4 pt-4 pb-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!sessionId}
          onClick={handleFinish}
        >
          <Check className="h-5 w-5" /> Finish session
        </Button>
        {!sessionId && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Tap an exercise to start today's session.
          </p>
        )}
      </div>

      {/* Exercise sheet drawer */}
      {renderedSlot && sessionId && (
        <ExerciseSheet
          key={renderedSlot.id}
          slot={renderedSlot}
          sessionId={sessionId}
          open={openSlotId === renderedSlot.id}
          onOpenChange={(o) => !o && setOpenSlotId(null)}
          onSubstitute={() => {
            setOpenSlotId(null)
            setSubstitutingSlotId(renderedSlot.id)
          }}
        />
      )}

      {/* Substitution dialog */}
      {subSlot && sessionId && (
        <SubstitutionDialog
          slot={subSlot}
          sessionId={sessionId}
          onClose={() => setSubstitutingSlotId(null)}
        />
      )}
    </div>
  )
}

function DayPicker({
  days,
  selectedId,
  onSelect,
}: {
  days: { id: string; name: string; order: number }[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-2 text-xs font-medium">
          Day {days.find((d) => d.id === selectedId)?.order}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {days.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent ${
              d.id === selectedId ? 'font-semibold text-primary' : ''
            }`}
          >
            <span className="truncate">{d.name}</span>
            {d.id === selectedId && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
