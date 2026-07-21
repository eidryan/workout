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

/**
 * Email a 6-digit sign-in code.
 *
 * Deliberately a code rather than a clickable magic link: the code works on
 * whatever device you type it into, with no redirect-URL allowlist to keep in
 * sync across the Netlify and Vercel domains, and no risk of the link opening
 * in the wrong browser (a real problem when the PWA is installed).
 */
export async function sendLoginCode(email: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Sync is not configured on this build.' }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  return error ? { error: error.message } : {}
}

/** Exchange the emailed code for a session. */
export async function verifyLoginCode(
  email: string,
  token: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Sync is not configured on this build.' }
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}
