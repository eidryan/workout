import { ChevronRight } from 'lucide-react'
import { SetProgressDots } from './SetProgressDots'
import { useSlotSetLogs, useSessionSlotLog } from '@/hooks/useSetLogs'
import { useLastSessionSlot } from '@/hooks/useLastSessionSlot'
import type { ExerciseSlot } from '@/db/types'
import { formatWeight } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Compact list row for a single exercise slot on the Today page.
 *
 * Shows: status glyph · name · progress dots · working weight
 *
 * Status:
 *   ○ not started  → hollow dots, last-session weight
 *   ● in progress  → filled dots, accent colour, working weight
 *   ✓ done         → collapsed single line
 *   ⤫ skipped      → struck-through / dimmed
 */
export function ExerciseListItem({
  slot,
  sessionId,
  onTap,
}: {
  slot: ExerciseSlot
  sessionId?: string
  onTap: () => void
}) {
  const logs = useSlotSetLogs(sessionId, slot.id)
  const slotLog = useSessionSlotLog(sessionId, slot.id)
  const lastSession = useLastSessionSlot(slot.id)

  const isSkipped = !!slotLog?.skipped
  const performedSets = logs.filter((l) => !l.skipped).length
  // "Resolved" once every set has a decision (performed or skipped), matching
  // the sheet's allDone. Otherwise skipping the last set leaves the row stuck.
  const isDone = !isSkipped && logs.length >= slot.scheme.sets
  const isInProgress = logs.length > 0 && !isDone && !isSkipped

  // Working weight for display: today's override → last session → template default.
  const displayWeight =
    slotLog?.performedWeight ?? lastSession?.weight ?? slot.defaultWeight

  const displayName = slotLog?.performedName ?? slot.name

  return (
    <button
      onClick={onTap}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        'hover:bg-accent/50 active:bg-accent',
        isSkipped && 'opacity-40',
        isInProgress && 'bg-primary/5',
      )}
    >
      {/* Status glyph */}
      <span
        className={cn(
          'shrink-0 text-sm font-bold tabular-nums',
          isDone ? 'text-green-500' : isSkipped ? 'text-muted-foreground' : isInProgress ? 'text-primary' : 'text-muted-foreground/40',
        )}
        aria-label={isDone ? 'Done' : isSkipped ? 'Skipped' : isInProgress ? 'In progress' : 'Not started'}
      >
        {isDone ? '✓' : isSkipped ? '⤫' : '○'}
      </span>

      {/* Name + dots */}
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium', isDone && 'text-muted-foreground', isSkipped && 'line-through')}>
          {displayName}
          {slotLog?.performedName && slotLog.performedName !== slot.name && (
            <span className="ml-1.5 text-[10px] font-normal text-primary/70">(sub)</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {isDone ? (
            <span className="text-xs text-muted-foreground">
              {performedSets} sets · {formatWeight(displayWeight)}
            </span>
          ) : (
            <SetProgressDots
              totalSets={slot.scheme.sets}
              logs={logs}
              slotLog={slotLog}
            />
          )}
        </div>
      </div>

      {/* Weight + chevron */}
      {!isDone && !isSkipped && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn('text-xs font-medium tabular-nums', isInProgress ? 'text-foreground' : 'text-muted-foreground')}>
            {formatWeight(displayWeight)}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      )}
    </button>
  )
}
