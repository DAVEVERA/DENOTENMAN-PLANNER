import { getWeekShifts, shiftHours, getEmployees } from './scheduler'
import { validateWeek, type GuardrailWarning } from './guardrails'
import type { Shift, Employee, Location, Day } from '@/types'
import { DAYS } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'success' | 'warning' | 'danger' | 'info'

export interface InsightCard {
  id: string
  icon: string
  title: string
  message: string
  severity: InsightSeverity
  details?: Record<string, unknown>
}

export interface EmployeeLoad {
  employeeId: number
  employeeName: string
  contractHours: number
  scheduledHours: number
  delta: number // positive = over, negative = under
  utilizationPct: number
}

// ─── Weekly insights ──────────────────────────────────────────────────────────

export async function getWeeklyInsights(
  week: number, year: number, location?: Location,
): Promise<InsightCard[]> {
  const cards: InsightCard[] = []

  const [shifts, employees, guardrailWarnings] = await Promise.all([
    getWeekShifts(week, year, location),
    getEmployees(true, location),
    validateWeek(week, year, location),
  ])

  // 1. Overall staffing summary
  const workShifts = shifts.filter(s => !s.is_open)
  const openShifts = shifts.filter(s => s.is_open === 1)
  cards.push({
    id: 'staffing-summary',
    icon: '📊',
    title: 'Bezetting',
    message: `${workShifts.length} diensten ingepland bij ${employees.length} medewerkers${openShifts.length > 0 ? `, ${openShifts.length} open dienst${openShifts.length !== 1 ? 'en' : ''}` : ''}`,
    severity: openShifts.length > 0 ? 'warning' : 'success',
    details: { total: workShifts.length, open: openShifts.length, employees: employees.length },
  })

  // 2. Understaffed/overstaffed alerts from guardrails
  const staffingWarnings = guardrailWarnings.filter(w => w.type === 'understaffed' || w.type === 'overstaffed')
  for (const w of staffingWarnings.slice(0, 3)) {
    cards.push({
      id: `staffing-${w.day}-${w.details?.shiftType}`,
      icon: w.type === 'understaffed' ? '⚠️' : '📈',
      title: w.type === 'understaffed' ? 'Onderbezetting' : 'Overbezetting',
      message: w.message,
      severity: w.type === 'understaffed' ? 'danger' : 'info',
      details: w.details,
    })
  }

  // 3. Employee load balance
  const loadData = computeEmployeeLoad(shifts, employees)
  const underUtilized = loadData.filter(l => l.contractHours > 0 && l.utilizationPct < 60)
  const overUtilized = loadData.filter(l => l.contractHours > 0 && l.utilizationPct > 110)

  if (underUtilized.length > 0) {
    const names = underUtilized.slice(0, 3).map(l => l.employeeName).join(', ')
    cards.push({
      id: 'under-utilized',
      icon: '💡',
      title: 'Onderbenut',
      message: `${underUtilized.length} medewerker${underUtilized.length !== 1 ? 's' : ''} ver onder contract-uren: ${names}${underUtilized.length > 3 ? ` (+${underUtilized.length - 3})` : ''}`,
      severity: 'info',
      details: { employees: underUtilized.map(l => ({ name: l.employeeName, scheduled: l.scheduledHours, contract: l.contractHours })) },
    })
  }

  if (overUtilized.length > 0) {
    const names = overUtilized.slice(0, 3).map(l => l.employeeName).join(', ')
    cards.push({
      id: 'over-utilized',
      icon: '⚠️',
      title: 'Overbelast',
      message: `${overUtilized.length} medewerker${overUtilized.length !== 1 ? 's' : ''} boven contract-uren: ${names}${overUtilized.length > 3 ? ` (+${overUtilized.length - 3})` : ''}`,
      severity: 'warning',
      details: { employees: overUtilized.map(l => ({ name: l.employeeName, scheduled: l.scheduledHours, contract: l.contractHours })) },
    })
  }

  // 4. Days without any shifts
  const emptyDays = DAYS.filter(day => workShifts.filter(s => s.day_of_week === day).length === 0)
  if (emptyDays.length > 0 && emptyDays.length < 7) {
    cards.push({
      id: 'empty-days',
      icon: '📅',
      title: 'Lege dagen',
      message: `Geen diensten op: ${emptyDays.join(', ')}`,
      severity: 'info',
    })
  }

  return cards
}

// ─── Employee load computation ────────────────────────────────────────────────

function computeEmployeeLoad(shifts: Shift[], employees: Employee[]): EmployeeLoad[] {
  const result: EmployeeLoad[] = []

  for (const emp of employees) {
    const empShifts = shifts.filter(s => s.employee_id === emp.id && !s.is_open)
    const scheduled = empShifts.reduce((sum, s) => sum + shiftHours(s), 0)
    const contract = emp.contract_hours || 0
    const delta = scheduled - contract
    const utilPct = contract > 0 ? (scheduled / contract) * 100 : 0

    result.push({
      employeeId: emp.id,
      employeeName: emp.name,
      contractHours: contract,
      scheduledHours: Math.round(scheduled * 10) / 10,
      delta: Math.round(delta * 10) / 10,
      utilizationPct: Math.round(utilPct),
    })
  }

  return result.sort((a, b) => a.delta - b.delta)
}

// ─── Public: employee load for API ────────────────────────────────────────────

export async function getEmployeeLoadBalance(
  week: number, year: number, location?: Location,
): Promise<EmployeeLoad[]> {
  const [shifts, employees] = await Promise.all([
    getWeekShifts(week, year, location),
    getEmployees(true, location),
  ])
  return computeEmployeeLoad(shifts, employees)
}
