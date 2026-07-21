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

interface RestTimerState {
  /** Total seconds for the active timer (the original duration). */
  total: number
  /** Seconds remaining. */
  remaining: number
  /** Whether the countdown is currently ticking. */
  running: boolean
}

interface RestTimerApi extends RestTimerState {
  /** Start (or restart) a countdown for the given duration. */
  start: (seconds: number, notify?: RestNotify) => void
  pause: () => void
  resume: () => void
  skip: () => void
  adjust: (deltaSeconds: number) => void
}

const Ctx = createContext<RestTimerApi | null>(null)

/**
 * Wall-clock rest timer.
 *
 * The countdown is derived from an absolute `endsAt` timestamp rather than a
 * decrementing counter, so it stays correct when the tab is backgrounded and
 * `setInterval` is throttled/paused (fixes the "leaving Chrome forgets the
 * time" bug). On tab re-focus we recompute immediately from the wall clock.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [total, setTotal] = useState(0)
  /** Absolute completion time (ms epoch) while running; null when paused/idle. */
  const [endsAt, setEndsAt] = useState<number | null>(null)
  /** Seconds left while paused; null otherwise. Read only via state updaters. */
  const [, setPausedRemaining] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const appState = useAppState()
  const firedRef = useRef(false)
  const notifyRef = useRef<RestNotify | null>(null)

  const running = endsAt !== null

  const onComplete = useCallback(() => {
    if (appState?.soundEnabled) playSound(appState.soundType ?? 'beep', appState.volume ?? 0.3)
    if (appState?.vibrationEnabled) vibrate(appState.vibrationType ?? 'double')
    // Only notify when the user isn't looking at the app — otherwise the
    // in-app timer already tells them.
    if (
      appState?.notificationsEnabled &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible' &&
      notifyRef.current
    ) {
      fireNotification(notifyRef.current.title, notifyRef.current.body)
    }
  }, [
    appState?.soundEnabled,
    appState?.vibrationEnabled,
    appState?.soundType,
    appState?.volume,
    appState?.vibrationType,
    appState?.notificationsEnabled,
  ])

  // Derive `remaining` from the wall clock; fire completion once at zero.
  useEffect(() => {
    if (endsAt === null) return
    firedRef.current = false
    const tick = () => {
      const rem = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true
        onComplete()
        setEndsAt(null)
        setPausedRemaining(null)
        setTotal(0)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    // Recompute the instant the tab regains focus, in case the interval was
    // throttled to a standstill while backgrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt, onComplete])

  const start = useCallback((seconds: number, notify?: RestNotify) => {
    notifyRef.current = notify ?? null
    setTotal(seconds)
    setPausedRemaining(null)
    setRemaining(seconds)
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const pause = useCallback(() => {
    setEndsAt((prev) => {
      if (prev === null) return prev
      const rem = Math.max(0, Math.round((prev - Date.now()) / 1000))
      setPausedRemaining(rem)
      setRemaining(rem)
      return null
    })
  }, [])

  const resume = useCallback(() => {
    setPausedRemaining((rem) => {
      const left = rem ?? 0
      if (left > 0) setEndsAt(Date.now() + left * 1000)
      return null
    })
  }, [])

  const skip = useCallback(() => {
    setEndsAt(null)
    setPausedRemaining(null)
    setTotal(0)
    setRemaining(0)
  }, [])

  const adjust = useCallback((delta: number) => {
    setEndsAt((prevEnds) => {
      if (prevEnds !== null) {
        const newEnds = prevEnds + delta * 1000
        const rem = Math.max(0, Math.round((newEnds - Date.now()) / 1000))
        setRemaining(rem)
        setTotal((t) => Math.max(t, rem))
        return rem > 0 ? newEnds : null
      }
      // Paused or idle.
      setPausedRemaining((prevPaused) => {
        if (prevPaused === null && delta <= 0) return prevPaused
        const rem = Math.max(0, (prevPaused ?? 0) + delta)
        setRemaining(rem)
        setTotal((t) => Math.max(t, rem))
        // If there was no active timer at all, adding time starts a fresh one.
        if (prevPaused === null) {
          setEndsAt(Date.now() + rem * 1000)
          return null
        }
        return rem
      })
      return prevEnds
    })
  }, [])

  const api: RestTimerApi = { total, remaining, running, start, pause, resume, skip, adjust }
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
