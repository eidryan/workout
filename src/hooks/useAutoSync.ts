import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { setSyncUser, requestSync } from '@/db/sync'

/**
 * Keeps cloud sync running app-wide (mounted once in App), independent of
 * which page is open — otherwise nothing would sync while you're actually
 * logging a workout on the Today page.
 *
 * Triggers: sign-in, returning to the tab, regaining connectivity, and a slow
 * heartbeat as a backstop.
 */
export function useAutoSync(): void {
  const { user } = useAuth()

  useEffect(() => {
    setSyncUser(user?.id ?? null)
    if (!user) return

    requestSync(0)

    const onVisible = () => {
      if (document.visibilityState === 'visible') requestSync(500)
    }
    const onOnline = () => requestSync(500)

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const heartbeat = setInterval(() => requestSync(0), 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearInterval(heartbeat)
    }
  }, [user])
}
