import type { SessionUser, Shift } from '@/types'

/**
 * Private open-shift notes are only returned to their employee author and users
 * with a manager/admin role. Filtering here keeps the authorization boundary in
 * the API instead of relying on hidden UI elements.
 */
export function filterShiftForUser(shift: Shift, user: SessionUser): Shift {
  if (user.role === 'admin' || user.role === 'manager') return shift

  const ownsOpenNote = Boolean(
    user.employee_id && shift.open_note_author_employee_id === user.employee_id,
  )

  return {
    ...shift,
    admin_note: null,
    open_note: ownsOpenNote ? shift.open_note : null,
    open_note_author_employee_id: ownsOpenNote ? shift.open_note_author_employee_id : null,
  }
}

export function filterShiftsForUser(shifts: Shift[], user: SessionUser): Shift[] {
  return shifts.map(shift => filterShiftForUser(shift, user))
}
