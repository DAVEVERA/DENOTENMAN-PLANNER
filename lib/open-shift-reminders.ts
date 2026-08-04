import { supabase, T, unwrap } from './db'
import { sendOpenShiftAlertEmail } from './email'
import { sendPushToAll } from './push'
import { getEmployees } from './scheduler'
import { formatShiftDate } from './shiftDate'
import type { Day, OpenShiftReminder, OpenShiftReminderStage, Shift } from '@/types'

interface ClaimedReminder {
  event_id: number
  shift_id: number
  reminder_stage: OpenShiftReminderStage
}

export interface OpenShiftReminderRunResult {
  claimed: number
  completed: number
  failed: number
}

const DAY_NL: Record<string, string> = {
  maandag: 'Maandag', dinsdag: 'Dinsdag', woensdag: 'Woensdag',
  donderdag: 'Donderdag', vrijdag: 'Vrijdag', zaterdag: 'Zaterdag', zondag: 'Zondag',
}

function shiftLabel(shift: Shift): string {
  const day = DAY_NL[shift.day_of_week] ?? shift.day_of_week
  const date = formatShiftDate(shift.day_of_week as Day, shift.week_number, shift.year)
  const time = shift.start_time
    ? `, ${shift.start_time.slice(0, 5)}-${shift.end_time?.slice(0, 5)}`
    : ''
  return `${day} ${date} (${shift.shift_type}${time}, ${shift.location})`
}

function stageCopy(stage: OpenShiftReminderStage, count: number) {
  const age = stage === 'two_weeks' ? '2 weken' : 'ruim 1,5 week'
  const noun = count === 1 ? 'dienst staat' : 'diensten staan'
  return {
    title: `Open ${count === 1 ? 'dienst' : 'diensten'}: ${age}`,
    intro: `${count} open ${noun} al ${age} open. Willen jullie als team nogmaals nagaan of iemand ${count === 1 ? 'deze dienst' : 'deze diensten'} kan oppakken?`,
  }
}

async function setReminderResult(
  row: OpenShiftReminder,
  emailSent: boolean,
  pushSent: boolean,
  errors: string[],
): Promise<boolean> {
  const now = new Date().toISOString()
  const emailDone = Boolean(row.email_sent_at) || emailSent
  const pushDone = Boolean(row.push_sent_at) || pushSent
  const completed = emailDone && pushDone
  const { error } = await supabase.from(T('open_shift_reminders')).update({
    status: completed ? 'completed' : 'failed',
    email_sent_at: emailDone ? (row.email_sent_at ?? now) : null,
    push_sent_at: pushDone ? (row.push_sent_at ?? now) : null,
    completed_at: completed ? now : null,
    last_error: completed ? null : errors.join(' | ').slice(0, 2000),
  }).eq('id', row.id)
  if (error) throw error
  return completed
}

export async function processOpenShiftReminders(): Promise<OpenShiftReminderRunResult> {
  const claimResult = await supabase.rpc('planner20_claim_open_shift_reminders')
  if (claimResult.error) throw claimResult.error
  const claimed = (claimResult.data ?? []) as ClaimedReminder[]
  if (claimed.length === 0) return { claimed: 0, completed: 0, failed: 0 }

  const eventIds = claimed.map(row => row.event_id)
  const shiftIds = claimed.map(row => row.shift_id)
  const events = unwrap<OpenShiftReminder[]>(
    await supabase.from(T('open_shift_reminders')).select('*').in('id', eventIds),
  )
  const shifts = unwrap<Shift[]>(
    await supabase.from(T('shifts')).select('*').in('id', shiftIds).is('archived_at', null).eq('is_open', 1),
  )
  const shiftsById = new Map(shifts.map(shift => [shift.id, shift]))

  const employees = await getEmployees(true)
  const adminEmail = process.env.ADMIN_EMAIL ?? 'info@denotenman.com'
  const recipients = Array.from(new Set(
    [adminEmail, ...employees.map(employee => employee.email)]
      .filter((email): email is string => Boolean(email))
      .map(email => email.trim().toLowerCase()),
  ))

  let completed = 0
  let failed = 0

  for (const stage of ['one_and_half_weeks', 'two_weeks'] as const) {
    const stageEvents = events.filter(event => event.reminder_stage === stage)
    if (stageEvents.length === 0) continue

    const validEvents = stageEvents.filter(event => shiftsById.has(event.shift_id))
    const missingEvents = stageEvents.filter(event => !shiftsById.has(event.shift_id))
    for (const event of missingEvents) {
      await setReminderResult(event, false, false, ['Dienst is niet meer open'])
      failed++
    }
    if (validEvents.length === 0) continue

    const emailEvents = validEvents.filter(event => !event.email_sent_at)
    const pushEvents = validEvents.filter(event => !event.push_sent_at)
    let emailSent = emailEvents.length === 0
    let pushSent = pushEvents.length === 0
    const errors: string[] = []

    if (emailEvents.length > 0) {
      const emailShifts = emailEvents.map(event => shiftsById.get(event.shift_id)!).filter(Boolean)
      const copy = stageCopy(stage, emailShifts.length)
      try {
        await sendOpenShiftAlertEmail({
          toBcc: recipients,
          subject: copy.title,
          body: `${copy.intro}\n\n${emailShifts.map(shift => `- ${shiftLabel(shift)}`).join('\n')}\n\nBekijk de open diensten in de planner.`,
        })
        emailSent = true
      } catch (error) {
        errors.push(`E-mail: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (pushEvents.length > 0) {
      const pushShifts = pushEvents.map(event => shiftsById.get(event.shift_id)!).filter(Boolean)
      const copy = stageCopy(stage, pushShifts.length)
      try {
        const result = await sendPushToAll({
          title: copy.title,
          body: copy.intro,
          url: '/me/open-shifts',
        })
        if (!result.configured) throw new Error('Web-push is niet geconfigureerd')
        if (result.total > 0 && result.fulfilled === 0) throw new Error('Geen pushbericht kon worden afgeleverd')
        pushSent = true
      } catch (error) {
        errors.push(`Push: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    for (const event of validEvents) {
      const done = await setReminderResult(
        event,
        Boolean(event.email_sent_at) || (emailSent && emailEvents.some(item => item.id === event.id)),
        Boolean(event.push_sent_at) || (pushSent && pushEvents.some(item => item.id === event.id)),
        errors,
      )
      if (done) completed++
      else failed++
    }
  }

  return { claimed: claimed.length, completed, failed }
}
