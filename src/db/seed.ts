import { db } from './db'
import type { AppState, DayTemplate, ExerciseSlot, MuscleGroup, Weight } from './types'

/**
 * First-launch seed. Populates the 4 day-templates and all exercise slots
 * transcribed from the user's training logs (Spec v0.2).
 *
 * Idempotency is handled by the SEED_FLAG_KEY in db.ts — this runs once,
 * ever, per device.
 */

const uid = () => crypto.randomUUID()

function w(value: number, perSide = false): Weight {
  return { value, perSide }
}

interface SlotSeed {
  name: string
  scheme: { sets: number; repMin: number; repMax: number }
  targetRir: { min: number; max: number }
  defaultWeight: Weight
  muscleGroup: MuscleGroup
  restSeconds?: number
  alternatives?: string[]
  note?: string
}

interface DaySeed {
  name: string
  focus: string
  order: number
  slots: SlotSeed[]
}

const DAYS: DaySeed[] = [
  {
    name: 'Day 1 — Legs',
    focus: 'Strength + Controlled Volume',
    order: 1,
    slots: [
      {
        name: 'Barbell Back Squat',
        scheme: { sets: 4, repMin: 5, repMax: 8 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(60),
        muscleGroup: 'Legs',
        restSeconds: 180,
      },
      {
        name: 'Romanian Deadlift',
        scheme: { sets: 3, repMin: 6, repMax: 10 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(60),
        muscleGroup: 'Legs',
        restSeconds: 150,
      },
      {
        name: 'Leg Press',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(120),
        muscleGroup: 'Legs',
        restSeconds: 120,
      },
      {
        name: 'Lying Leg Curl',
        scheme: { sets: 3, repMin: 8, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(35),
        muscleGroup: 'Legs',
        restSeconds: 90,
      },
      {
        name: 'Standing Calf Raise Machine',
        scheme: { sets: 4, repMin: 12, repMax: 15 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(15, true),
        muscleGroup: 'Legs',
        restSeconds: 60,
      },
    ],
  },
  {
    name: 'Day 2 — Pull',
    focus: 'Back + Biceps Focus',
    order: 2,
    slots: [
      {
        name: 'Heavy Chest-Supported T-Bar Row',
        scheme: { sets: 4, repMin: 5, repMax: 8 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(30, true),
        muscleGroup: 'Back',
        restSeconds: 180,
        alternatives: ['Machine Row'],
      },
      {
        name: 'Lat Pulldown — Wide Grip',
        scheme: { sets: 4, repMin: 6, repMax: 10 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(35),
        muscleGroup: 'Back',
        restSeconds: 120,
      },
      {
        name: 'Lat Pulldown — Close Grip, Triangle',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(30),
        muscleGroup: 'Back',
        restSeconds: 90,
      },
      {
        name: 'Face Pulls',
        scheme: { sets: 3, repMin: 12, repMax: 15 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(20),
        muscleGroup: 'Shoulders',
        restSeconds: 60,
        alternatives: ['Rear Delt Flyes'],
      },
      {
        name: 'EZ-Bar Curl',
        scheme: { sets: 4, repMin: 6, repMax: 10 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(20),
        muscleGroup: 'Biceps',
        restSeconds: 90,
      },
      {
        name: 'Scott Curl',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(5),
        muscleGroup: 'Biceps',
        restSeconds: 60,
      },
    ],
  },
  {
    name: 'Day 3 — Push A',
    focus: 'Heavy Bench Focus',
    order: 3,
    slots: [
      {
        name: 'Bench Press',
        scheme: { sets: 5, repMin: 3, repMax: 5 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(50),
        muscleGroup: 'Chest',
        restSeconds: 180,
      },
      {
        name: 'Close-Grip Bench Press',
        scheme: { sets: 3, repMin: 6, repMax: 8 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(40),
        muscleGroup: 'Triceps',
        restSeconds: 150,
      },
      {
        name: 'Machine Shoulder Press',
        scheme: { sets: 3, repMin: 5, repMax: 8 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(30),
        muscleGroup: 'Shoulders',
        restSeconds: 120,
      },
      {
        name: 'Cable Crossovers',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(48),
        muscleGroup: 'Chest',
        restSeconds: 90,
        alternatives: ['Pec Deck'],
      },
      {
        name: 'Dumbbell Lateral Raises',
        scheme: { sets: 3, repMin: 12, repMax: 15 },
        targetRir: { min: 2, max: 2 },
        defaultWeight: w(10, true),
        muscleGroup: 'Shoulders',
        restSeconds: 60,
      },
      {
        name: 'Seated Dip',
        scheme: { sets: 3, repMin: 8, repMax: 12 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(20, true),
        muscleGroup: 'Triceps',
        restSeconds: 90,
      },
      {
        name: 'Cable Triceps Pushdown',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(17.5),
        muscleGroup: 'Triceps',
        restSeconds: 60,
      },
    ],
  },
  {
    name: 'Day 4 — Push B / Upper Volume',
    focus: 'Volume Bench + Arms + Back',
    order: 4,
    slots: [
      {
        name: 'Bench Press',
        scheme: { sets: 4, repMin: 6, repMax: 8 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(40),
        muscleGroup: 'Chest',
        restSeconds: 150,
      },
      {
        name: 'Seated Cable Rows — Neutral Grip',
        scheme: { sets: 3, repMin: 8, repMax: 10 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(40),
        muscleGroup: 'Back',
        restSeconds: 90,
      },
      {
        name: 'Incline Dumbbell Press',
        scheme: { sets: 3, repMin: 8, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(10, true),
        muscleGroup: 'Chest',
        restSeconds: 90,
      },
      {
        name: 'Straight-Arm Lat Pulldowns',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 1, max: 2 },
        defaultWeight: w(35),
        muscleGroup: 'Back',
        restSeconds: 90,
      },
      {
        name: 'Seated Dips',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(20, true),
        muscleGroup: 'Triceps',
        restSeconds: 90,
      },
      {
        name: 'Overhead Cable Triceps Extension',
        scheme: { sets: 3, repMin: 10, repMax: 12 },
        targetRir: { min: 0, max: 1 },
        defaultWeight: w(12),
        muscleGroup: 'Triceps',
        restSeconds: 60,
      },
      {
        name: 'Dumbbell Lateral Raises',
        scheme: { sets: 3, repMin: 12, repMax: 15 },
        targetRir: { min: 2, max: 2 },
        defaultWeight: w(10, true),
        muscleGroup: 'Shoulders',
        restSeconds: 60,
      },
    ],
  },
]

export async function seedDatabase(): Promise<void> {
  const appState: AppState = {
    id: 'app',
    lastCompletedDayOrder: 0, // next day = order 1
    soundEnabled: true,
    vibrationEnabled: true,
    globalDefaultRestSeconds: 120,
    volume: 0.3,
    soundType: 'beep',
    vibrationType: 'double',
    notificationsEnabled: false,
  }

  await db.transaction('rw', db.dayTemplates, db.exerciseSlots, db.appState, async () => {
    // Wipe any partial data first so seeding is safe to re-run during dev.
    await db.dayTemplates.clear()
    await db.exerciseSlots.clear()
    await db.appState.clear()

    for (const day of DAYS) {
      const dayTemplate: DayTemplate = {
        id: uid(),
        name: day.name,
        focus: day.focus,
        order: day.order,
      }
      await db.dayTemplates.put(dayTemplate)

      for (let index = 0; index < day.slots.length; index++) {
        const slot = day.slots[index]
        const exerciseSlot: ExerciseSlot = {
          id: uid(),
          dayTemplateId: dayTemplate.id,
          order: index + 1,
          name: slot.name,
          scheme: slot.scheme,
          targetRir: slot.targetRir,
          defaultWeight: slot.defaultWeight,
          muscleGroup: slot.muscleGroup,
          restSeconds: slot.restSeconds,
          alternatives: slot.alternatives ?? [],
          note: slot.note,
        }
        await db.exerciseSlots.put(exerciseSlot)
      }
    }

    await db.appState.put(appState)
  })
}
