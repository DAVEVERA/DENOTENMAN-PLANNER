import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { getEmployee, getShift } from '@/lib/scheduler'
import { calcHoursWorked } from '@/lib/dateUtils'
import { getPlannedShiftHours, isShiftReadyForHourConfirmation } from '@/lib/shift-hours'
import { HourSubmissionConflictError, submitEmployeeShiftHours } from '@/lib/hours'
import { sendHourSubmissionAlertEmail } from '@/lib/email'
import type { HourConfirmationMode } from '@/types'
import { WORK_TYPES } from '@/types'

type HourSubmissionFailure = {
  status: 500 | 503
  body: {
    success: false
    code: 'HOURS_SCHEMA_UNAVAILABLE' | 'HOURS_SUBMISSION_FAILED'
    message: string
    retryable: boolean
  }
}

export function hourSubmissionConflictResponse(err: HourSubmissionConflictError) {
  const code = err.isSameSubmission ? 'HOURS_ALREADY_SUBMITTED' : 'HOURS_SUBMISSION_CONFLICT'
  const message = err.isSameSubmission
    ? err.message
    : 'Voor deze dienst zijn al uren opgeslagen. Je nieuwe aanpassing is niet opgeslagen; vernieuw je rooster.'
  return {
    status: 409 as const,
    body: {
      success: false as const,
      code,
      message,
      data: err.existingLog,
    },
  }
}

export function hourSubmissionFailure(err: unknown): HourSubmissionFailure {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : ''

  if (code === 'PGRST204' || code === '42703') {
    return {
      status: 503,
      body: {
        success: false,
        code: 'HOURS_SCHEMA_UNAVAILABLE',
        message: 'Uren opslaan is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
        retryable: true,
      },
    }
  }

  return {
    status: 500,
    body: {
      success: false,
      code: 'HOURS_SUBMISSION_FAILED',
      message: 'Uren opslaan is niet gelukt. Probeer het opnieuw.',
      retryable: false,
    },
  }
}

function cleanTime(value: unknown): string | null {
  const text = String(value ?? '').slice(0, 5)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res)
    if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })
    if (!can(session.user, 'view_own')) return res.status(403).json({ success: false, message: 'Toegang geweigerd' })
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Methode niet toegestaan' })

    const employeeId = session.user.employee_id
    if (!employeeId) return res.status(400).json({ success: false, message: 'Geen medewerker gekoppeld aan dit account' })

    const shiftId = Number(req.body?.shift_id)
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return res.status(400).json({ success: false, message: 'Ongeldige dienst' })
    }

    const shift = await getShift(shiftId)
    if (!shift || shift.employee_id !== employeeId) {
      return res.status(404).json({ success: false, message: 'Dienst niet gevonden in jouw rooster' })
    }
    if (shift.is_open === 1 || !WORK_TYPES.includes(shift.shift_type)) {
      return res.status(400).json({ success: false, message: 'Voor deze dienst kunnen geen uren worden ingediend' })
    }
    if (!isShiftReadyForHourConfirmation(shift)) {
      return res.status(409).json({ success: false, message: 'Je kunt de uren indienen zodra deze dienst is afgelopen' })
    }

    const mode = req.body?.confirmation_mode as HourConfirmationMode
    if (mode !== 'confirmed' && mode !== 'adjusted') {
      return res.status(400).json({ success: false, message: 'Geef aan of de geplande uren kloppen of zijn aangepast' })
    }

    const planned = getPlannedShiftHours(shift)
    const clockIn = mode === 'confirmed' ? planned.clock_in : cleanTime(req.body?.clock_in)
    const clockOut = mode === 'confirmed' ? planned.clock_out : cleanTime(req.body?.clock_out)
    const breakMinutes = mode === 'confirmed'
      ? planned.break_minutes
      : Number(req.body?.break_minutes)

    if (!clockIn || !clockOut) {
      return res.status(400).json({
        success: false,
        message: mode === 'confirmed'
          ? 'De geplande tijden zijn niet volledig. Kies uren aanpassen.'
          : 'Vul een geldige begin- en eindtijd in.',
      })
    }
    if (clockOut <= clockIn) {
      return res.status(400).json({ success: false, message: 'De eindtijd moet na de begintijd liggen' })
    }
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 480) {
      return res.status(400).json({ success: false, message: 'Pauze moet tussen 0 en 480 minuten liggen' })
    }

    const workedHours = calcHoursWorked(clockIn, clockOut, breakMinutes)
    if (workedHours <= 0 || workedHours > 24) {
      return res.status(400).json({ success: false, message: 'De opgegeven werktijden leveren geen geldige uren op' })
    }

    const employee = await getEmployee(employeeId)
    const note = String(req.body?.note ?? '').trim().slice(0, 1000) || null
    const log = await submitEmployeeShiftHours({
      employee_id: employeeId,
      employee_name: employee?.name ?? session.user.display_name ?? shift.employee_name,
      shift_id: shift.id,
      log_date: planned.log_date,
      location: shift.location,
      clock_in: clockIn,
      clock_out: clockOut,
      break_minutes: breakMinutes,
      overtime_hours: shift.shift_type === 'Overwerk' || shift.shift_category === 'overtime' ? workedHours : 0,
      note,
      confirmation_mode: mode,
      planned_clock_in: planned.clock_in,
      planned_clock_out: planned.clock_out,
      planned_break_minutes: planned.break_minutes,
      created_by: session.user.user_id,
    })

    if (mode === 'adjusted') {
      try {
        await sendHourSubmissionAlertEmail({
          employeeName: log.employee_name,
          logDate: log.log_date,
          clockIn: log.clock_in ?? '',
          clockOut: log.clock_out ?? '',
        })
      } catch (emailErr) {
        console.error('[api/hours/shift] Review alert email failed:', emailErr)
      }
    }

    return res.status(201).json({ success: true, data: log, auto_approved: mode === 'confirmed' })
  } catch (err: unknown) {
    if (err instanceof HourSubmissionConflictError) {
      const conflict = hourSubmissionConflictResponse(err)
      return res.status(conflict.status).json(conflict.body)
    }
    console.error('[/api/hours/shift]', err)
    const failure = hourSubmissionFailure(err)
    if (failure.status === 503) res.setHeader('Retry-After', '60')
    return res.status(failure.status).json(failure.body)
  }
}
