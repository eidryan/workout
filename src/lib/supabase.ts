import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client — optional.
 *
 * The app is offline-first and fully usable with no backend configured. When
 * the env vars are absent (e.g. a local build, or before you've set up the
 * project) `supabase` is null and all sync code no-ops, leaving Dexie as the
 * single source of truth.
 */
// Accept either naming: VITE_* (manual setup) or NEXT_PUBLIC_SUPABASE_*
// (what the Vercel Supabase Marketplace integration provisions).
const env = import.meta.env
const url = (env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined
const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
  | string
  | undefined

export const isSyncConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSyncConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Magic-link callbacks arrive as URL fragments.
        detectSessionInUrl: true,
      },
    })
  : null
