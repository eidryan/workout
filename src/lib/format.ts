import type { Weight } from '@/db/types'

/** "2×15 kg" when perSide, otherwise "60 kg". */
export function formatWeight(weight: Weight | undefined | null): string {
  if (!weight) return '—'
  return weight.perSide ? `2×${weight.value} kg` : `${weight.value} kg`
}

/** "4x5–8" */
export function formatScheme(scheme: { sets: number; repMin: number; repMax: number }): string {
  if (scheme.repMin === scheme.repMax) return `${scheme.sets}x${scheme.repMin}`
  return `${scheme.sets}x${scheme.repMin}–${scheme.repMax}`
}

/** "1–2 RIR" or "2 RIR" */
export function formatRir(rir: { min: number; max: number }): string {
  if (rir.min === rir.max) return `${rir.min} RIR`
  return `${rir.min}–${rir.max} RIR`
}

/** "8@2" — RIR omitted if undefined */
export function formatSet(reps?: number, rir?: number): string {
  if (reps == null) return '—'
  if (rir == null) return `${reps}`
  return `${reps}@${rir}`
}

/** mm:ss, e.g. 90 -> "1:30" */
export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Clock time from an ISO timestamp, e.g. "10:42 PM". Empty for missing input. */
export function formatClock(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
