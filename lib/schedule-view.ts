import type { Location, Shift } from '@/types'

export const SCHEDULE_LOCATIONS: readonly Location[] = ['both', 'markt', 'nootmagazijn']

export function isScheduleLocation(value: string): value is Location {
  return SCHEDULE_LOCATIONS.includes(value as Location)
}

type PlannedShiftIdentity = Pick<
  Shift,
  'employee_id' | 'day_of_week' | 'shift_type' | 'start_time' | 'end_time' | 'full_day' | 'location'
>

/** Exact identity used when a week is copied, including the physical location. */
export function isSamePlannedShift(left: PlannedShiftIdentity, right: PlannedShiftIdentity): boolean {
  return left.employee_id === right.employee_id
    && left.day_of_week === right.day_of_week
    && left.shift_type === right.shift_type
    && (left.start_time ?? '') === (right.start_time ?? '')
    && (left.end_time ?? '') === (right.end_time ?? '')
    && Boolean(left.full_day) === Boolean(right.full_day)
    && left.location === right.location
}
