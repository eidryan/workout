import { useEffect, useState } from 'react'
import { db } from '@/db/db'
import type { SetLog, SessionSlotLog, Weight } from '@/db/types'

export interface LastSessionSlotData {
  sessionId: string
  date: string
  sets: SetLog[]
  slotLog?: SessionSlotLog
  /** The weight actually lifted — from slotLog.performedWeight or first stamped set. */
  weight?: Weight
}

/**
 * Returns the most recent *completed* session data for a given slot.
 * This is the source of truth for:
 *   - Last session reference display
 *   - WeightStepper pre-fill (pre-fill priority 2)
 */
export function useLastSessionSlot(slotId: string | undefined): LastSessionSlotData | null {
  const [data, setData] = useState<LastSessionSlotData | null>(null)

  useEffect(() => {
    if (!slotId) {
      setData(null)
      return
    }
    let cancelled = false
    ;(async () => {
      // Find all set logs for this slot across sessions.
      const setLogs = await db.setLogs.where('slotId').equals(slotId).toArray()
      if (!setLogs.length) return

      // Collect unique session IDs.
      const sessionIds = [...new Set(setLogs.map((l) => l.sessionId))]
      const sessions = await db.sessions.bulkGet(sessionIds)

      // Pick the most recent completed session.
      const completed = sessions
        .filter((s): s is NonNullable<typeof s> => !!s?.completedAt)
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))

      if (!completed.length) return

      const lastSession = completed[0]

      const [lastSets, slotLog] = await Promise.all([
        db.setLogs
          .where('[sessionId+slotId]')
          .equals([lastSession.id, slotId])
          .toArray()
          .then((rows) => rows.sort((a, b) => a.setNumber - b.setNumber)),
        db.sessionSlotLogs
          .where('[sessionId+slotId]')
          .equals([lastSession.id, slotId])
          .first(),
      ])

      // Weight: prefer slotLog.performedWeight, fallback to first stamped set weight.
      const weight =
        slotLog?.performedWeight ??
        lastSets.find((s) => s.weight)?.weight

      if (!cancelled) {
        setData({
          sessionId: lastSession.id,
          date: lastSession.date,
          sets: lastSets,
          slotLog,
          weight,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slotId])

  return data
}
