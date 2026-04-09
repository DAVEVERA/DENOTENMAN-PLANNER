import { supabase, T, unwrap } from './db'
import type { TimeLog, Location, HoursSummary } from '@/types'
import { calcHoursWorked } from './dateUtils'

export async function logHours(
  data: Omit<TimeLog, 'id' | 'created_at'>, createdBy = '',
): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs'))
    .insert({ ...data, created_by: createdBy })
    .select()
    .single())
}

export async function getTimeLogs(opts: {
  employee_id?: number
  from?: string
  to?: string
  location?: Location
  is_processed?: number
}): Promise<TimeLog[]> {
  let q = supabase.from(T('time_logs')).select('*').order('log_date', { ascending: false })
  if (opts.employee_id) q = q.eq('employee_id', opts.employee_id)
  if (opts.from) q = q.gte('log_date', opts.from)
  if (opts.to) q = q.lte('log_date', opts.to)
  if (opts.location && opts.location !== 'both') q = q.eq('location', opts.location)
  if (opts.is_processed !== undefined) q = q.eq('is_processed', opts.is_processed)
  return unwrap<TimeLog[]>(await q)
}

export async function updateTimeLog(id: number, data: Partial<TimeLog>): Promise<TimeLog> {
  return unwrap<TimeLog>(await supabase
    .from(T('time_logs')).update(data).eq('id', id).select().single())
}

export async function deleteTimeLog(id: number): Promise<boolean> {
  const { error } = await supabase.from(T('time_logs')).delete().eq('id', id)
  return !error
}

export async function markLogsProcessed(ids: number[]): Promise<void> {
  unwrap(await supabase
    .from(T('time_logs'))
    .update({ is_processed: 1, processed_at: new Date().toISOString() })
    .in('id', ids))
}

export async function getHoursSummary(
  from: string, to: string, location?: Location,
): Promise<HoursSummary[]> {
  const logs = await getTimeLogs({ from, to, location })

  const byEmp = new Map<number, { name: string; contract: number; logged: number; overtime: number }>()

  for (const log of logs) {
    const hours = calcHoursWorked(log.clock_in, log.clock_out, log.break_minutes)
    const existing = byEmp.get(log.employee_id)
    if (existing) {
      existing.logged   += hours
      existing.overtime += log.overtime_hours
    } else {
      byEmp.set(log.employee_id, {
        name:     log.employee_name,
        contract: 0,
        logged:   hours,
        overtime: log.overtime_hours,
      })
    }
  }

  return Array.from(byEmp.entries()).map(([id, v]) => ({
    employee_id:    id,
    employee_name:  v.name,
    contract_hours: v.contract,
    logged_hours:   Math.round(v.logged * 100) / 100,
    overtime_hours: Math.round(v.overtime * 100) / 100,
  }))
}
