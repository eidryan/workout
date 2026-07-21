import { useState, useEffect, useCallback } from 'react'
import { Cloud, CloudOff, RefreshCw, LogOut, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, sendLoginCode, verifyLoginCode, signOut } from '@/hooks/useAuth'
import { syncNow, lastSyncAt } from '@/db/sync'
import { formatClock } from '@/lib/format'

/** Cloud sync: sign in with an emailed code, then two-way sync on demand. */
export function SyncSettings() {
  const { user, loading, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(lastSyncAt())

  const runSync = useCallback(
    async (silent = false) => {
      if (!user) return
      setBusy(true)
      if (!silent) setMsg('Syncing…')
      try {
        const r = await syncNow(user.id)
        setSyncedAt(r.at)
        setMsg(`Synced — ${r.pushed} up, ${r.pulled} down.`)
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Sync failed.')
      } finally {
        setBusy(false)
      }
    },
    [user],
  )

  // Sync on sign-in, on regaining focus, and when coming back online.
  useEffect(() => {
    if (!user) return
    runSync(true)
    const onFocus = () => {
      if (document.visibilityState === 'visible') runSync(true)
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [user, runSync])

  if (!isConfigured) {
    return (
      <Card className="flex items-start gap-2 p-4">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Cloud sync isn’t configured on this build. Your data stays on this device — use
          Export below to back it up.
        </p>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-4 text-xs text-muted-foreground">Checking sign-in…</Card>
    )
  }

  // ---- Signed in --------------------------------------------------------
  if (user) {
    return (
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {syncedAt ? `Last synced ${formatClock(syncedAt)}` : 'Not synced yet'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => runSync()}
          >
            <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Sync now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut()
              setMsg(null)
              setStage('email')
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </Card>
    )
  }

  // ---- Signed out -------------------------------------------------------
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-2">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Sign in to sync your workouts across devices. We’ll email you a 6-digit code —
          no password.
        </p>
      </div>

      {stage === 'email' ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!email.trim()) return
            setBusy(true)
            setMsg(null)
            const { error } = await sendLoginCode(email.trim())
            setBusy(false)
            if (error) setMsg(error)
            else {
              setStage('code')
              setMsg('Code sent — check your email.')
            }
          }}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 flex-1"
          />
          <Button type="submit" size="sm" disabled={busy || !email.trim()}>
            Send code
          </Button>
        </form>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setMsg(null)
            const { error } = await verifyLoginCode(email.trim(), code.trim())
            setBusy(false)
            if (error) setMsg(error)
            else {
              setCode('')
              setMsg('Signed in.')
            }
          }}
        >
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-9 flex-1 text-center tracking-widest"
            />
            <Button type="submit" size="sm" disabled={busy || code.trim().length < 6}>
              <Check className="h-4 w-4" /> Verify
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStage('email')
              setMsg(null)
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </Card>
  )
}
