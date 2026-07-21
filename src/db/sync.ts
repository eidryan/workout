import { db } from './db'
import { supabase } from '@/lib/supabase'
import type {
  AppState,
  DayTemplate,
  ExerciseSlot,
  Session,
  SessionSlotLog,
  SetLog,
} from './types'

/**
 * Offline-first sync between Dexie (source of truth while you're in the gym)
 * and Supabase (shared across devices).
 *
 * Strategy: last-write-wins on `updatedAt`. Every local write stamps it; every
 * remote row carries `updated_at`. On sync we pull remote rows that are newer
 * than local, then push local rows that are newer than remote. Ids are shared
 * between both sides, so references never need remapping.
 *
 * The dataset is small (hundreds of rows), so we sync whole tables rather than
 * maintaining a change log — far fewer moving parts, and no risk of a missed
 * delta silently dropping a workout.
 */

const EPOCH = '1970-01-01T00:00:00.000Z'

const ts = (v?: string | null) => new Date(v ?? EPOCH).getTime()

/** Row shape helpers: local (camelCase) <-> remote (snake_case). */
interface TableSpec<L> {
  remote: string
  /** Primary key on the remote table (composite for session_slot_logs). */
  conflict: string
  toRemote: (row: L, userId: string) => Record<string, unknown>
  toLocal: (row: Record<string, any>) => L
  /** Local primary key, used to match rows across the two sides. */
  key: (row: L) => string
  table: () => any
}

const dayTemplates: TableSpec<DayTemplate> = {
  remote: 'day_templates',
  conflict: 'id',
  key: (r) => r.id,
  table: () => db.dayTemplates,
  toRemote: (r, user_id) => ({
    id: r.id,
    user_id,
    name: r.name,
    focus: r.focus,
    order: r.order,
    updated_at: r.updatedAt ?? new Date().toISOString(),
  }),
  toLocal: (r) => ({
    id: r.id,
    name: r.name,
    focus: r.focus ?? '',
    order: r.order,
    updatedAt: r.updated_at,
  }),
}

const exerciseSlots: TableSpec<ExerciseSlot> = {
  remote: 'exercise_slots',
  conflict: 'id',
  key: (r) => r.id,
  table: () => db.exerciseSlots,
  toRemote: (r, user_id) => ({
    id: r.id,
    user_id,
    day_template_id: r.dayTemplateId,
    order: r.order,
    name: r.name,
    scheme: r.scheme,
    target_rir: r.targetRir,
    default_weight: r.defaultWeight,
    muscle_group: r.muscleGroup,
    rest_seconds: r.restSeconds ?? null,
    alternatives: r.alternatives ?? [],
    note: r.note ?? null,
    updated_at: r.updatedAt ?? new Date().toISOString(),
  }),
  toLocal: (r) => ({
    id: r.id,
    dayTemplateId: r.day_template_id,
    order: r.order,
    name: r.name,
    scheme: r.scheme,
    targetRir: r.target_rir,
    defaultWeight: r.default_weight,
    muscleGroup: r.muscle_group,
    restSeconds: r.rest_seconds ?? undefined,
    alternatives: r.alternatives ?? [],
    note: r.note ?? undefined,
    updatedAt: r.updated_at,
  }),
}

const sessions: TableSpec<Session> = {
  remote: 'sessions',
  conflict: 'id',
  key: (r) => r.id,
  table: () => db.sessions,
  toRemote: (r, user_id) => ({
    id: r.id,
    user_id,
    day_template_id: r.dayTemplateId,
    date: r.date,
    created_at: r.createdAt,
    completed_at: r.completedAt ?? null,
    source: r.source,
    updated_at: r.updatedAt ?? r.createdAt,
  }),
  toLocal: (r) => ({
    id: r.id,
    dayTemplateId: r.day_template_id,
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    source: r.source ?? 'manual',
    updatedAt: r.updated_at,
  }),
}

const sessionSlotLogs: TableSpec<SessionSlotLog> = {
  remote: 'session_slot_logs',
  conflict: 'session_id,slot_id',
  key: (r) => `${r.sessionId}|${r.slotId}`,
  table: () => db.sessionSlotLogs,
  toRemote: (r, user_id) => ({
    session_id: r.sessionId,
    slot_id: r.slotId,
    user_id,
    performed_name: r.performedName,
    performed_weight: r.performedWeight ?? null,
    skipped: r.skipped ?? false,
    updated_at: r.updatedAt ?? new Date().toISOString(),
  }),
  toLocal: (r) => ({
    sessionId: r.session_id,
    slotId: r.slot_id,
    performedName: r.performed_name,
    performedWeight: r.performed_weight ?? undefined,
    skipped: r.skipped ?? undefined,
    updatedAt: r.updated_at,
  }),
}

const setLogs: TableSpec<SetLog> = {
  remote: 'set_logs',
  conflict: 'id',
  key: (r) => r.id,
  table: () => db.setLogs,
  toRemote: (r, user_id) => ({
    id: r.id,
    user_id,
    session_id: r.sessionId,
    slot_id: r.slotId,
    set_number: r.setNumber,
    reps: r.reps ?? null,
    rir: r.rir ?? null,
    weight: r.weight ?? null,
    skipped: r.skipped ?? false,
    logged_at: r.loggedAt ?? null,
    updated_at: r.updatedAt ?? r.loggedAt ?? new Date().toISOString(),
  }),
  toLocal: (r) => ({
    id: r.id,
    sessionId: r.session_id,
    slotId: r.slot_id,
    setNumber: r.set_number,
    reps: r.reps ?? undefined,
    rir: r.rir ?? undefined,
    weight: r.weight ?? undefined,
    skipped: r.skipped ?? undefined,
    loggedAt: r.logged_at ?? undefined,
    updatedAt: r.updated_at,
  }),
}

const SPECS = [dayTemplates, exerciseSlots, sessions, sessionSlotLogs, setLogs]

export interface SyncResult {
  pulled: number
  pushed: number
  at: string
}

/** Sync one table both directions using last-write-wins. */
async function syncTable<L>(spec: TableSpec<L>, userId: string) {
  const client = supabase!
  const [localRows, remoteRes] = await Promise.all([
    spec.table().toArray() as Promise<L[]>,
    client.from(spec.remote).select('*').eq('user_id', userId),
  ])
  if (remoteRes.error) throw new Error(`${spec.remote}: ${remoteRes.error.message}`)

  const remoteRows = (remoteRes.data ?? []) as Record<string, any>[]
  const localByKey = new Map(localRows.map((r) => [spec.key(r), r]))
  const remoteByKey = new Map(remoteRows.map((r) => [spec.key(spec.toLocal(r)), r]))

  // --- Pull: remote rows that are new or newer than local.
  const toWriteLocal: L[] = []
  for (const remote of remoteRows) {
    const asLocal = spec.toLocal(remote)
    if (remote.deleted) {
      const existing = localByKey.get(spec.key(asLocal))
      if (existing) await spec.table().delete(remote.id ?? spec.key(asLocal))
      continue
    }
    const local = localByKey.get(spec.key(asLocal))
    if (!local || ts(remote.updated_at) > ts((local as any).updatedAt)) {
      toWriteLocal.push(asLocal)
    }
  }
  if (toWriteLocal.length) await spec.table().bulkPut(toWriteLocal)

  // --- Push: local rows that are new or newer than remote.
  const toWriteRemote = localRows
    .filter((local) => {
      const remote = remoteByKey.get(spec.key(local))
      return !remote || ts((local as any).updatedAt) > ts(remote.updated_at)
    })
    .map((local) => spec.toRemote(local, userId))

  if (toWriteRemote.length) {
    const { error } = await client
      .from(spec.remote)
      .upsert(toWriteRemote, { onConflict: spec.conflict })
    if (error) throw new Error(`${spec.remote} push: ${error.message}`)
  }

  return { pulled: toWriteLocal.length, pushed: toWriteRemote.length }
}

/** Settings are a single row per user. */
async function syncAppState(userId: string) {
  const client = supabase!
  const local = (await db.appState.get('app')) as AppState | undefined
  const { data, error } = await client
    .from('app_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`app_state: ${error.message}`)

  let pulled = 0
  let pushed = 0

  if (data && (!local || ts(data.updated_at) > ts(local.updatedAt))) {
    await db.appState.put({
      id: 'app',
      lastCompletedDayOrder: data.last_completed_day_order ?? 0,
      lastSessionId: data.last_session_id ?? undefined,
      soundEnabled: data.sound_enabled ?? true,
      vibrationEnabled: data.vibration_enabled ?? true,
      globalDefaultRestSeconds: data.global_default_rest_seconds ?? 120,
      volume: data.volume ?? undefined,
      soundType: data.sound_type ?? undefined,
      vibrationType: data.vibration_type ?? undefined,
      notificationsEnabled: data.notifications_enabled ?? false,
      updatedAt: data.updated_at,
    })
    pulled = 1
  } else if (local && (!data || ts(local.updatedAt) > ts(data.updated_at))) {
    const { error: upErr } = await client.from('app_state').upsert(
      {
        user_id: userId,
        last_completed_day_order: local.lastCompletedDayOrder,
        last_session_id: local.lastSessionId ?? null,
        sound_enabled: local.soundEnabled,
        vibration_enabled: local.vibrationEnabled,
        global_default_rest_seconds: local.globalDefaultRestSeconds,
        volume: local.volume ?? null,
        sound_type: local.soundType ?? null,
        vibration_type: local.vibrationType ?? null,
        notifications_enabled: local.notificationsEnabled ?? false,
        updated_at: local.updatedAt ?? new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (upErr) throw new Error(`app_state push: ${upErr.message}`)
    pushed = 1
  }
  return { pulled, pushed }
}

/**
 * Every install seeds its own Day 1–4 with fresh random ids, so a brand-new
 * device syncing into an existing account would otherwise end up with two of
 * every day template and exercise.
 *
 * When this device has no workout history of its own (nothing to lose) but the
 * account already has a programme, adopt the account's programme wholesale
 * instead of merging. A device that *does* have history is left alone and
 * merged normally — we never discard real training data to tidy up ids.
 */
async function adoptRemoteProgrammeIfNewDevice(userId: string): Promise<void> {
  if (lastSyncAt()) return // not a first sync
  const localSessions = await db.sessions.count()
  if (localSessions > 0) return // this device has real history — merge instead

  const client = supabase!
  const [days, slots] = await Promise.all([
    client.from('day_templates').select('*').eq('user_id', userId),
    client.from('exercise_slots').select('*').eq('user_id', userId),
  ])
  if (days.error || slots.error) return
  if (!days.data?.length) return // account has no programme yet — ours will seed it

  await db.transaction('rw', [db.dayTemplates, db.exerciseSlots], async () => {
    await db.dayTemplates.clear()
    await db.exerciseSlots.clear()
    await db.dayTemplates.bulkPut(days.data.map(dayTemplates.toLocal))
    await db.exerciseSlots.bulkPut((slots.data ?? []).map(exerciseSlots.toLocal))
  })
}

let inFlight: Promise<SyncResult> | null = null

/**
 * Run a full two-way sync. Concurrent calls share one run so rapid triggers
 * (set logged + window focus + online event) can't stampede.
 */
export function syncNow(userId: string): Promise<SyncResult> {
  if (!supabase) return Promise.reject(new Error('Sync is not configured.'))
  if (inFlight) return inFlight

  inFlight = (async () => {
    let pulled = 0
    let pushed = 0

    await adoptRemoteProgrammeIfNewDevice(userId)

    // Parents before children: a set log is meaningless without its session.
    for (const spec of SPECS) {
      const r = await syncTable(spec as TableSpec<unknown>, userId)
      pulled += r.pulled
      pushed += r.pushed
    }
    const st = await syncAppState(userId)
    pulled += st.pulled
    pushed += st.pushed

    const at = new Date().toISOString()
    localStorage.setItem('lastSyncAt', at)
    return { pulled, pushed, at }
  })()

  try {
    return inFlight
  } finally {
    inFlight.finally(() => {
      inFlight = null
    })
  }
}

export function lastSyncAt(): string | null {
  return localStorage.getItem('lastSyncAt')
}

// --- Ambient trigger ------------------------------------------------------
// The db layer doesn't know who's signed in, so the auth layer parks the id
// here. That lets a write (logging a set) request a push without every caller
// having to thread the user through.

let currentUserId: string | null = null
let debounce: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function setSyncUser(userId: string | null): void {
  currentUserId = userId
}

/** Notified after any successful ambient sync, so UI can refresh its status. */
export function onSynced(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Ask for a sync soon. Debounced, so logging several sets in a row results in
 * one round trip. Silent by design — failures here are normal (no signal in
 * the gym); the data is already safe in IndexedDB and will go up next time.
 */
export function requestSync(delayMs = 3000): void {
  if (!currentUserId || !supabase) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    debounce = null
    const uid = currentUserId
    if (!uid) return
    syncNow(uid)
      .then(() => listeners.forEach((fn) => fn()))
      .catch(() => {
        /* offline or transient — retry on next trigger */
      })
  }, delayMs)
}
