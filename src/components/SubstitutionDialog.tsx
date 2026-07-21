import { useEffect, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ExerciseSlot, Weight } from '@/db/types'
import { upsertSessionSlotLog, useSessionSlotLog } from '@/hooks/useSetLogs'

/**
 * Lets the user substitute the exercise for this session only.
 * Picks from the slot's alternatives or enters a custom name, and can
 * optionally set a different weight for the substituted exercise.
 */
export function SubstitutionDialog({
  slot,
  sessionId,
  onClose,
}: {
  slot: ExerciseSlot
  sessionId: string
  onClose: () => void
}) {
  const slotLog = useSessionSlotLog(sessionId, slot.id)
  const [name, setName] = useState('')
  const [weightText, setWeightText] = useState('')
  const [perSide, setPerSide] = useState(slot.defaultWeight.perSide)

  // Initialise from current slot log, if any.
  useEffect(() => {
    if (slotLog) {
      setName(slotLog.performedName === slot.name ? '' : slotLog.performedName)
      if (slotLog.performedWeight) {
        setWeightText(String(slotLog.performedWeight.value))
        setPerSide(slotLog.performedWeight.perSide)
      }
    }
  }, [slotLog, slot.name, slot.id])

  const apply = async (performedName: string) => {
    let performedWeight: Weight | undefined
    const n = parseFloat(weightText)
    if (Number.isFinite(n) && n >= 0) {
      performedWeight = { value: n, perSide }
    }
    await upsertSessionSlotLog({
      sessionId,
      slotId: slot.id,
      performedName,
      performedWeight,
      skipped: slotLog?.skipped,
    })
    onClose()
  }

  const reset = async () => {
    await upsertSessionSlotLog({
      sessionId,
      slotId: slot.id,
      performedName: slot.name,
      performedWeight: undefined,
      skipped: slotLog?.skipped,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Substitute exercise</DialogTitle>
          <DialogDescription>
            For this session only. Doesn't change the day template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alternatives list */}
          {slot.alternatives.length > 0 && (
            <div className="space-y-1">
              <Label>Alternatives</Label>
              {slot.alternatives.map((alt) => (
                <button
                  key={alt}
                  onClick={() => apply(alt)}
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {alt}
                  {slotLog?.performedName === alt && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Custom name */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Or use a different exercise</Label>
            <div className="flex gap-2">
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dumbbell Curl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) apply(name.trim())
                }}
              />
              <Button
                onClick={() => name.trim() && apply(name.trim())}
                disabled={!name.trim()}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Optional weight override for the sub */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-weight">Weight (kg, optional)</Label>
              <Input
                id="sub-weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                placeholder={String(slot.defaultWeight.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Per side</Label>
              <button
                onClick={() => setPerSide((p) => !p)}
                className={`h-10 w-full rounded-md border px-4 text-sm font-medium transition-colors ${
                  perSide
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background'
                }`}
              >
                2×
              </button>
            </div>
          </div>

          {/* Reset to default */}
          {slotLog && slotLog.performedName !== slot.name && (
            <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Reset to {slot.name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
