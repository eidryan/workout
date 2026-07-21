import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Dumbbell, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { db } from '@/db/db'
import type { Session, ExerciseSlot, SetLog, SessionSlotLog } from '@/db/types'
import { formatScheme, formatSet, formatWeight, formatClock } from '@/lib/format'

interface HistoryEntry {
  session: Session
  dayName: string
  dayFocus: string
  slots: {
    slot: ExerciseSlot
    slotLog?: SessionSlotLog
    sets: SetLog[]
  }[]
  totalSets: number
  totalVolume: number // kg × reps summed
}

function useHistory(): HistoryEntry[] | undefined {
  const [entries, setEntries] = useState<HistoryEntry[] | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sessions = await db.sessions
        .orderBy('createdAt')
        .reverse()
        .toArray()

      const completed = sessions.filter((s) => s.completedAt)

      const result: HistoryEntry[] = []
      for (const session of completed) {
        const [dayTemplate, setLogs, slotLogs] = await Promise.all([
          db.dayTemplates.get(session.dayTemplateId),
          db.setLogs.where('sessionId').equals(session.id).toArray(),
          db.sessionSlotLogs.where('sessionId').equals(session.id).toArray(),
        ])
        if (!dayTemplate) continue

        const slotIds = [...new Set(setLogs.map((l) => l.slotId))]
        const exerciseSlots = await db.exerciseSlots.bulkGet(slotIds)

        const slotMap = new Map<string, ExerciseSlot>()
        exerciseSlots.forEach((s) => s && slotMap.set(s.id, s))

        const grouped = slotIds
          .map((slotId) => {
            const slot = slotMap.get(slotId)
            if (!slot) return null
            const slotLog = slotLogs.find((l) => l.slotId === slotId)
            const sets = setLogs
              .filter((l) => l.slotId === slotId)
              .sort((a, b) => a.setNumber - b.setNumber)
            return { slot, slotLog, sets }
          })
          .filter(Boolean) as HistoryEntry['slots']

        // Sort by exercise slot order
        grouped.sort((a, b) => (a.slot.order ?? 0) - (b.slot.order ?? 0))

        const totalSets = setLogs.filter((l) => !l.skipped).length
        const totalVolume = setLogs.reduce((sum, l) => {
          if (l.skipped || !l.reps) return sum
          const w = l.weight ?? slotMap.get(l.slotId)?.defaultWeight
          if (!w) return sum
          return sum + l.reps * w.value * (w.perSide ? 2 : 1)
        }, 0)

        result.push({
          session,
          dayName: dayTemplate.name,
          dayFocus: dayTemplate.focus,
          slots: grouped,
          totalSets,
          totalVolume,
        })
      }

      if (!cancelled) setEntries(result)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return entries
}

export default function HistoryPage() {
  const entries = useHistory()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (entries === undefined) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No completed sessions yet.</p>
        <p className="text-sm text-muted-foreground">
          Finish your first session on the Today tab to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-center gap-2 pb-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">History</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {entries.length} session{entries.length !== 1 ? 's' : ''}
        </span>
      </header>

      {entries.map((entry) => {
        const isOpen = expandedId === entry.session.id
        const dateLabel = format(parseISO(entry.session.date), 'EEE, d MMM yyyy')

        return (
          <Card key={entry.session.id}>
            <button
              onClick={() => setExpandedId(isOpen ? null : entry.session.id)}
              className="flex w-full items-start gap-3 p-4 text-left"
            >
              {isOpen ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{entry.dayName}</div>
                  <div className="shrink-0 text-xs text-muted-foreground">{dateLabel}</div>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.dayFocus}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span>{entry.totalSets} sets</span>
                  {entry.session.completedAt && (
                    <span>
                      {formatClock(entry.session.createdAt)}–{formatClock(entry.session.completedAt)}
                    </span>
                  )}
                  {entry.totalVolume > 0 && (
                    <span>{entry.totalVolume.toLocaleString()} kg total vol.</span>
                  )}
                  {entry.session.completedAt && (
                    <span className="ml-auto text-green-500/80 font-medium">✓ Done</span>
                  )}
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border">
                {entry.slots.map(({ slot, slotLog, sets }) => {
                  const displayedName = slotLog?.performedName ?? slot.name
                  const isSubstituted = slotLog && slotLog.performedName !== slot.name
                  return (
                    <div key={slot.id} className="border-b border-border/50 px-4 py-3 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{displayedName}</span>
                        {isSubstituted && (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            sub
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatScheme(slot.scheme)}
                      </div>
                      {sets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sets.map((s) => {
                            const weight = s.weight ?? slotLog?.performedWeight ?? slot.defaultWeight
                            return (
                              <span
                                key={s.setNumber}
                                className={`inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono ${
                                  s.skipped ? 'opacity-40 line-through' : ''
                                }`}
                              >
                                <span className="text-muted-foreground">{s.setNumber}.</span>
                                {formatSet(s.reps, s.rir)}
                                <span className="text-muted-foreground/70">
                                  · {formatWeight(weight)}
                                </span>
                                {s.loggedAt && (
                                  <span className="text-muted-foreground/50">
                                    · {formatClock(s.loggedAt)}
                                  </span>
                                )}
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {sets.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground/60 italic">No sets logged</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
