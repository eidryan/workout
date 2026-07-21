import Dexie, { type Table } from 'dexie'
import type {
  DayTemplate,
  ExerciseSlot,
  Session,
  SetLog,
  SessionSlotLog,
  AppState,
} from './types'

export class WorkoutDB extends Dexie {
  dayTemplates!: Table<DayTemplate, string>
  exerciseSlots!: Table<ExerciseSlot, string>
  sessions!: Table<Session, string>
  sessionSlotLogs!: Table<SessionSlotLog, string>
  setLogs!: Table<SetLog, string>
  appState!: Table<AppState, string>

  constructor() {
    super('workout-logger')
    this.version(1).stores({
      // Indexed fields only; full objects are stored.
      dayTemplates: 'id, order',
      exerciseSlots: 'id, dayTemplateId, order',
      sessions: 'id, dayTemplateId, date, createdAt',
      sessionSlotLogs: 'sessionId, slotId, [sessionId+slotId]',
      setLogs: 'id, sessionId, [sessionId+slotId], setNumber',
      appState: 'id',
    })
  }
}

export const db = new WorkoutDB()

const SEED_FLAG_KEY = 'seeded'

/**
 * Initialize the database. On first launch, populates the 4 day-templates
 * and all exercise slots from the user's training logs.
 *
 * Full seed lives in `./seed.ts` (Phase 2).
 */
export async function initDb(): Promise<void> {
  // Ask the browser not to evict our IndexedDB under storage pressure. This is
  // the only local copy of the user's training log until cloud sync exists.
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // best effort — not supported everywhere
  }

  // Trust the actual DB, not just the localStorage flag: the two can desync
  // (IndexedDB eviction under storage pressure, partial site-data clears),
  // which would otherwise leave the app stuck on an empty "Loading…" forever.
  const seeded = localStorage.getItem(SEED_FLAG_KEY)
  const count = await db.dayTemplates.count()
  if (seeded && count > 0) return
  const { seedDatabase } = await import('./seed')
  await seedDatabase()
  localStorage.setItem(SEED_FLAG_KEY, '1')
}
