import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db } from '@/db/db'
import type { ExerciseSlot, MuscleGroup } from '@/db/types'
import { updateExerciseSlot } from '@/hooks/useDb'

const MUSCLE_GROUPS: MuscleGroup[] = [
  'Legs',
  'Back',
  'Chest',
  'Shoulders',
  'Triceps',
  'Biceps',
  'Core',
]

export function SlotEditorDialog({
  slotId,
  onClose,
  onDelete,
}: {
  slotId: string
  onClose: () => void
  onDelete: () => void
}) {
  const [slot, setSlot] = useState<ExerciseSlot | null>(null)
  const [alternativesText, setAlternativesText] = useState('')

  useEffect(() => {
    db.exerciseSlots.get(slotId).then((s) => {
      if (!s) return
      setSlot(s)
      setAlternativesText(s.alternatives.join(', '))
    })
  }, [slotId])

  if (!slot) return null

  // Helper that patches local state and persists.
  const patch = (p: Partial<ExerciseSlot>) => {
    setSlot((prev) => (prev ? { ...prev, ...p } : prev))
    updateExerciseSlot(slotId, p)
  }

  const commitAlternatives = () => {
    const list = alternativesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    patch({ alternatives: list })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name">
            <Input
              value={slot.name}
              onChange={(e) => patch({ name: e.target.value })}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Sets">
              <Input
                type="number"
                inputMode="numeric"
                value={slot.scheme.sets}
                onChange={(e) =>
                  patch({ scheme: { ...slot.scheme, sets: Number(e.target.value) || 0 } })
                }
              />
            </Field>
            <Field label="Rep min">
              <Input
                type="number"
                inputMode="numeric"
                value={slot.scheme.repMin}
                onChange={(e) =>
                  patch({ scheme: { ...slot.scheme, repMin: Number(e.target.value) || 0 } })
                }
              />
            </Field>
            <Field label="Rep max">
              <Input
                type="number"
                inputMode="numeric"
                value={slot.scheme.repMax}
                onChange={(e) =>
                  patch({ scheme: { ...slot.scheme, repMax: Number(e.target.value) || 0 } })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="RIR min">
              <Input
                type="number"
                inputMode="numeric"
                value={slot.targetRir.min}
                onChange={(e) =>
                  patch({
                    targetRir: { ...slot.targetRir, min: Number(e.target.value) || 0 },
                  })
                }
              />
            </Field>
            <Field label="RIR max">
              <Input
                type="number"
                inputMode="numeric"
                value={slot.targetRir.max}
                onChange={(e) =>
                  patch({
                    targetRir: { ...slot.targetRir, max: Number(e.target.value) || 0 },
                  })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Default weight (kg)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={slot.defaultWeight.value}
                onChange={(e) =>
                  patch({
                    defaultWeight: {
                      ...slot.defaultWeight,
                      value: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
            <Field label="Per side">
              <button
                onClick={() =>
                  patch({
                    defaultWeight: {
                      ...slot.defaultWeight,
                      perSide: !slot.defaultWeight.perSide,
                    },
                  })
                }
                className={`h-10 w-full rounded-md border px-4 text-sm font-medium transition-colors ${
                  slot.defaultWeight.perSide
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background'
                }`}
              >
                2×{slot.defaultWeight.value}
              </button>
            </Field>
          </div>

          <Field label="Muscle group">
            <Select
              value={slot.muscleGroup}
              onValueChange={(v) => patch({ muscleGroup: v as MuscleGroup })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Rest (seconds)">
            <Input
              type="number"
              inputMode="numeric"
              value={slot.restSeconds ?? ''}
              onChange={(e) =>
                patch({ restSeconds: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>

          <Field label="Alternatives (comma separated)">
            <Input
              value={alternativesText}
              onChange={(e) => setAlternativesText(e.target.value)}
              onBlur={commitAlternatives}
              placeholder="e.g. Pec Deck, Machine Row"
            />
          </Field>

          <Field label="Note (optional)">
            <Input
              value={slot.note ?? ''}
              onChange={(e) => patch({ note: e.target.value || undefined })}
            />
          </Field>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
