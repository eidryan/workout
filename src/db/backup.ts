import { db } from './db'
import type {
  AppState,
  DayTemplate,
  ExerciseSlot,
  Session,
  SessionSlotLog,
  SetLog,
} from './types'

const BACKUP_APP = 'workout-logger'
const BACKUP_VERSION = 1

interface BackupPayload {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: {
    dayTemplates: DayTemplate[]
    exerciseSlots: ExerciseSlot[]
    sessions: Session[]
    sessionSlotLogs: SessionSlotLog[]
    setLogs: SetLog[]
    appState: AppState[]
  }
}

/** Read every table into a single snapshot object. */
async function snapshot(): Promise<BackupPayload> {
  const [dayTemplates, exerciseSlots, sessions, sessionSlotLogs, setLogs, appState] =
    await Promise.all([
      db.dayTemplates.toArray(),
      db.exerciseSlots.toArray(),
      db.sessions.toArray(),
      db.sessionSlotLogs.toArray(),
      db.setLogs.toArray(),
      db.appState.toArray(),
    ])
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { dayTemplates, exerciseSlots, sessions, sessionSlotLogs, setLogs, appState },
  }
}

/** How many sets/sessions a backup holds — used to confirm before restoring. */
export function backupSummary(payload: BackupPayload): { sessions: number; sets: number } {
  return {
    sessions: payload.data.sessions.length,
    sets: payload.data.setLogs.length,
  }
}

/** Download the full local database as a JSON file. */
export async function exportData(): Promise<void> {
  const payload = await snapshot()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `workout-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Parse and validate a backup file without touching the database. */
export async function parseBackup(file: File): Promise<BackupPayload> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t valid JSON.')
  }
  const p = parsed as Partial<BackupPayload>
  if (p?.app !== BACKUP_APP || !p.data) {
    throw new Error('That doesn’t look like a workout backup.')
  }
  return p as BackupPayload
}

/**
 * Restore a backup as a FULL REPLACE: every table is cleared and repopulated
 * from the file. This is a snapshot restore (not a merge) so referential
 * integrity is preserved — the device becomes an exact mirror of the backup.
 */
export async function importData(payload: BackupPayload): Promise<void> {
  const { data } = payload
  await db.transaction(
    'rw',
    [
      db.dayTemplates,
      db.exerciseSlots,
      db.sessions,
      db.sessionSlotLogs,
      db.setLogs,
      db.appState,
    ],
    async () => {
      await Promise.all([
        db.dayTemplates.clear(),
        db.exerciseSlots.clear(),
        db.sessions.clear(),
        db.sessionSlotLogs.clear(),
        db.setLogs.clear(),
        db.appState.clear(),
      ])
      await Promise.all([
        db.dayTemplates.bulkPut(data.dayTemplates ?? []),
        db.exerciseSlots.bulkPut(data.exerciseSlots ?? []),
        db.sessions.bulkPut(data.sessions ?? []),
        db.sessionSlotLogs.bulkPut(data.sessionSlotLogs ?? []),
        db.setLogs.bulkPut(data.setLogs ?? []),
        db.appState.bulkPut(data.appState ?? []),
      ])
    },
  )
  // Keep the seed flag in sync so initDb doesn't re-seed over the restored data.
  localStorage.setItem('seeded', '1')
}
