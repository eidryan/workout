import { cn } from '@/lib/utils'
import type { SetLog, SessionSlotLog } from '@/db/types'

/**
 * Progress dots for a single exercise slot.
 * Filled = logged (non-skipped) sets; hollow = remaining; crossed = skipped.
 */
export function SetProgressDots({
  totalSets,
  logs,
  slotLog,
  className,
}: {
  totalSets: number
  logs: SetLog[]
  slotLog?: SessionSlotLog
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1', className)} aria-label="Set progress">
      {Array.from({ length: totalSets }).map((_, i) => {
        const log = logs.find((l) => l.setNumber === i + 1)
        const isSkipped = log?.skipped
        const isDone = !!log && !isSkipped
        return (
          <span
            key={i}
            className={cn(
              'inline-block h-2 w-2 rounded-full border transition-colors',
              isDone
                ? 'border-primary bg-primary'
                : isSkipped
                  ? 'border-muted-foreground/40 bg-transparent line-through'
                  : 'border-muted-foreground/40 bg-transparent',
            )}
            aria-label={isDone ? `Set ${i + 1} done` : isSkipped ? `Set ${i + 1} skipped` : `Set ${i + 1} pending`}
          />
        )
      })}
      {slotLog?.skipped && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">skipped</span>
      )}
    </div>
  )
}
