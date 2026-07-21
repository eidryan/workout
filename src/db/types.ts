// Domain types for the workout logger.
// See spec v0.2 — all persistent entities stored in IndexedDB via Dexie.

export type MuscleGroup =
  | 'Legs'
  | 'Back'
  | 'Chest'
  | 'Shoulders'
  | 'Triceps'
  | 'Biceps'
  | 'Core'

export interface Weight {
  /** kilograms (per-side value when `perSide` is true) */
  value: number
  /** true = "2×N kg" (dumbbells / plate-loaded); false = single total figure */
  perSide: boolean
}

export interface DayTemplate {
  id: string
  name: string // e.g. "Day 1 — Legs"
  focus: string // e.g. "Strength + Controlled Volume"
  order: number // 1..4 — rotation order
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}

export interface ExerciseSlot {
  id: string
  dayTemplateId: string
  order: number
  name: string
  scheme: {
    sets: number
    repMin: number
    repMax: number
  }
  targetRir: {
    min: number
    max: number
  }
  defaultWeight: Weight
  muscleGroup: MuscleGroup
  /** Default rest in seconds for this exercise. */
  restSeconds?: number
  /** Substitution options shown in the swap menu. */
  alternatives: string[]
  note?: string
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}

export interface Session {
  id: string
  dayTemplateId: string
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp — set when the user taps "Finish session" */
  completedAt?: string
  source: 'manual' | 'sync'
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}

/**
 * Per-slot record within a session: what exercise was actually performed
 * (may differ from the slot's name if substituted) and a weight override
 * if the substituted exercise is loaded differently.
 */
export interface SessionSlotLog {
  sessionId: string
  slotId: string
  performedName: string
  /** Set only when a substitution changes the default weight. */
  performedWeight?: Weight
  /** true if the whole exercise was skipped (struck-through case). */
  skipped?: boolean
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}

export interface SetLog {
  id: string
  sessionId: string
  slotId: string
  setNumber: number // 1-based
  reps?: number
  rir?: number
  /** Per-set override; null/undefined = used the slot's default weight. */
  weight?: Weight
  /** true if this specific set was skipped. */
  skipped?: boolean
  /** ISO timestamp of when the set was first logged. */
  loggedAt?: string
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}

export type SoundType = 'beep' | 'chime' | 'buzz'
export type VibrationType = 'short' | 'double' | 'long'

export interface AppState {
  id: string // singleton: 'app'
  /** order of the last completed day-template (1..4) */
  lastCompletedDayOrder: number
  lastSessionId?: string
  soundEnabled: boolean
  vibrationEnabled: boolean
  globalDefaultRestSeconds: number
  /** 0..1 playback volume for the rest-end sound. Defaults to 0.3 if unset. */
  volume?: number
  /** Which sound to play when rest ends. Defaults to 'beep'. */
  soundType?: SoundType
  /** Vibration pattern when rest ends. Defaults to 'double'. */
  vibrationType?: VibrationType
  /** Fire a lock-screen notification when rest ends while backgrounded. */
  notificationsEnabled?: boolean
  /** ISO timestamp of the last local modification (drives sync LWW). */
  updatedAt?: string
}
