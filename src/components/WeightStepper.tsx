import { useState, useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { Weight } from '@/db/types'
import { cn } from '@/lib/utils'

/**
 * Session-level weight stepper for an exercise.
 *
 * Pre-fill priority (first hit wins):
 *   1. todayWeight — already set for this exercise today (resume)
 *   2. lastWeight  — what was lifted last completed session
 *   3. defaultWeight — template fallback
 *
 * Each nudge fires onChange immediately so the parent can persist to
 * SessionSlotLog.performedWeight and stamp each SetLog at commit time.
 */
export function WeightStepper({
  todayWeight,
  lastWeight,
  defaultWeight,
  onChange,
  className,
}: {
  todayWeight?: Weight
  lastWeight?: Weight
  defaultWeight: Weight
  onChange: (w: Weight) => void
  className?: string
}) {
  const seed = todayWeight ?? lastWeight ?? defaultWeight
  const [value, setValue] = useState(seed.value)
  const [perSide, setPerSide] = useState(seed.perSide)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-seed if the external seed changes (e.g. data loads async).
  useEffect(() => {
    const newSeed = todayWeight ?? lastWeight ?? defaultWeight
    setValue(newSeed.value)
    setPerSide(newSeed.perSide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    todayWeight?.value,
    todayWeight?.perSide,
    lastWeight?.value,
    defaultWeight.value,
  ])

  const emit = (v: number, ps: boolean) => {
    onChange({ value: v, perSide: ps })
  }

  const nudge = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 4) / 4) // 0.25 precision
    setValue(next)
    emit(next, perSide)
  }

  const togglePerSide = () => {
    const next = !perSide
    setPerSide(next)
    emit(value, next)
  }

  const startEdit = () => {
    setEditText(String(value))
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const commitEdit = () => {
    const n = parseFloat(editText)
    if (Number.isFinite(n) && n >= 0) {
      setValue(n)
      emit(n, perSide)
    }
    setEditing(false)
  }

  const displayLabel = perSide ? `2 × ${value} kg` : `${value} kg`

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="flex items-center gap-3">
        {/* Minus */}
        <button
          onClick={() => nudge(-2.5)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-colors active:bg-muted"
          aria-label="Decrease weight by 2.5 kg"
        >
          <Minus className="h-4 w-4" />
        </button>

        {/* Value display / inline editor */}
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.5"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-24 rounded-md border border-primary bg-background px-2 py-1 text-center text-xl font-bold outline-none ring-2 ring-primary/40"
          />
        ) : (
          <button
            onClick={startEdit}
            className="min-w-[6rem] text-center text-xl font-bold tabular-nums leading-none"
            aria-label={`Current weight: ${displayLabel}. Tap to type`}
          >
            {displayLabel}
          </button>
        )}

        {/* Plus */}
        <button
          onClick={() => nudge(2.5)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-colors active:bg-muted"
          aria-label="Increase weight by 2.5 kg"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Per-side toggle */}
      <button
        onClick={togglePerSide}
        className={cn(
          'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors',
          perSide
            ? 'border-primary bg-primary/15 text-primary'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={perSide}
      >
        {perSide ? '2× per side' : 'total weight'}
      </button>

      {/* Source hint */}
      {!todayWeight && lastWeight && (
        <p className="text-[10px] text-muted-foreground/60">
          pre-filled from last session
        </p>
      )}
    </div>
  )
}
