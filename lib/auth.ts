/**
 * lib/auth.ts — Gebruikersauthenticatie via Supabase (planner20_users)
 *
 * Alle gebruikersdata wordt opgeslagen in de Supabase-tabel `planner20_users`.
 * Er is geen fs-afhankelijkheid meer, waardoor dit ook werkt op Vercel / serverless.
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { IncomingMessage, ServerResponse } from 'http'
import { getIronSession } from 'iron-session'
import { sessionOptions } from './session'
import type { SessionUser } from '@/types'
import { supabase, T } from './db'
import { sendInviteEmail } from './email'
export { can } from './capabilities'

// ─── Type definities ─────────────────────────────────────────────────────────

interface StoredUser {
  username:      string
  password_hash: string
  role:          'admin' | 'manager' | 'employee'
  employee_id:   number | null
  display_name:  string
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

const USERS_TABLE = () => T('users')

async function dbLoadUsers(): Promise<StoredUser[]> {
  const { data, error } = await supabase.from(USERS_TABLE()).select('*')
  if (error) { console.error('[auth] loadUsers error:', error.message); return [] }
  return (data ?? []) as StoredUser[]
}

async function dbFindUser(username: string): Promise<StoredUser | null> {
  const { data } = await supabase
    .from(USERS_TABLE())
    .select('*')
    .eq('username', username)
    .maybeSingle()
  return data ?? null
}

async function dbFindByEmployeeId(employeeId: number): Promise<StoredUser | null> {
  const { data } = await supabase
    .from(USERS_TABLE())
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle()
  return data ?? null
}

async function dbUpsertUser(user: StoredUser): Promise<void> {
  const { error } = await supabase
    .from(USERS_TABLE())
    .upsert(user, { onConflict: 'username' })
  if (error) throw new Error('[auth] upsertUser: ' + error.message)
}

async function dbDeleteUser(username: string): Promise<boolean> {
  const { error } = await supabase
    .from(USERS_TABLE())
    .delete()
    .eq('username', username)
  return !error
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Zorgt dat er altijd een admin-account bestaat.
 * Veilig om meerdere keren aan te roepen (idempotent).
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await dbFindUser('admin')
  if (existing) return
  await dbUpsertUser({
    username:      'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    role:          'admin',
    employee_id:   null,
    display_name:  'Administrator',
  })
}

export async function attemptLogin(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
  username: string,
  password: string,
): Promise<boolean> {
  const user = await dbFindUser(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return false

  const session = await getIronSession<{ user?: SessionUser; csrf?: string }>(req, res, sessionOptions)
  session.user = {
    user_id:      user.username,
    display_name: user.display_name,
    role:         user.role,
    employee_id:  user.employee_id,
    location:     null,
  }
  session.csrf = crypto.randomBytes(32).toString('hex')
  await session.save()
  return true
}

const DEV_USER: SessionUser = {
  user_id: 'dev', display_name: 'Dev Admin', role: 'admin', employee_id: null, location: null,
}

export async function getSession(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
) {
  if (process.env.SKIP_AUTH === 'true') {
    return { user: DEV_USER, csrf: 'dev' } as { user?: SessionUser; csrf?: string }
  }
  return getIronSession<{ user?: SessionUser; csrf?: string }>(req, res, sessionOptions)
}

export async function changePassword(username: string, newPassword: string): Promise<boolean> {
  const user = await dbFindUser(username)
  if (!user) return false
  user.password_hash = bcrypt.hashSync(newPassword, 10)
  await dbUpsertUser(user)
  return true
}

export async function listUsers(): Promise<Omit<StoredUser, 'password_hash'>[]> {
  const all = await dbLoadUsers()
  return all.map(({ password_hash: _, ...u }) => u)
}

export async function checkEmployeeHasAccount(employeeId: number): Promise<boolean> {
  const user = await dbFindByEmployeeId(employeeId)
  return user !== null
}

export async function upsertUser(
  data: Omit<StoredUser, 'password_hash'> & { password?: string }
): Promise<void> {
  const existing = await dbFindUser(data.username)
  const hash = data.password
    ? bcrypt.hashSync(data.password, 10)
    : existing?.password_hash ?? ''
  await dbUpsertUser({
    username:      data.username,
    password_hash: hash,
    role:          data.role,
    employee_id:   data.employee_id,
    display_name:  data.display_name,
  })
}

export async function deleteUser(username: string): Promise<boolean> {
  return dbDeleteUser(username)
}

/**
 * Genereer een tijdelijk wachtwoord, sla de hash op in Supabase en stuur
 * de uitnodigingsmail. Update ook het `invite_sent_at` veld in de DB.
 */
export async function sendInviteForEmployee(employeeId: number): Promise<void> {
  const { data: emp, error } = await supabase
    .from(T('employees'))
    .select('email, name')
    .eq('id', employeeId)
    .maybeSingle()
  if (error) throw error
  if (!emp?.email) throw new Error('Medewerker heeft geen e-mailadres — voeg er eerst een toe onder Gegevens.')

  let user = await dbFindByEmployeeId(employeeId)

  if (!user) {
    // Kijk of het e-mailadres al een account heeft (andere employee)
    const existingByEmail = await dbFindUser(emp.email)
    if (existingByEmail) {
      // Koppel het bestaande account aan deze medewerker
      existingByEmail.employee_id = employeeId
      await dbUpsertUser(existingByEmail)
      user = existingByEmail
    } else {
      // Maak nieuw account aan (password wordt hieronder gezet)
      user = {
        username:      emp.email!,
        password_hash: '',
        role:          'employee',
        employee_id:   employeeId,
        display_name:  emp.name,
      }
    }
  }

  // Tijdelijk wachtwoord genereren en opslaan
  const tempPw = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)
  user.password_hash = bcrypt.hashSync(tempPw, 10)
  await dbUpsertUser(user)

  // Mail versturen
  await sendInviteEmail({
    to:           emp.email!,
    toName:       emp.name,
    username:     user.username,
    tempPassword: tempPw,
  })

  // invite_sent_at bijwerken
  await supabase
    .from(T('employees'))
    .update({ invite_sent_at: new Date().toISOString(), invite_pending: false })
    .eq('id', employeeId)
}
