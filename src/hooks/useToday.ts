import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useDayTemplates, useAppState, updateAppState } from './useDb'
import { requestSync } from '@/db/sync'

/**
 * How long an unfinished session stays "resumable". Inside this window we
 * assume you're mid-workout (left the gym, came back, phone slept). Outside
 * it, the session is treated as abandoned so it can't hijack the rotation
 * forever.
 */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000

interface DaySelection {
  /** Day template to resume — an unfinished session is still in progress. */
  resumeDayTemplateId?: string
  /** Day template that was last actually worked; the next one is due. */
  lastWorkedDayTemplateId?: string
}

/**
 * Works out which day is due, from the session history rather than the
 * rotation pointer alone (the pointer only moves on an explicit "Finish
 * session", which is easy to forget).
 */
export function useDaySelection(): DaySelection | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('createdAt').reverse().toArray()
    if (!sessions.length) return {}

    // 1. Genuinely mid-workout?
    const now = Date.now()
    const resumable = sessions.find(
      (s) => !s.completedAt && now - new Date(s.createdAt).getTime() < RESUME_WINDOW_MS,
    )
    if (resumable) return { resumeDayTemplateId: resumable.dayTemplateId }

    // 2. Otherwise advance past the last day that saw real work — whether or
    //    not it was formally finished.
    for (const s of sessions) {
      if (s.completedAt) return { lastWorkedDayTemplateId: s.dayTemplateId }
      const logged = await db.setLogs.where('sessionId').equals(s.id).count()
      if (logged > 0) return { lastWorkedDayTemplateId: s.dayTemplateId }
    }
    return {}
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
  const selection = useDaySelection()
  const [overrideId, setOverrideId] = useState<string | null>(null)

  const byId = (id?: string) => (id ? days?.find((d) => d.id === id) : undefined)
  const nextAfter = (order: number) => days?.find((d) => d.order === (order % 4) + 1)

  const overrideDay = byId(overrideId ?? undefined)
  const resumeDay = byId(selection?.resumeDayTemplateId)

  // Day after the last one actually worked; falls back to the stored pointer.
  const lastWorked = byId(selection?.lastWorkedDayTemplateId)
  const advanceDay = lastWorked
    ? nextAfter(lastWorked.order)
    : nextAfter(appState?.lastCompletedDayOrder ?? 0)

  const day = overrideDay ?? resumeDay ?? advanceDay

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
      updatedAt: new Date().toISOString(),
    }
    await db.sessions.put(newSession)
    setSessionId(id)
    return id
  }, [sessionId, dayTemplateId])

  return { sessionId: sessionId!, ensure }
}

/** Finishes the current session and advances the rotation pointer. */
export async function finishSession(sessionId: string, dayOrder: number): Promise<void> {
  await db.sessions.update(sessionId, {
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await updateAppState({ lastCompletedDayOrder: dayOrder, lastSessionId: sessionId })
  requestSync(0)
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
