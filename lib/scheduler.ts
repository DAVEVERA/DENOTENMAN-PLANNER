import { supabase, T, unwrap } from './db'
import type { Shift, Employee, Location } from '@/types'
import { DAYS } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_ORDER: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]))

function sortByDay(shifts: Shift[]): Shift[] {
  return [...shifts].sort(
    (a, b) =>
      (DAY_ORDER[a.day_of_week] ?? 9) - (DAY_ORDER[b.day_of_week] ?? 9) ||
      (a.employee_name ?? '').localeCompare(b.employee_name ?? ''),
  )
}

export function fmtTime(t: unknown): string | null {
  if (!t) return null
  const s = String(t).slice(0, 8)
  return s.length === 5 ? s + ':00' : s
}

export function shiftHours(s: Pick<Shift, 'full_day' | 'start_time' | 'end_time' | 'break_minutes'>): number {
  if (s.full_day) return 8
  if (s.start_time && s.end_time) {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const rawMin = eh * 60 + em - (sh * 60 + sm)
    const netMin = rawMin - (s.break_minutes ?? 0)
    return Math.max(0, netMin / 60)
  }
  return 0
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getWeekShifts(
  week: number, year: number, location?: Location,
): Promise<Shift[]> {
  try {
    let q = supabase.from(T('shifts')).select('*').eq('week_number', week).eq('year', year)
    if (location && location !== 'both') q = q.eq('location', location)
    const { data, error } = await q
    if (error) throw error
    return sortByDay(data ?? [])
  } catch (err: any) {
    if (err.message?.includes('location')) {
      // Fallback: retry without location filter
      const { data, error } = await supabase.from(T('shifts')).select('*').eq('week_number', week).eq('year', year)
      if (error) throw error
      return sortByDay(data ?? [])
    }
    throw err
  }
}

export async function getEmployeeShifts(
  employeeId: number, week?: number, year?: number,
): Promise<Shift[]> {
  let q = supabase.from(T('shifts')).select('*').eq('employee_id', employeeId)
  if (week && year) q = q.eq('week_number', week).eq('year', year)
  const { data, error } = await q.order('year', { ascending: false }).order('week_number', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getShift(id: number): Promise<Shift | null> {
  const { data } = await supabase.from(T('shifts')).select('*').eq('id', id).maybeSingle()
  return data ?? null
}

async function hasConflict(data: Partial<Shift>, excludeId?: number): Promise<boolean> {
  if (data.full_day || !data.employee_id) return false
  const st = fmtTime(data.start_time) ?? '00:00:00'
  const et = fmtTime(data.end_time)   ?? '23:59:59'

  let q = supabase
    .from(T('shifts'))
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', data.employee_id)
    .eq('week_number', data.week_number!)
    .eq('year', data.year!)
    .eq('day_of_week', data.day_of_week!)
    .eq('full_day', 0)
    .lt('start_time', et)
    .gt('end_time', st)

  if (excludeId) q = q.neq('id', excludeId)
  const { count } = await q
  return (count ?? 0) > 0
}

export async function saveShift(
  data: Partial<Shift>, createdBy = '',
): Promise<Shift | { error: string }> {
  if (data.employee_id && await hasConflict(data, data.id))
    return { error: 'Er is al een dienst gepland op dit tijdstip' }

  const st = fmtTime(data.start_time)
  const et = fmtTime(data.end_time)
  if (!data.full_day && st && et && st >= et)
    return { error: 'Eindtijd moet na starttijd zijn' }

  // AM-006: maximale shiftduur 15,5 uur
  const MAX_SHIFT_HOURS = 15.5
  if (!data.full_day && st && et) {
    const [sh, sm] = st.split(':').map(Number)
    const [eh, em] = et.split(':').map(Number)
    const durationH = (eh * 60 + em - (sh * 60 + sm)) / 60
    if (durationH > MAX_SHIFT_HOURS)
      return { error: `Maximale shiftduur is ${MAX_SHIFT_HOURS} uur` }
  }

  const fields = {
    employee_id:         data.employee_id   ?? null,
    employee_name:       data.employee_name ?? '',
    week_number:         data.week_number,
    year:                data.year,
    day_of_week:         data.day_of_week,
    shift_type:          data.shift_type,
    start_time:          st ?? null,
    end_time:            et ?? null,
    full_day:            data.full_day       ?? 0,
    buddy:               data.buddy          ?? null,
    note:                data.note           ?? null,
    admin_note:          data.admin_note     ?? null,    // AM-002
    break_minutes:       data.break_minutes  ?? 0,       // AM-004
    location:            data.location       ?? 'markt',
    is_open:             data.is_open        ?? 0,
    open_invite_emp_id:  data.open_invite_emp_id  ?? null,
    open_invite_status:  data.open_invite_status  ?? null,
    shift_category:      data.shift_category ?? 'regular',
  }

  if (data.id) {
    const { data: updated, error } = await supabase
      .from(T('shifts')).update(fields).eq('id', data.id).select().single()
    if (error) return { error: error.message }
    return updated
  }

  const { data: inserted, error } = await supabase
    .from(T('shifts')).insert({ ...fields, created_by: createdBy }).select().single()
  if (error) return { error: error.message }
  return inserted
}

export async function deleteShift(id: number): Promise<boolean> {
  const { error } = await supabase.from(T('shifts')).delete().eq('id', id)
  return !error
}

export async function clearWeekShifts(week: number, year: number): Promise<number> {
  const { count, error } = await supabase
    .from(T('shifts')).delete({ count: 'exact' }).eq('week_number', week).eq('year', year)
  if (error) throw error
  return count ?? 0
}

export async function bulkUpdateShift(id: number, data: Partial<Shift>): Promise<boolean> {
  const { error } = await supabase.from(T('shifts')).update(data).eq('id', id)
  return !error
}

// ─── Open shifts ──────────────────────────────────────────────────────────────

export async function getOpenShifts(location?: Location): Promise<Shift[]> {
  let q = supabase.from(T('shifts')).select('*').eq('is_open', 1)
  if (location && location !== 'both') q = q.eq('location', location)
  const { data, error } = await q.order('year').order('week_number').order('day_of_week')
  if (error) throw error
  return data ?? []
}

/**
 * Update an open shift's properties (admin only).
 * Only updates the fields that are provided.
 */
export async function updateOpenShift(
  shiftId: number,
  fields: Partial<Pick<Shift, 'day_of_week' | 'week_number' | 'year' | 'shift_type' | 'start_time' | 'end_time' | 'location' | 'note'>>,
): Promise<Shift | { error: string }> {
  const update: Record<string, unknown> = {}
  if (fields.day_of_week !== undefined)  update.day_of_week = fields.day_of_week
  if (fields.week_number !== undefined)  update.week_number = fields.week_number
  if (fields.year !== undefined)         update.year        = fields.year
  if (fields.shift_type !== undefined)   update.shift_type  = fields.shift_type
  if (fields.start_time !== undefined)   update.start_time  = fmtTime(fields.start_time)
  if (fields.end_time !== undefined)     update.end_time    = fmtTime(fields.end_time)
  if (fields.location !== undefined)     update.location    = fields.location
  if (fields.note !== undefined)         update.note        = fields.note

  const { data, error } = await supabase
    .from(T('shifts'))
    .update(update)
    .eq('id', shiftId)
    .eq('is_open', 1)
    .select()
    .single()
  if (error) return { error: error.message }
  return data
}

/**
 * Withdraw (intrekken) an open shift — sets is_open = 0 and clears invite state.
 * If the shift had no employee_id (admin-created), delete it instead.
 */
export async function withdrawOpenShift(shiftId: number): Promise<boolean> {
  const shift = await getShift(shiftId)
  if (!shift) return false

  // Admin-created open shifts (no employee) → delete entirely
  if (!shift.employee_id) {
    return deleteShift(shiftId)
  }

  // Employee-offered shifts → revert to regular
  const { error } = await supabase.from(T('shifts')).update({
    is_open: 0,
    open_invite_emp_id: null,
    open_invite_status: null,
    shift_category: 'regular',
  }).eq('id', shiftId)
  return !error
}

/**
 * After a claim is approved, check if there are remaining open shifts
 * for the same day/week/year and close them if they should be auto-closed.
 * The logic: count how many open shifts remain for that slot.
 * If maxOpen is provided (e.g. 1), close when filled.
 */
export async function closeRemainingOpenShifts(
  day: string, weekNumber: number, year: number, shiftType: string,
): Promise<number> {
  // Find remaining open shifts that match the same day/week/year/type
  const { data: remaining, error } = await supabase
    .from(T('shifts'))
    .select('id')
    .eq('is_open', 1)
    .eq('day_of_week', day)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .eq('shift_type', shiftType)
    .is('employee_id', null) // only admin-created open shifts

  if (error || !remaining || remaining.length === 0) return 0

  // Close all remaining duplicates for this slot
  const ids = remaining.map(r => r.id)
  const { error: closeErr } = await supabase
    .from(T('shifts'))
    .update({
      is_open: 0,
      open_invite_status: 'accepted',
      note: (new Date().toLocaleDateString('nl-NL')) + ' — automatisch gesloten (alle plekken gevuld)',
    })
    .in('id', ids)

  if (closeErr) {
    console.error('[scheduler] closeRemainingOpenShifts error:', closeErr.message)
    return 0
  }
  return ids.length
}

export async function inviteEmployeeToShift(
  shiftId: number, employeeId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from(T('shifts'))
    .update({ open_invite_emp_id: employeeId, open_invite_status: 'pending' })
    .eq('id', shiftId)
  return !error
}

export async function respondToInvitation(
  shiftId: number, response: 'accepted' | 'declined',
): Promise<boolean> {
  const update: Partial<Shift> =
    response === 'accepted'
      ? { open_invite_status: 'accepted', is_open: 0 }
      : { open_invite_status: 'declined', open_invite_emp_id: null }
  const { error } = await supabase.from(T('shifts')).update(update).eq('id', shiftId)
  return !error
}

// ─── Employees ────────────────────────────────────────────────────────────────

export async function getEmployees(
  activeOnly = true, location?: Location,
): Promise<Employee[]> {
  try {
    let q = supabase.from(T('employees')).select('*').order('name')
    if (activeOnly) q = q.eq('is_active', 1)
    if (location && location !== 'both') q = q.or(`location.eq.${location},location.eq.both`)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  } catch (err: any) {
    if (err.message?.includes('location')) {
      let q = supabase.from(T('employees')).select('*').order('name')
      if (activeOnly) q = q.eq('is_active', 1)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    }
    throw err
  }
}

export async function getEmployee(id: number): Promise<Employee | null> {
  const { data } = await supabase.from(T('employees')).select('*').eq('id', id).maybeSingle()
  return data ?? null
}

// ─── Occupancy ────────────────────────────────────────────────────────────────

export async function getOccupancy(
  week: number, year: number, location?: Location,
): Promise<Record<string, { ochtend: number; middag: number; avond: number; total: number }>> {
  const shifts = await getWeekShifts(week, year, location)
  const result: Record<string, { ochtend: number; middag: number; avond: number; total: number }> = {}
  for (const day of DAYS) result[day] = { ochtend: 0, middag: 0, avond: 0, total: 0 }
  for (const s of shifts) {
    if (!result[s.day_of_week]) continue
    const type = s.shift_type.toLowerCase()
    if (type === 'ochtend') result[s.day_of_week].ochtend++
    else if (type === 'middag') result[s.day_of_week].middag++
    else if (type === 'avond') result[s.day_of_week].avond++
    result[s.day_of_week].total++
  }
  return result
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function currentWeekYear(): { week: number; year: number } {
  const now = new Date()
  return { week: getISOWeek(now), year: now.getFullYear() }
}

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}
