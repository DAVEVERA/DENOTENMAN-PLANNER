/**
 * lib/dave-tools.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Support — Anthropic Tool Use implementaties
 *
 * Elke tool = een echte actie in de planner.
 * Admin/manager krijgen alle tools; medewerkers alleen de "employee_tools".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabase, T } from './db'
import { saveShift, getWeekShifts, getEmployeeShifts, getOpenShifts } from './scheduler'
import { getISOWeek } from './scheduler'
import type { SessionUser } from '@/types'
import { DAYS } from '@/types'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function currentWeekYear() {
  const now = new Date()
  return { week: getISOWeek(now), year: now.getFullYear() }
}

/** Zoek medewerker op naam (fuzzy, case-insensitive) */
async function findEmployeeByName(name: string) {
  const { data } = await supabase
    .from(T('employees'))
    .select('id, name, location')
    .eq('is_active', 1)
    .order('name')
  if (!data) return null
  const lower = name.toLowerCase()
  return data.find(e => e.name.toLowerCase().includes(lower)) ?? null
}

/** Zet dag-naam om naar Day type (NL, case-insensitive) */
function parseDay(dag: string): string | null {
  const lower = dag.toLowerCase()
  return DAYS.find(d => d.startsWith(lower) || lower.startsWith(d.slice(0, 3))) ?? null
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool definities (Anthropic formaat)
// ──────────────────────────────────────────────────────────────────────────────

export const ADMIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'plan_shift',
    description: 'Plan een dienst voor een medewerker op een bepaalde dag. Gebruik dit als de admin zegt: "Plan Jan op maandag ochtend" of "Zet Lisa op donderdag van 09:00 tot 13:00".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employee_name: { type: 'string', description: 'Naam van de medewerker (of deel daarvan)' },
        day_of_week: { type: 'string', description: 'Dag van de week in het Nederlands (maandag, dinsdag, ...)' },
        shift_type: { type: 'string', description: 'Type dienst: Ochtend, Middag, Avond, Hele dag, Overwerk, Extra, Verlof, Vakantie, Verzuim' },
        week_number: { type: 'number', description: 'Weeknummer (ISO). Laat weg voor huidige week.' },
        year: { type: 'number', description: 'Jaar. Laat weg voor huidig jaar.' },
        start_time: { type: 'string', description: 'Starttijd in HH:MM formaat (optioneel)' },
        end_time: { type: 'string', description: 'Eindtijd in HH:MM formaat (optioneel)' },
        break_minutes: { type: 'number', description: 'Pauzeminuten (standaard 0)' },
        location: { type: 'string', description: 'Locatie: markt of nootmagazijn (optioneel, standaard locatie medewerker)' },
        note: { type: 'string', description: 'Optionele notitie bij de dienst' },
      },
      required: ['employee_name', 'day_of_week', 'shift_type'],
    },
  },
  {
    name: 'create_open_shift',
    description: 'Maak een open dienst aan (zonder toegewezen medewerker). Gebruik dit als admin een open plek wil zetten.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day_of_week: { type: 'string', description: 'Dag van de week in het Nederlands' },
        shift_type: { type: 'string', description: 'Type dienst: Ochtend, Middag, Avond, Hele dag, Extra' },
        week_number: { type: 'number', description: 'Weeknummer (optioneel, standaard huidige week)' },
        year: { type: 'number', description: 'Jaar (optioneel, standaard huidig jaar)' },
        start_time: { type: 'string', description: 'Starttijd HH:MM (optioneel)' },
        end_time: { type: 'string', description: 'Eindtijd HH:MM (optioneel)' },
        location: { type: 'string', description: 'Locatie: markt of nootmagazijn' },
        note: { type: 'string', description: 'Optionele notitie' },
      },
      required: ['day_of_week', 'shift_type'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Haal het rooster op voor een bepaalde week. Geeft alle diensten terug voor die week.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_number: { type: 'number', description: 'Weeknummer (optioneel, standaard huidige week)' },
        year: { type: 'number', description: 'Jaar (optioneel, standaard huidig jaar)' },
        location: { type: 'string', description: 'Filter op locatie: markt of nootmagazijn (optioneel)' },
        employee_name: { type: 'string', description: 'Filter op medewerker naam (optioneel)' },
      },
      required: [],
    },
  },
  {
    name: 'get_employees',
    description: 'Haal een lijst van medewerkers op.',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'Filter op locatie: markt of nootmagazijn (optioneel)' },
        include_inactive: { type: 'boolean', description: 'Inclusief inactieve medewerkers (standaard false)' },
      },
      required: [],
    },
  },
  {
    name: 'approve_leave',
    description: 'Keur een verlofaanvraag goed of wijs hem af.',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'number', description: 'ID van de verlofaanvraag' },
        action: { type: 'string', enum: ['approved', 'rejected'], description: 'Goedkeuren (approved) of afwijzen (rejected)' },
        note: { type: 'string', description: 'Optionele toelichting' },
      },
      required: ['request_id', 'action'],
    },
  },
  {
    name: 'get_leave_requests',
    description: 'Haal openstaande verlofaanvragen op.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], description: 'Status filter (standaard: pending)' },
      },
      required: [],
    },
  },
  {
    name: 'save_workflow',
    description: 'Sla een reeks acties op als herbruikbare workflow. Gebruik dit als de admin een terugkerende taak wil automatiseren.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Naam van de workflow (bijv. "Maandagse ochtend-ploeg")' },
        description: { type: 'string', description: 'Korte omschrijving van wat de workflow doet' },
        steps: {
          type: 'array',
          description: 'Lijst van stappen (tool-aanroepen)',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              input: { type: 'object' },
            },
          },
        },
      },
      required: ['name', 'description', 'steps'],
    },
  },
  {
    name: 'get_insights',
    description: 'Haal bezettingsinzichten op voor een week: hoeveel mensen per dag/type ingepland staan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_number: { type: 'number', description: 'Weeknummer (optioneel, standaard huidige week)' },
        year: { type: 'number', description: 'Jaar (optioneel)' },
        location: { type: 'string', description: 'Locatie filter (optioneel)' },
      },
      required: [],
    },
  },
]

export const EMPLOYEE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_schedule',
    description: 'Haal het eigen rooster op van de ingelogde medewerker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_number: { type: 'number', description: 'Weeknummer (optioneel, standaard huidige week)' },
        year: { type: 'number', description: 'Jaar (optioneel)' },
      },
      required: [],
    },
  },
  {
    name: 'get_open_shifts_list',
    description: 'Haal de lijst van open diensten op die beschikbaar zijn.',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'Locatie filter (optioneel)' },
      },
      required: [],
    },
  },
  {
    name: 'request_leave',
    description: 'Dien een verlofaanvraag in voor de ingelogde medewerker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        leave_type: { type: 'string', enum: ['Verlof', 'Vakantie', 'Verzuim'], description: 'Type verlof' },
        start_date: { type: 'string', description: 'Startdatum in YYYY-MM-DD formaat' },
        end_date: { type: 'string', description: 'Einddatum in YYYY-MM-DD formaat' },
        note: { type: 'string', description: 'Optionele toelichting' },
      },
      required: ['leave_type', 'start_date', 'end_date'],
    },
  },
]

// ──────────────────────────────────────────────────────────────────────────────
// Geef de juiste tools terug op basis van rol
// ──────────────────────────────────────────────────────────────────────────────
export function getToolsForRole(role: string): Anthropic.Tool[] {
  if (role === 'admin' || role === 'manager') {
    return [...ADMIN_TOOLS, ...EMPLOYEE_TOOLS]
  }
  return EMPLOYEE_TOOLS
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool uitvoerders
// ──────────────────────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  session: SessionUser,
): Promise<unknown> {
  const { week: cw, year: cy } = currentWeekYear()

  switch (toolName) {

    // ── plan_shift ──────────────────────────────────────────────────────────
    case 'plan_shift': {
      const emp = await findEmployeeByName(input.employee_name as string)
      if (!emp) return { success: false, message: `Medewerker "${input.employee_name}" niet gevonden.` }

      const day = parseDay(input.day_of_week as string)
      if (!day) return { success: false, message: `Dag "${input.day_of_week}" niet herkend.` }

      const week = (input.week_number as number) || cw
      const year = (input.year as number) || cy

      const result = await saveShift({
        employee_id:   emp.id,
        employee_name: emp.name,
        week_number:   week,
        year,
        day_of_week:   day as any,
        shift_type:    input.shift_type as any,
        start_time:    (input.start_time as string) || null,
        end_time:      (input.end_time as string) || null,
        break_minutes: (input.break_minutes as number) || 0,
        location:      (input.location as any) || emp.location,
        note:          (input.note as string) || null,
        is_open:       0,
        shift_category: 'regular',
      }, session.user_id)

      if ('error' in result) return { success: false, message: result.error }
      return { success: true, message: `Dienst aangemaakt voor ${emp.name} op ${day} (week ${week}).`, shift: result }
    }

    // ── create_open_shift ───────────────────────────────────────────────────
    case 'create_open_shift': {
      const day = parseDay(input.day_of_week as string)
      if (!day) return { success: false, message: `Dag "${input.day_of_week}" niet herkend.` }

      const week = (input.week_number as number) || cw
      const year = (input.year as number) || cy

      const result = await saveShift({
        employee_id:   null,
        employee_name: 'Open dienst',
        week_number:   week,
        year,
        day_of_week:   day as any,
        shift_type:    input.shift_type as any,
        start_time:    (input.start_time as string) || null,
        end_time:      (input.end_time as string) || null,
        location:      (input.location as any) || 'markt',
        note:          (input.note as string) || null,
        is_open:       1,
        shift_category: 'regular',
      }, session.user_id)

      if ('error' in result) return { success: false, message: result.error }
      return { success: true, message: `Open dienst aangemaakt op ${day} (week ${week}).`, shift: result }
    }

    // ── get_schedule ────────────────────────────────────────────────────────
    case 'get_schedule': {
      const week = (input.week_number as number) || cw
      const year = (input.year as number) || cy
      const location = input.location as any | undefined

      let shifts = await getWeekShifts(week, year, location)

      if (input.employee_name) {
        const lower = (input.employee_name as string).toLowerCase()
        shifts = shifts.filter(s => s.employee_name.toLowerCase().includes(lower))
      }

      const summary = shifts.map(s =>
        `${s.day_of_week}: ${s.employee_name} — ${s.shift_type}${s.start_time ? ` (${s.start_time}–${s.end_time})` : ''}${s.is_open ? ' [OPEN]' : ''}`
      )

      return {
        success: true,
        week, year,
        total: shifts.length,
        shifts: summary,
      }
    }

    // ── get_employees ───────────────────────────────────────────────────────
    case 'get_employees': {
      let q = supabase.from(T('employees')).select('id, name, email, location, contract_hours, user_level, is_active').order('name')
      if (!input.include_inactive) q = q.eq('is_active', 1)
      if (input.location && input.location !== 'both') {
        q = q.or(`location.eq.${input.location},location.eq.both`)
      }
      const { data, error } = await q
      if (error) return { success: false, message: error.message }
      return { success: true, total: data?.length ?? 0, employees: data }
    }

    // ── approve_leave ───────────────────────────────────────────────────────
    case 'approve_leave': {
      const { data, error } = await supabase
        .from(T('leave_requests'))
        .update({
          status:      input.action as string,
          reviewed_by: session.user_id,
          reviewed_at: new Date().toISOString(),
          note:        (input.note as string) || null,
        })
        .eq('id', input.request_id as number)
        .select()
        .single()
      if (error) return { success: false, message: error.message }
      const label = input.action === 'approved' ? 'goedgekeurd' : 'afgewezen'
      return { success: true, message: `Verlofaanvraag ${label}.`, request: data }
    }

    // ── get_leave_requests ──────────────────────────────────────────────────
    case 'get_leave_requests': {
      const status = (input.status as string) || 'pending'
      let q = supabase.from(T('leave_requests')).select('*').order('created_at', { ascending: false })
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) return { success: false, message: error.message }
      return { success: true, total: data?.length ?? 0, requests: data }
    }

    // ── save_workflow ───────────────────────────────────────────────────────
    case 'save_workflow': {
      const { data, error } = await supabase
        .from(T('chat_workflows'))
        .insert({
          name:        input.name as string,
          description: input.description as string,
          steps:       input.steps,
          created_by:  session.user_id,
        })
        .select()
        .single()
      if (error) return { success: false, message: error.message }
      return { success: true, message: `Workflow "${input.name}" opgeslagen.`, workflow: data }
    }

    // ── get_insights ────────────────────────────────────────────────────────
    case 'get_insights': {
      const week = (input.week_number as number) || cw
      const year = (input.year as number) || cy
      const location = input.location as any | undefined

      const shifts = await getWeekShifts(week, year, location)
      const perDay: Record<string, { ochtend: number; middag: number; avond: number; verlof: number; totaal: number }> = {}
      for (const s of shifts) {
        if (!perDay[s.day_of_week]) perDay[s.day_of_week] = { ochtend: 0, middag: 0, avond: 0, verlof: 0, totaal: 0 }
        const t = s.shift_type.toLowerCase()
        if (t === 'ochtend') perDay[s.day_of_week].ochtend++
        else if (t === 'middag') perDay[s.day_of_week].middag++
        else if (t === 'avond') perDay[s.day_of_week].avond++
        else if (['verlof', 'vakantie', 'verzuim'].includes(t)) perDay[s.day_of_week].verlof++
        perDay[s.day_of_week].totaal++
      }
      return { success: true, week, year, total_shifts: shifts.length, per_day: perDay }
    }

    // ── get_my_schedule ─────────────────────────────────────────────────────
    case 'get_my_schedule': {
      if (!session.employee_id) return { success: false, message: 'Geen medewerker-account gekoppeld.' }
      const week = (input.week_number as number) || cw
      const year = (input.year as number) || cy
      const shifts = await getEmployeeShifts(session.employee_id, week, year)
      const summary = shifts.map(s =>
        `${s.day_of_week}: ${s.shift_type}${s.start_time ? ` (${s.start_time}–${s.end_time})` : ''}${s.note ? ` — ${s.note}` : ''}`
      )
      return { success: true, week, year, total: shifts.length, shifts: summary }
    }

    // ── get_open_shifts_list ────────────────────────────────────────────────
    case 'get_open_shifts_list': {
      const shifts = await getOpenShifts(input.location as any)
      const summary = shifts.map(s =>
        `Week ${s.week_number}: ${s.day_of_week} — ${s.shift_type}${s.start_time ? ` (${s.start_time}–${s.end_time})` : ''} @ ${s.location}`
      )
      return { success: true, total: shifts.length, open_shifts: summary }
    }

    // ── request_leave ───────────────────────────────────────────────────────
    case 'request_leave': {
      if (!session.employee_id) return { success: false, message: 'Geen medewerker-account gekoppeld.' }

      const { data: emp } = await supabase
        .from(T('employees'))
        .select('name')
        .eq('id', session.employee_id)
        .maybeSingle()

      const { data, error } = await supabase
        .from(T('leave_requests'))
        .insert({
          employee_id:   session.employee_id,
          employee_name: emp?.name ?? session.display_name,
          leave_type:    input.leave_type as string,
          start_date:    input.start_date as string,
          end_date:      input.end_date as string,
          note:          (input.note as string) || null,
          status:        'pending',
        })
        .select()
        .single()

      if (error) return { success: false, message: error.message }
      return { success: true, message: `Verlofaanvraag ingediend voor ${input.start_date} t/m ${input.end_date}.`, request: data }
    }

    default:
      return { success: false, message: `Onbekend tool: ${toolName}` }
  }
}
