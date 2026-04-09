import { supabase, T, unwrap } from './db'
import { saveShift, getISOWeek } from './scheduler'
import type { LeaveRequest, Day } from '@/types'
import { DAYS } from '@/types'

export async function submitLeaveRequest(data: Omit<LeaveRequest, 'id' | 'status' | 'reviewed_by' | 'reviewed_at' | 'created_at'>): Promise<LeaveRequest> {
  return unwrap<LeaveRequest>(await supabase
    .from(T('leave_requests'))
    .insert({ ...data, status: 'pending' })
    .select()
    .single())
}

export async function getLeaveRequests(opts?: {
  status?: string
  employee_id?: number
  from?: string
  to?: string
}): Promise<LeaveRequest[]> {
  let q = supabase.from(T('leave_requests')).select('*').order('created_at', { ascending: false })
  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.employee_id) q = q.eq('employee_id', opts.employee_id)
  if (opts?.from) q = q.gte('start_date', opts.from)
  if (opts?.to) q = q.lte('end_date', opts.to)
  return unwrap<LeaveRequest[]>(await q)
}

export async function reviewLeaveRequest(
  id: number, decision: 'approved' | 'rejected', reviewedBy: string,
): Promise<LeaveRequest> {
  const row = unwrap<LeaveRequest>(await supabase
    .from(T('leave_requests'))
    .update({ status: decision, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single())

  if (decision === 'approved') {
    // Auto-create shift rows for each day in the date range
    const start = new Date(row.start_date)
    const end   = new Date(row.end_date)
    const cursor = new Date(start)
    while (cursor <= end) {
      const dow = cursor.toLocaleDateString('nl-NL', { weekday: 'long' }) as Day
      if (DAYS.includes(dow as typeof DAYS[number])) {
        const week = getISOWeek(cursor)
        const year = cursor.getFullYear()
        await saveShift({
          employee_id:   row.employee_id,
          employee_name: row.employee_name,
          week_number:   week,
          year,
          day_of_week:   dow,
          shift_type:    row.leave_type,
          full_day:      1,
          location:      'markt',     // default; admin can change afterwards
          shift_category: 'regular',
        }, reviewedBy)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return row
}
