import { useEffect, useState } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { supabase, isSyncConfigured } from '@/lib/supabase'

/**
 * Tracks the Supabase auth session.
 * `session` is null when signed out or when sync isn't configured.
 */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(isSyncConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    isConfigured: isSyncConfigured,
  }
}

/** Send a magic-link sign-in email. */
export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Sync is not configured on this build.' }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}
