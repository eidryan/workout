import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Session } from '@/db/types'
import { useDayTemplates, useAppState, updateAppState } from './useDb'

/**
 * The most recent still-in-progress (uncompleted) session, if any.
 * `undefined` while loading, `null` when there is none.
 */
export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => {
    const rows = await db.sessions.orderBy('createdAt').reverse().toArray()
    return rows.find((s) => !s.completedAt) ?? null
  }, [])
}

/**
 * Returns the day-template that should be shown as "today":
 *  1. a manual override (day picker), while on the page
 *  2. the day of any in-progress session — so leaving and coming back later
 *     (even on a different calendar day) resumes where you were, instead of
 *     snapping to the rotation's next day
 *  3. otherwise the next day in the completion-based rotation (1..4 → 1)
 *
 * The override does NOT mutate the rotation pointer until a session is completed.
 */
export function useNextDay() {
  const days = useDayTemplates()
  const appState = useAppState()
  const active = useActiveSession()
  const [overrideId, setOverrideId] = useState<string | null>(null)

  const overrideDay = overrideId ? days?.find((d) => d.id === overrideId) : undefined
  const activeDay = active ? days?.find((d) => d.id === active.dayTemplateId) : undefined
  const rotationDay = days?.find(
    (d) => d.order === ((appState?.lastCompletedDayOrder ?? 0) % 4) + 1,
  )

  const day = overrideDay ?? activeDay ?? rotationDay

  return { day, days, overrideId, setOverrideId }
}

/** ISO date for today (YYYY-MM-DD). */
function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface TodaySession {
  sessionId: string
  /** Ensure the session row exists; returns its id. */
  ensure: () => Promise<string>
}

/**
 * Lazily creates and tracks today's session for a given day-template.
 * The Session row is only written on the first set logged.
 */
export function useTodaySession(dayTemplateId: string | undefined): TodaySession {
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Resume the in-progress (uncompleted) session for this template regardless
  // of date, so a workout started earlier is continued rather than restarted.
  useEffect(() => {
    if (!dayTemplateId) {
      setSessionId(null)
      return
    }
    let cancelled = false
    db.sessions
      .where('dayTemplateId')
      .equals(dayTemplateId)
      .reverse()
      .sortBy('createdAt')
      .then((rows) => {
        if (cancelled) return
        const inProgress = rows.find((r) => !r.completedAt)
        setSessionId(inProgress ? inProgress.id : null)
      })
    return () => {
      cancelled = true
    }
  }, [dayTemplateId])

  const ensure = useCallback(async () => {
    if (sessionId) return sessionId
    const id = crypto.randomUUID()
    const newSession = {
      id,
      dayTemplateId: dayTemplateId!,
      date: today(),
      createdAt: new Date().toISOString(),
      source: 'manual' as const,
    }
    await db.sessions.put(newSession)
    setSessionId(id)
    return id
  }, [sessionId, dayTemplateId])

  return { sessionId: sessionId!, ensure }
}

/** Finishes the current session and advances the rotation pointer. */
export async function finishSession(sessionId: string, dayOrder: number): Promise<void> {
  await db.sessions.update(sessionId, { completedAt: new Date().toISOString() })
  await updateAppState({ lastCompletedDayOrder: dayOrder, lastSessionId: sessionId })
}

/** Returns the most recent *completed* session of a given day-template. */
export function useLastSession(dayTemplateId: string | undefined) {
  const [last, setLast] = useState<{ sessionId: string; date: string } | null>(null)
  useEffect(() => {
    if (!dayTemplateId) return setLast(null)
    let cancelled = false
    db.sessions
      .where('dayTemplateId')
      .equals(dayTemplateId)
      .reverse()
      .sortBy('createdAt')
      .then((rows) => {
        if (cancelled) return
        const completed = rows.find((r) => r.completedAt)
        setLast(completed ? { sessionId: completed.id, date: completed.date } : null)
      })
    return () => {
      cancelled = true
    }
  }, [dayTemplateId])
  return last
}
