import type { OpenShiftReminderStage, Shift } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000
export const OPEN_SHIFT_FIRST_REMINDER_DAYS = 10.5
export const OPEN_SHIFT_SECOND_REMINDER_DAYS = 14

export function getOpenShiftAgeDays(
  shift: Pick<Shift, 'opened_at' | 'created_at'>,
  now = new Date(),
): number {
  const openedAt = new Date(shift.opened_at ?? shift.created_at).getTime()
  if (!Number.isFinite(openedAt)) return 0
  return Math.max(0, (now.getTime() - openedAt) / DAY_MS)
}

export function getOpenShiftReminderStage(
  shift: Pick<Shift, 'opened_at' | 'created_at'>,
  now = new Date(),
): OpenShiftReminderStage | null {
  const ageDays = getOpenShiftAgeDays(shift, now)
  if (ageDays >= OPEN_SHIFT_SECOND_REMINDER_DAYS) return 'two_weeks'
  if (ageDays >= OPEN_SHIFT_FIRST_REMINDER_DAYS) return 'one_and_half_weeks'
  return null
}

export function getOpenShiftReminderText(stage: OpenShiftReminderStage): string {
  return stage === 'two_weeks'
    ? 'Deze dienst staat al 2 weken open. Wil het team nogmaals nagaan wie hem kan oppakken?'
    : 'Deze dienst staat al ruim 1,5 week open. Wil het team nogmaals nagaan wie hem kan oppakken?'
}
