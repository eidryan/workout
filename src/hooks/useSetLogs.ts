import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { SessionSlotLog, SetLog, Weight } from '@/db/types'

/** Reactive set logs for one slot in one session. */
export function useSlotSetLogs(sessionId: string | undefined, slotId: string): SetLog[] {
  return useLiveQuery(
    async () => {
      if (!sessionId) return []
      const rows = await db.setLogs
        .where('[sessionId+slotId]')
        .equals([sessionId, slotId])
        .toArray()
      return rows.sort((a, b) => a.setNumber - b.setNumber)
    },
    [sessionId, slotId],
    [] as SetLog[],
  )
}

/** Up-serts a set log for a given session/slot/set number. */
export async function upsertSetLog(args: {
  sessionId: string
  slotId: string
  setNumber: number
  reps?: number
  rir?: number
  weight?: Weight
  skipped?: boolean
}): Promise<void> {
  const { sessionId, slotId, setNumber } = args
  const existing = await db.setLogs
    .where('[sessionId+slotId]')
    .equals([sessionId, slotId])
    .and((s) => s.setNumber === setNumber)
    .first()

  if (existing) {
    // Preserve the original log time when editing a set later.
    await db.setLogs.update(existing.id, {
      ...args,
      loggedAt: existing.loggedAt ?? new Date().toISOString(),
    })
  } else {
    await db.setLogs.put({
      id: crypto.randomUUID(),
      ...args,
      loggedAt: new Date().toISOString(),
    })
  }
}

/** Per-slot record (performed name / weight / skipped) within a session. */
export function useSessionSlotLog(
  sessionId: string | undefined,
  slotId: string,
): SessionSlotLog | undefined {
  return useLiveQuery(
    async () => {
      if (!sessionId) return undefined
      return await db.sessionSlotLogs
        .where('[sessionId+slotId]')
        .equals([sessionId, slotId])
        .first()
    },
    [sessionId, slotId],
  )
}

export async function upsertSessionSlotLog(args: {
  sessionId: string
  slotId: string
  performedName: string
  performedWeight?: Weight
  skipped?: boolean
}): Promise<void> {
  await db.sessionSlotLogs.put(args)
}
