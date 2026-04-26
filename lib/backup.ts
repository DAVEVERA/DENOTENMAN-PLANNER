import { supabase, T, unwrap } from './db'
import type { Shift, Employee, LeaveRequest, TimeLog } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupData {
  version: string
  exportedAt: string
  exportedBy: string
  tables: {
    shifts: Shift[]
    employees: Employee[]
    leave_requests: LeaveRequest[]
    time_logs: TimeLog[]
  }
  meta: {
    shiftCount: number
    employeeCount: number
    leaveCount: number
    timeLogCount: number
    weekRange: { min: string; max: string } | null
  }
}

export interface BackupPreview {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: { shifts: number; employees: number; leave_requests: number; time_logs: number }
  conflicts: { existingShifts: number; existingEmployees: number }
}

// ─── Export ────────────────────────────────────────────────────────────────────

export async function exportFullBackup(performedBy: string): Promise<BackupData> {
  const [shifts, employees, leaveRequests, timeLogs] = await Promise.all([
    unwrap<Shift[]>(await supabase.from(T('shifts')).select('*').order('year').order('week_number')),
    unwrap<Employee[]>(await supabase.from(T('employees')).select('*').order('name')),
    unwrap<LeaveRequest[]>(await supabase.from(T('leave_requests')).select('*').order('created_at', { ascending: false })),
    unwrap<TimeLog[]>(await supabase.from(T('time_logs')).select('*').order('log_date', { ascending: false })),
  ])

  let weekRange: { min: string; max: string } | null = null
  if (shifts.length > 0) {
    const sorted = [...shifts].sort((a, b) => a.year - b.year || a.week_number - b.week_number)
    weekRange = {
      min: `${sorted[0].year}-W${String(sorted[0].week_number).padStart(2, '0')}`,
      max: `${sorted[sorted.length - 1].year}-W${String(sorted[sorted.length - 1].week_number).padStart(2, '0')}`,
    }
  }

  const backup: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: performedBy,
    tables: { shifts, employees, leave_requests: leaveRequests, time_logs: timeLogs },
    meta: {
      shiftCount: shifts.length, employeeCount: employees.length,
      leaveCount: leaveRequests.length, timeLogCount: timeLogs.length, weekRange,
    },
  }

  // Log
  try { await supabase.from(T('backup_log')).insert({ action: 'export', performed_by: performedBy, record_counts: backup.meta, metadata: { weekRange } }) } catch { /* non-critical */ }

  return backup
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function validateBackup(data: unknown): BackupPreview {
  const empty: BackupPreview = { valid: false, errors: [], warnings: [], stats: { shifts: 0, employees: 0, leave_requests: 0, time_logs: 0 }, conflicts: { existingShifts: 0, existingEmployees: 0 } }
  if (!data || typeof data !== 'object') { empty.errors.push('Ongeldig formaat'); return empty }
  const d = data as Record<string, unknown>
  if (!d.version) empty.errors.push('Ontbrekend versienummer')
  if (!d.tables || typeof d.tables !== 'object') { empty.errors.push('Ontbrekende "tables" sectie'); return empty }
  const t = d.tables as Record<string, unknown>
  const shifts = Array.isArray(t.shifts) ? t.shifts : []
  const emps = Array.isArray(t.employees) ? t.employees : []
  const lr = Array.isArray(t.leave_requests) ? t.leave_requests : []
  const tl = Array.isArray(t.time_logs) ? t.time_logs : []
  if (!Array.isArray(t.shifts)) empty.warnings.push('Geen diensten in backup')
  if (!Array.isArray(t.employees)) empty.warnings.push('Geen medewerkers in backup')
  empty.stats = { shifts: shifts.length, employees: emps.length, leave_requests: lr.length, time_logs: tl.length }
  empty.valid = empty.errors.length === 0
  return empty
}

// ─── Import preview ───────────────────────────────────────────────────────────

export async function getImportPreview(data: BackupData): Promise<BackupPreview> {
  const preview = validateBackup(data)
  if (!preview.valid) return preview
  const { count: sc } = await supabase.from(T('shifts')).select('id', { count: 'exact', head: true })
  const { count: ec } = await supabase.from(T('employees')).select('id', { count: 'exact', head: true })
  preview.conflicts = { existingShifts: sc ?? 0, existingEmployees: ec ?? 0 }
  if ((sc ?? 0) > 0) preview.warnings.push(`Er zijn al ${sc} diensten — worden overschreven bij "vervangen"`)
  return preview
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importBackup(
  data: BackupData, mode: 'merge' | 'replace', performedBy: string,
): Promise<{ success: boolean; imported: Record<string, number>; errors: string[] }> {
  const errors: string[] = []
  const imported: Record<string, number> = { shifts: 0, employees: 0, leave_requests: 0, time_logs: 0 }

  try {
    // Employees — upsert by name
    for (const emp of data.tables.employees ?? []) {
      const { id, ...fields } = emp as Employee & { id: number }
      const { data: ex } = await supabase.from(T('employees')).select('id').eq('name', fields.name).maybeSingle()
      if (ex) await supabase.from(T('employees')).update(fields).eq('id', ex.id)
      else await supabase.from(T('employees')).insert(fields)
      imported.employees++
    }

    // Build name→id map
    const { data: curEmps } = await supabase.from(T('employees')).select('id, name')
    const nameMap = new Map<string, number>()
    for (const e of curEmps ?? []) nameMap.set(e.name, e.id)

    // Shifts
    if (data.tables.shifts?.length) {
      if (mode === 'replace') {
        const weeks = new Set(data.tables.shifts.map((s: Shift) => `${s.year}-${s.week_number}`))
        for (const key of weeks) {
          const [yr, wk] = key.split('-').map(Number)
          await supabase.from(T('shifts')).delete().eq('week_number', wk).eq('year', yr)
        }
      }
      for (const shift of data.tables.shifts) {
        const { id, created_at, ...fields } = shift as Shift & { id: number; created_at: string }
        if (fields.employee_name && nameMap.has(fields.employee_name)) fields.employee_id = nameMap.get(fields.employee_name)!
        const { error } = await supabase.from(T('shifts')).insert(fields)
        if (!error) imported.shifts++
        else errors.push(`Shift: ${error.message}`)
      }
    }

    // Leave requests
    if (data.tables.leave_requests?.length) {
      if (mode === 'replace') await supabase.from(T('leave_requests')).delete().neq('id', 0)
      for (const lr of data.tables.leave_requests) {
        const { id, created_at, reviewed_at, ...fields } = lr as LeaveRequest & { id: number }
        if (fields.employee_name && nameMap.has(fields.employee_name)) fields.employee_id = nameMap.get(fields.employee_name)!
        const { error } = await supabase.from(T('leave_requests')).insert(fields)
        if (!error) imported.leave_requests++
      }
    }

    // Time logs
    if (data.tables.time_logs?.length) {
      if (mode === 'replace') await supabase.from(T('time_logs')).delete().neq('id', 0)
      for (const tl of data.tables.time_logs) {
        const { id, created_at, processed_at, ...fields } = tl as TimeLog & { id: number }
        if (fields.employee_name && nameMap.has(fields.employee_name)) fields.employee_id = nameMap.get(fields.employee_name)!
        const { error } = await supabase.from(T('time_logs')).insert(fields)
        if (!error) imported.time_logs++
      }
    }

    try { await supabase.from(T('backup_log')).insert({ action: 'import', performed_by: performedBy, record_counts: imported, metadata: { mode, source: data.exportedAt } }) } catch { /* non-critical */ }
  } catch (err: unknown) {
    errors.push(`Import fout: ${err instanceof Error ? err.message : 'Onbekend'}`)
  }

  return { success: errors.length === 0, imported, errors }
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function getBackupHistory() {
  try {
    const { data } = await supabase.from(T('backup_log')).select('*').order('created_at', { ascending: false }).limit(20)
    return data ?? []
  } catch { return [] }
}
