// ─── Locations ────────────────────────────────────────────────────────────────
export type Location = 'markt' | 'nootmagazijn' | 'both'
export const LOCATION_LABELS: Record<Exclude<Location, 'both'>, string> = {
  markt:        'De Notenkar (Markt)',
  nootmagazijn: 'Het Nootmagazijn',
}
export const LOCATION_COLORS: Record<Exclude<Location, 'both'>, string> = {
  markt:        '#2C6E49',
  nootmagazijn: '#7B4F2E',
}

// ─── Days ─────────────────────────────────────────────────────────────────────
export const DAYS = [
  'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
] as const
export type Day = typeof DAYS[number]

export const DAY_SHORT: Record<Day, string> = {
  maandag: 'Ma', dinsdag: 'Di', woensdag: 'Wo', donderdag: 'Do',
  vrijdag: 'Vr', zaterdag: 'Za', zondag: 'Zo',
}

// ─── Shift Types ──────────────────────────────────────────────────────────────
export const SHIFT_TYPES = [
  'Ochtend', 'Middag', 'Avond', 'Hele dag',
  'Verlof', 'Vakantie', 'Verzuim', 'Overwerk', 'Extra',
] as const
export type ShiftType = typeof SHIFT_TYPES[number]

export const ABSENCE_TYPES: ShiftType[] = ['Verlof', 'Vakantie', 'Verzuim']
export const WORK_TYPES: ShiftType[] = ['Ochtend', 'Middag', 'Avond', 'Hele dag', 'Overwerk', 'Extra']

export type ShiftCategory = 'regular' | 'extra' | 'overtime' | 'special'
export type OpenInviteStatus = 'pending' | 'accepted' | 'declined'

// ─── Core Entities ────────────────────────────────────────────────────────────
export interface Employee {
  id: number
  name: string
  email: string | null
  phone: string | null
  contract_hours: number
  is_active: number
  user_level: string
  team_group: string | null
  location: Location
  hourly_rate: number | null
}

export interface Shift {
  id: number
  employee_id: number | null
  employee_name: string
  week_number: number
  year: number
  day_of_week: Day
  shift_type: ShiftType
  start_time: string | null
  end_time: string | null
  full_day: number
  buddy: string | null
  note: string | null
  location: Location
  is_open: number
  open_invite_emp_id: number | null
  open_invite_status: OpenInviteStatus | null
  shift_category: ShiftCategory | null
  created_by: string
  created_at: string
}

export interface LeaveRequest {
  id: number
  employee_id: number
  employee_name: string
  leave_type: 'Verlof' | 'Vakantie' | 'Verzuim'
  start_date: string
  end_date: string
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface TimeLog {
  id: number
  employee_id: number
  employee_name: string
  log_date: string
  location: Location
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
  overtime_hours: number
  shift_id: number | null
  note: string | null
  is_processed: number
  processed_at: string | null
  created_by: string
  created_at: string
}

export interface PushSubscriptionRow {
  id: number
  employee_id: number
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

// ─── Auth / Session ───────────────────────────────────────────────────────────
export interface SessionUser {
  user_id: string
  display_name: string
  role: 'admin' | 'manager' | 'employee'
  employee_id: number | null
  location: Location | null
}

export type Capability =
  | 'read'
  | 'view_own'
  | 'manage_shifts'
  | 'manage_employees'
  | 'approve_leave'
  | 'manage_hours'
  | 'export_data'
  | 'send_notifications'
  | 'manage_settings'

export const ROLE_CAPS: Record<string, Capability[]> = {
  admin: [
    'manage_settings', 'manage_employees', 'manage_shifts',
    'approve_leave', 'manage_hours', 'export_data',
    'send_notifications', 'view_own', 'read',
  ],
  manager: [
    'manage_shifts', 'approve_leave', 'manage_hours',
    'export_data', 'send_notifications', 'view_own', 'read',
  ],
  employee: ['read', 'view_own'],
}

// ─── App Settings ─────────────────────────────────────────────────────────────
export interface AppSettings {
  accountant_email: string
  accountant_name: string
  export_auto_email: boolean
  location_markt_name: string
  location_nootmagazijn_name: string
  [key: string]: unknown
}

// ─── Utility Types ────────────────────────────────────────────────────────────
export interface WeekInfo { week: number; year: number }

export interface OccupancyCount {
  day: Day
  ochtend: number
  middag: number
  avond: number
  total: number
}

export interface HoursSummary {
  employee_id: number
  employee_name: string
  contract_hours: number
  logged_hours: number
  overtime_hours: number
}
