import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useDayTemplates,
  useExerciseSlots,
  updateDayTemplate,
  addExerciseSlot,
  deleteExerciseSlot,
  moveExerciseSlot,
} from '@/hooks/useDb'
import { formatScheme, formatRir, formatWeight } from '@/lib/format'
import { SlotEditorDialog } from '@/components/SlotEditorDialog'
import { AlertsSettings } from '@/components/AlertsSettings'
import { DataSettings } from '@/components/DataSettings'

export default function SettingsPage() {
  const days = useDayTemplates()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!days) return <div className="p-4 text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-center gap-2 pb-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Alerts &amp; feedback
        </h2>
        <AlertsSettings />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Data &amp; backup
        </h2>
        <DataSettings />
      </section>

      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Day templates
      </h2>

      {days.map((day) => {
        const isOpen = expanded === day.id
        return (
          <DayCard
            key={day.id}
            day={day}
            isOpen={isOpen}
            onToggle={() => setExpanded(isOpen ? null : day.id)}
            onNameChange={(name) => updateDayTemplate(day.id, { name })}
            onFocusChange={(focus) => updateDayTemplate(day.id, { focus })}
          />
        )
      })}

      <p className="px-1 pt-2 text-xs text-muted-foreground">
        Tap a day to expand its exercises. Tap any exercise to edit scheme, RIR, weight, rest, or
        alternatives.
      </p>
    </div>
  )
}

function DayCard({
  day,
  isOpen,
  onToggle,
  onNameChange,
  onFocusChange,
}: {
  day: { id: string; name: string; focus: string; order: number }
  isOpen: boolean
  onToggle: () => void
  onNameChange: (name: string) => void
  onFocusChange: (focus: string) => void
}) {
  const slots = useExerciseSlots(day.id)
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)

  return (
    <Card>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          {isOpen ? (
            <input
              value={day.name}
              onChange={(e) => onNameChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-base font-semibold outline-none"
            />
          ) : (
            <div className="truncate text-base font-semibold">{day.name}</div>
          )}
          {isOpen ? (
            <input
              value={day.focus}
              onChange={(e) => onFocusChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Focus"
              className="mt-0.5 w-full bg-transparent text-xs text-muted-foreground outline-none"
            />
          ) : (
            <div className="truncate text-xs text-muted-foreground">{day.focus}</div>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="divide-y divide-border">
            {(slots ?? []).map((slot, i) => (
              <div key={slot.id} className="flex items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setEditingSlotId(slot.id)}
                    className="block w-full text-left"
                  >
                    <div className="truncate text-sm font-medium">{slot.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatScheme(slot.scheme)} · {formatRir(slot.targetRir)} ·{' '}
                      {formatWeight(slot.defaultWeight)} · {slot.muscleGroup}
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveExerciseSlot(slot.id, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveExerciseSlot(slot.id, 1)}
                    disabled={i === (slots?.length ?? 0) - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className={cn('flex gap-2 p-3')}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={async () => {
                const id = await addExerciseSlot(day.id)
                setEditingSlotId(id)
              }}
            >
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          </div>
        </div>
      )}

      {editingSlotId && (
        <SlotEditorDialog
          slotId={editingSlotId}
          onClose={() => setEditingSlotId(null)}
          onDelete={async () => {
            await deleteExerciseSlot(editingSlotId)
            setEditingSlotId(null)
          }}
        />
      )}
    </Card>
  )
}
