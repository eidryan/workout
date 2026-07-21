import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { DayTemplate, ExerciseSlot, AppState, MuscleGroup, Weight } from '@/db/types'

/** All day-templates ordered by rotation. */
export function useDayTemplates(): DayTemplate[] | undefined {
  return useLiveQuery(() => db.dayTemplates.orderBy('order').toArray(), [])
}

/** All exercise slots for a given day-template, ordered. */
export function useExerciseSlots(dayTemplateId: string | undefined): ExerciseSlot[] | undefined {
  return useLiveQuery(
    async () => {
      if (!dayTemplateId) return []
      const slots = await db.exerciseSlots.where('dayTemplateId').equals(dayTemplateId).toArray()
      return slots.sort((a, b) => a.order - b.order)
    },
    [dayTemplateId],
    [] as ExerciseSlot[],
  )
}

export function useAppState(): AppState | undefined {
  return useLiveQuery(() => db.appState.get('app'), [])
}

export async function updateAppState(patch: Partial<AppState>): Promise<void> {
  await db.appState.update('app', patch)
}

export async function updateDayTemplate(id: string, patch: Partial<DayTemplate>): Promise<void> {
  await db.dayTemplates.update(id, patch)
}

export async function updateExerciseSlot(id: string, patch: Partial<ExerciseSlot>): Promise<void> {
  await db.exerciseSlots.update(id, patch)
}

const uid = () => crypto.randomUUID()

export async function addExerciseSlot(dayTemplateId: string): Promise<string> {
  const existing = await db.exerciseSlots.where('dayTemplateId').equals(dayTemplateId).toArray()
  const order = existing.length + 1
  const id = uid()
  const slot: ExerciseSlot = {
    id,
    dayTemplateId,
    order,
    name: 'New Exercise',
    scheme: { sets: 3, repMin: 8, repMax: 12 },
    targetRir: { min: 1, max: 2 },
    defaultWeight: { value: 20, perSide: false } as Weight,
    muscleGroup: 'Chest' as MuscleGroup,
    restSeconds: 90,
    alternatives: [],
  }
  await db.exerciseSlots.put(slot)
  return id
}

export async function deleteExerciseSlot(id: string): Promise<void> {
  const slot = await db.exerciseSlots.get(id)
  if (!slot) return
  await db.exerciseSlots.delete(id)
  // Re-index the remaining slots so order stays contiguous.
  const siblings = await db.exerciseSlots
    .where('dayTemplateId')
    .equals(slot.dayTemplateId)
    .sortBy('order')
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].order !== i + 1) {
      await db.exerciseSlots.update(siblings[i].id, { order: i + 1 })
    }
  }
}

export async function moveExerciseSlot(id: string, direction: -1 | 1): Promise<void> {
  const slot = await db.exerciseSlots.get(id)
  if (!slot) return
  const siblings = await db.exerciseSlots
    .where('dayTemplateId')
    .equals(slot.dayTemplateId)
    .sortBy('order')
  const index = siblings.findIndex((s) => s.id === id)
  const swapWith = siblings[index + direction]
  if (!swapWith) return
  await db.exerciseSlots.update(slot.id, { order: swapWith.order })
  await db.exerciseSlots.update(swapWith.id, { order: slot.order })
}
