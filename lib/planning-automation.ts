import { supabase, T } from './db'
import { getWeekShifts, saveShift, fmtTime } from './scheduler'
import { validateShiftAssignment, type GuardrailWarning } from './guardrails'
import type { Shift, Location, Day } from '@/types'
import { DAYS } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CopyResult {
  copied: number
  skipped: number
  warnings: GuardrailWarning[]
  errors: string[]
}

export interface AutoFillResult {
  weeksProcessed: number
  totalCopied: number
  totalSkipped: number
  weekResults: Array<{ week: number; year: number; copied: number; skipped: number }>
  warnings: GuardrailWarning[]
  errors: string[]
}

// ─── Copy Week ────────────────────────────────────────────────────────────────

export async function copyWeek(
  sourceWeek: number, sourceYear: number,
  targetWeek: number, targetYear: number,
  location?: Location,
  overwrite = false,
  performedBy = 'admin',
): Promise<CopyResult> {
  const result: CopyResult = { copied: 0, skipped: 0, warnings: [], errors: [] }

  // Fetch source shifts
  const sourceShifts = await getWeekShifts(sourceWeek, sourceYear, location)
  if (sourceShifts.length === 0) {
    result.errors.push(`Geen diensten gevonden in week ${sourceWeek} (${sourceYear})`)
    return result
  }

  // Fetch existing target shifts
  const existingTarget = await getWeekShifts(targetWeek, targetYear, location)

  for (const src of sourceShifts) {
    // Skip open shifts
    if (src.is_open) continue

    // Check if already exists in target
    if (!overwrite) {
      const exists = existingTarget.some(t =>
        t.employee_id === src.employee_id &&
        t.day_of_week === src.day_of_week &&
        t.shift_type === src.shift_type,
      )
      if (exists) { result.skipped++; continue }
    }

    // Build new shift
    const newShift: Partial<Shift> = {
      employee_id: src.employee_id,
      employee_name: src.employee_name,
      week_number: targetWeek,
      year: targetYear,
      day_of_week: src.day_of_week,
      shift_type: src.shift_type,
      start_time: src.start_time,
      end_time: src.end_time,
      full_day: src.full_day,
      buddy: src.buddy,
      break_minutes: src.break_minutes,
      location: src.location,
      is_open: 0,
      shift_category: src.shift_category,
    }

    // Run guardrail checks
    const warns = await validateShiftAssignment(newShift)
    result.warnings.push(...warns)

    // Only block on errors, not warnings
    const hasBlocker = warns.some(w => w.severity === 'error')
    if (hasBlocker) {
      result.skipped++
      continue
    }

    // Save the shift
    const saved = await saveShift(newShift, performedBy)
    if ('error' in saved) {
      result.errors.push(`${src.employee_name} ${src.day_of_week}: ${saved.error}`)
      result.skipped++
    } else {
      result.copied++
    }
  }

  return result
}

// ─── Copy Week Preview (dry-run) ──────────────────────────────────────────────

export async function copyWeekPreview(
  sourceWeek: number, sourceYear: number,
  targetWeek: number, targetYear: number,
  location?: Location,
): Promise<{ total: number; wouldCopy: number; wouldSkip: number; warnings: GuardrailWarning[] }> {
  const sourceShifts = await getWeekShifts(sourceWeek, sourceYear, location)
  const existingTarget = await getWeekShifts(targetWeek, targetYear, location)
  const warnings: GuardrailWarning[] = []
  let wouldCopy = 0
  let wouldSkip = 0

  for (const src of sourceShifts) {
    if (src.is_open) continue
    const exists = existingTarget.some(t =>
      t.employee_id === src.employee_id &&
      t.day_of_week === src.day_of_week &&
      t.shift_type === src.shift_type,
    )
    if (exists) { wouldSkip++; continue }

    const warns = await validateShiftAssignment({
      ...src, id: undefined, week_number: targetWeek, year: targetYear,
    } as Partial<Shift>)
    warnings.push(...warns)
    wouldCopy++
  }

  return { total: sourceShifts.filter(s => !s.is_open).length, wouldCopy, wouldSkip, warnings }
}

// ─── Auto-fill ────────────────────────────────────────────────────────────────

export async function autoFill(
  sourceWeek: number, sourceYear: number,
  numberOfWeeks: number,
  location?: Location,
  overwrite = false,
  performedBy = 'admin',
): Promise<AutoFillResult> {
  const MAX_WEEKS = 12
  const weeks = Math.min(numberOfWeeks, MAX_WEEKS)

  const result: AutoFillResult = {
    weeksProcessed: 0, totalCopied: 0, totalSkipped: 0,
    weekResults: [], warnings: [], errors: [],
  }

  let tw = sourceWeek
  let ty = sourceYear

  for (let i = 0; i < weeks; i++) {
    // Advance to next week
    tw++
    if (tw > 52) { tw = 1; ty++ }

    const weekResult = await copyWeek(sourceWeek, sourceYear, tw, ty, location, overwrite, performedBy)

    result.weekResults.push({ week: tw, year: ty, copied: weekResult.copied, skipped: weekResult.skipped })
    result.totalCopied += weekResult.copied
    result.totalSkipped += weekResult.skipped
    result.warnings.push(...weekResult.warnings)
    result.errors.push(...weekResult.errors)
    result.weeksProcessed++
  }

  return result
}

// ─── Auto-fill Preview ───────────────────────────────────────────────────────

export async function autoFillPreview(
  sourceWeek: number, sourceYear: number,
  numberOfWeeks: number,
  location?: Location,
): Promise<{ total: number; weeks: Array<{ week: number; year: number; wouldCopy: number; wouldSkip: number }> }> {
  const MAX_WEEKS = 12
  const weeks = Math.min(numberOfWeeks, MAX_WEEKS)
  const result: { total: number; weeks: Array<{ week: number; year: number; wouldCopy: number; wouldSkip: number }> } = { total: 0, weeks: [] }

  let tw = sourceWeek
  let ty = sourceYear

  for (let i = 0; i < weeks; i++) {
    tw++
    if (tw > 52) { tw = 1; ty++ }

    const preview = await copyWeekPreview(sourceWeek, sourceYear, tw, ty, location)
    result.weeks.push({ week: tw, year: ty, wouldCopy: preview.wouldCopy, wouldSkip: preview.wouldSkip })
    result.total += preview.wouldCopy
  }

  return result
}
