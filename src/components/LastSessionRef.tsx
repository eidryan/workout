import { History } from 'lucide-react'
import { useLastSessionSlot } from '@/hooks/useLastSessionSlot'
import { formatSet, formatWeight } from '@/lib/format'

/**
 * Reference row showing what was logged last time for this slot.
 * Now a thin display wrapper over useLastSessionSlot.
 */
export function LastSessionRef({
  slotId,
  defaultSlotName,
}: {
  slotId: string
  defaultSlotName: string
}) {
  const data = useLastSessionSlot(slotId)

  if (!data || !data.sets.length) return null

  const nameChanged = data.slotLog && data.slotLog.performedName !== defaultSlotName
  const setsStr = data.sets.map((s) => formatSet(s.reps, s.rir)).join(', ')

  return (
    <div className="flex items-start gap-1.5 px-1 py-1 text-xs text-muted-foreground">
      <History className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
      <div className="min-w-0">
        {nameChanged && (
          <span className="font-medium text-foreground/70">{data.slotLog!.performedName}: </span>
        )}
        <span>{setsStr}</span>
        <span className="opacity-70">
          {' '}
          · {formatWeight(data.weight)} {data.date && `· ${data.date}`}
        </span>
      </div>
    </div>
  )
}
