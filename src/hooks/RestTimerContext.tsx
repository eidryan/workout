import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { playSound, vibrate, fireNotification } from '@/lib/sound'
import { useAppState } from './useDb'

/** Optional payload shown as a notification if rest ends while backgrounded. */
export interface RestNotify {
  title: string
  body: string
}

interface RestTimerApi {
  /** Original duration in seconds (0 when idle). */
  total: number
  /** Seconds remaining. */
  remaining: number
  /** True while counting down (false when paused or idle). */
  running: boolean
  start: (seconds: number, notify?: RestNotify) => void
  pause: () => void
  resume: () => void
  skip: () => void
  adjust: (deltaSeconds: number) => void
}

/**
 * Timer state.
 *
 * The countdown is anchored to an absolute `endsAt` timestamp instead of a
 * decrementing counter. Background tabs get their timers throttled (or frozen
 * entirely on mobile), so anything that counts *ticks* drifts or stalls. Wall
 * clock arithmetic is immune: however long the tab was asleep, the remaining
 * time is still correct the moment we look again.
 */
interface Core {
  total: number
  /** Absolute end time (ms epoch) while running; null when paused/idle. */
  endsAt: number | null
  /** Seconds left while paused; null otherwise. */
  pausedRemaining: number | null
}

const IDLE: Core = { total: 0, endsAt: null, pausedRemaining: null }

const Ctx = createContext<RestTimerApi | null>(null)

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [core, setCore] = useState<Core>(IDLE)
  const [now, setNow] = useState(() => Date.now())
  const appState = useAppState()
  const notifyRef = useRef<RestNotify | null>(null)
  const firedForRef = useRef<number | null>(null)

  const running = core.endsAt !== null
  const remaining =
    core.endsAt !== null
      ? Math.max(0, Math.round((core.endsAt - now) / 1000))
      : (core.pausedRemaining ?? 0)

  // Drive re-renders while running, and re-sync the instant the tab is shown
  // again (the interval may have been throttled to a standstill).
  useEffect(() => {
    if (!running) return
    const sync = () => setNow(Date.now())
    sync()
    const id = setInterval(sync, 250)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [running])

  // Fire completion feedback exactly once per timer.
  useEffect(() => {
    if (!running || remaining > 0 || core.endsAt === null) return
    if (firedForRef.current === core.endsAt) return
    firedForRef.current = core.endsAt

    if (appState?.soundEnabled) playSound(appState.soundType ?? 'beep', appState.volume ?? 0.3)
    if (appState?.vibrationEnabled) vibrate(appState.vibrationType ?? 'double')
    // Only notify when the user isn't looking — otherwise the in-app timer
    // already told them.
    if (
      appState?.notificationsEnabled &&
      document.visibilityState !== 'visible' &&
      notifyRef.current
    ) {
      fireNotification(notifyRef.current.title, notifyRef.current.body)
    }
    setCore(IDLE)
  }, [running, remaining, core.endsAt, appState])

  const start = useCallback((seconds: number, notify?: RestNotify) => {
    notifyRef.current = notify ?? null
    const endsAt = Date.now() + seconds * 1000
    firedForRef.current = null
    setNow(Date.now())
    setCore({ total: seconds, endsAt, pausedRemaining: null })
  }, [])

  const pause = useCallback(() => {
    setCore((c) => {
      if (c.endsAt === null) return c
      const rem = Math.max(0, Math.round((c.endsAt - Date.now()) / 1000))
      return { ...c, endsAt: null, pausedRemaining: rem }
    })
  }, [])

  const resume = useCallback(() => {
    setCore((c) => {
      const rem = c.pausedRemaining ?? 0
      if (rem <= 0) return c
      firedForRef.current = null
      return { ...c, endsAt: Date.now() + rem * 1000, pausedRemaining: null }
    })
  }, [])

  const skip = useCallback(() => setCore(IDLE), [])

  const adjust = useCallback((delta: number) => {
    setCore((c) => {
      // Running: shift the end time.
      if (c.endsAt !== null) {
        const endsAt = c.endsAt + delta * 1000
        const rem = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
        if (rem <= 0) return IDLE
        return { total: Math.max(c.total, rem), endsAt, pausedRemaining: null }
      }
      // Paused: adjust the stored remainder.
      if (c.pausedRemaining !== null) {
        const rem = Math.max(0, c.pausedRemaining + delta)
        return { ...c, total: Math.max(c.total, rem), pausedRemaining: rem }
      }
      // Idle: adding time starts a fresh timer.
      if (delta <= 0) return c
      firedForRef.current = null
      return { total: delta, endsAt: Date.now() + delta * 1000, pausedRemaining: null }
    })
  }, [])

  const api: RestTimerApi = {
    total: core.total,
    remaining,
    running,
    start,
    pause,
    resume,
    skip,
    adjust,
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useRestTimer(): RestTimerApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRestTimer must be used within RestTimerProvider')
  return ctx
}

/** Reusable ref so callers can dedupe rapid commits (e.g. typing a set). */
export function useCommitGate() {
  const lastStarted = useRef<{ slotId: string; setNumber: number } | null>(null)
  return {
    shouldStart: (slotId: string, setNumber: number) => {
      const last = lastStarted.current
      if (last && last.slotId === slotId && last.setNumber === setNumber) return false
      lastStarted.current = { slotId, setNumber }
      return true
    },
    reset: () => {
      lastStarted.current = null
    },
  }
}
