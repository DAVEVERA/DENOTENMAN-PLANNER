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
import { sessionOptions, type PlannerSessionData } from './session'
import type { SessionUser } from '@/types'
import { supabase, T } from './db'
import { sendInviteEmail, sendPasswordResetEmail } from './email'
export { can } from './capabilities'

// ─── Type definities ─────────────────────────────────────────────────────────

interface StoredUser {
  username:      string
  password_hash: string
  role:          'admin' | 'manager' | 'employee' | 'inspector'
  employee_id:   number | null
  display_name:  string
  archived_at?:  string | null
  archived_by?:  string | null
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

const USERS_TABLE = () => T('users')
const PASSWORD_RESET_TOKENS_TABLE = () => T('password_reset_tokens')
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function dbLoadUsers(): Promise<StoredUser[]> {
  const { data, error } = await supabase.from(USERS_TABLE()).select('*').is('archived_at', null)
  if (error) { console.error('[auth] loadUsers error:', error.message); return [] }
  return (data ?? []) as StoredUser[]
}

async function dbFindUser(username: string): Promise<StoredUser | null> {
  const { data } = await supabase
    .from(USERS_TABLE())
    .select('*')
    .eq('username', username)
    .is('archived_at', null)
    .maybeSingle()
  return data ?? null
}

async function dbFindUserIncludingArchived(username: string): Promise<StoredUser | null> {
  const { data, error } = await supabase
    .from(USERS_TABLE())
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

async function dbFindByEmployeeId(employeeId: number): Promise<StoredUser | null> {
  const { data } = await supabase
    .from(USERS_TABLE())
    .select('*')
    .eq('employee_id', employeeId)
    .is('archived_at', null)
    .maybeSingle()
  return data ?? null
}

async function getPasswordResetEmail(user: StoredUser): Promise<string | null> {
  if (user.username.includes('@')) return user.username
  if (!user.employee_id) return null

  const { data } = await supabase
    .from(T('employees'))
    .select('email')
    .eq('id', user.employee_id)
    .maybeSingle()

  return data?.email ?? null
}

async function dbUpsertUser(user: StoredUser): Promise<void> {
  const { error } = await supabase
    .from(USERS_TABLE())
    .upsert(user, { onConflict: 'username' })
  if (error) throw new Error('[auth] upsertUser: ' + error.message)
}

async function dbDeleteUser(username: string, actor: string): Promise<boolean> {
  const { data, error } = await supabase.rpc(T('archive_user_account'), {
    p_username: username,
    p_actor: actor,
  })
  return !error && Boolean(data)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Zorgt dat er altijd een admin-account bestaat.
 * Veilig om meerdere keren aan te roepen (idempotent).
 *
 * Vereist ADMIN_BOOTSTRAP_PASSWORD in de omgeving — er is bewust GEEN
 * hardcoded fallback-wachtwoord. Een vast "admin/admin123"-account zou een
 * voorspelbare, publiek bekende inlog zijn zodra deze functie ooit wordt
 * aangeroepen (bijv. na een lege users-tabel of migratie-fout).
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await dbFindUser('admin')
  if (existing) return

  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD
  if (!bootstrapPassword || bootstrapPassword.length < 12) {
    throw new Error(
      '[auth] ensureDefaultAdmin: ADMIN_BOOTSTRAP_PASSWORD ontbreekt of is te kort ' +
      '(min. 12 tekens). Geen default admin-account aangemaakt.'
    )
  }

  await dbUpsertUser({
    username:      'admin',
    password_hash: bcrypt.hashSync(bootstrapPassword, 10),
    role:          'admin',
    employee_id:   null,
    display_name:  'Administrator',
    archived_at:   null,
    archived_by:   null,
  })
}

export async function attemptLogin(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
  username: string,
  password: string,
  requiredRole?: StoredUser['role'],
): Promise<boolean> {
  const user = await dbFindUser(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return false
  if (requiredRole ? user.role !== requiredRole : user.role === 'inspector') return false

  // Haal locatie op zodat index-page correct kan doorsturen
  let empLocation: string | null = null
  if (user.employee_id) {
    const { data: empData } = await supabase
      .from(T('employees'))
      .select('location')
      .eq('id', user.employee_id)
      .maybeSingle()
    empLocation = empData?.location ?? null
  }

  const session = await getIronSession<PlannerSessionData>(req, res, sessionOptions)
  session.user = {
    user_id:      user.username,
    display_name: user.display_name,
    role:         user.role,
    employee_id:  user.employee_id,
    location:     empLocation as any,
  }
  session.csrf = crypto.randomBytes(32).toString('hex')
  if (user.role === 'inspector') {
    session.inspection_expires_at = Date.now() + 30 * 60 * 1000
  } else {
    delete session.inspection_expires_at
    delete session.inspection_admin_return
    delete session.inspection_admin_csrf
  }
  await session.save()
  return true
}

const DEV_USER: SessionUser = {
  user_id: 'dev', display_name: 'Dev Admin', role: 'admin', employee_id: null, location: null,
}

export async function getSession(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
): Promise<PlannerSessionData> {
  const session = await getRawSession(req, res)
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production' && !session.user) {
    return { user: DEV_USER, csrf: 'dev' }
  }
  if (session.user?.role === 'inspector') {
    if (!session.inspection_expires_at || session.inspection_expires_at <= Date.now()) {
      session.user = undefined
      session.destroy()
      return session
    }
    if (!isInspectorPathAllowed(req.url)) session.user = undefined
  }
  return session
}

export function getRawSession(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
) {
  return getIronSession<PlannerSessionData>(req, res, sessionOptions)
}

/** Central deny-by-default boundary for the restricted inspection role. */
export function isInspectorPathAllowed(rawUrl?: string): boolean {
  const path = (rawUrl ?? '/').split('?')[0]
  return path === '/'
    || path === '/login'
    || path === '/api/session'
    || path === '/api/auth/logout'
    || path === '/inspectie'
    || path.startsWith('/inspectie/')
    || path === '/api/inspectie'
    || path.startsWith('/api/inspectie/')
}

export async function changePassword(username: string, newPassword: string): Promise<boolean> {
  const user = await dbFindUser(username)
  if (!user) return false
  user.password_hash = bcrypt.hashSync(newPassword, 10)
  await dbUpsertUser(user)
  return true
}

export async function changeOwnPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await dbFindUser(username)
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) return false
  user.password_hash = bcrypt.hashSync(newPassword, 10)
  await dbUpsertUser(user)
  return true
}

export async function requestPasswordReset(usernameOrEmail: string): Promise<boolean> {
  const username = usernameOrEmail.trim().slice(0, 120)
  if (!username) return false

  const user = await dbFindUser(username)
  if (!user) return false

  const to = await getPasswordResetEmail(user)
  if (!to) return false

  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashResetToken(token)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString()

  await supabase
    .from(PASSWORD_RESET_TOKENS_TABLE())
    .update({ used_at: new Date().toISOString() })
    .eq('username', user.username)
    .is('used_at', null)

  const { error } = await supabase
    .from(PASSWORD_RESET_TOKENS_TABLE())
    .insert({
      username: user.username,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
  if (error) throw new Error('[auth] requestPasswordReset: ' + error.message)

  await sendPasswordResetEmail({
    to,
    toName: user.display_name || user.username,
    token,
  })

  return true
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const cleanToken = token.trim()
  if (!cleanToken) return false

  const tokenHash = hashResetToken(cleanToken)
  const now = new Date().toISOString()
  const { data: resetToken, error } = await supabase
    .from(PASSWORD_RESET_TOKENS_TABLE())
    .select('id, username, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  if (error) throw new Error('[auth] resetPasswordWithToken: ' + error.message)
  if (!resetToken) return false

  const changed = await changePassword(resetToken.username, newPassword)
  if (!changed) return false

  await supabase
    .from(PASSWORD_RESET_TOKENS_TABLE())
    .update({ used_at: now })
    .eq('id', resetToken.id)

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
  const existing = await dbFindUserIncludingArchived(data.username)
  if (existing?.archived_at) {
    throw new Error('[auth] archived usernames cannot be silently reactivated')
  }
  const hash = data.password
    ? bcrypt.hashSync(data.password, 10)
    : existing?.password_hash ?? ''
  await dbUpsertUser({
    username:      data.username,
    password_hash: hash,
    role:          data.role,
    employee_id:   data.employee_id,
    display_name:  data.display_name,
    archived_at:   existing?.archived_at ?? null,
    archived_by:   existing?.archived_by ?? null,
  })
}

export async function deleteUser(username: string, actor: string): Promise<boolean> {
  return dbDeleteUser(username, actor)
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
