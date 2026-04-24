import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { IncomingMessage, ServerResponse } from 'http'
import { getIronSession } from 'iron-session'
import { sessionOptions } from './session'
import type { SessionUser, Capability } from '@/types'
import { ROLE_CAPS } from '@/types'
import { supabase, T } from './db'
import { sendInviteEmail } from './email'
export { can } from './capabilities'

const USERS_FILE = path.join(process.cwd(), 'config', 'users.json')

interface StoredUser {
  username: string
  password_hash: string
  role: 'admin' | 'manager' | 'employee'
  employee_id: number | null
  display_name: string
}

function loadUsers(): StoredUser[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveUsers(users: StoredUser[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

export function ensureDefaultAdmin(): void {
  const users = loadUsers()
  if (users.some(u => u.username === 'admin')) return
  users.push({
    username:      'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    role:          'admin',
    employee_id:   null,
    display_name:  'Administrator',
  })
  saveUsers(users)
}

export async function attemptLogin(
  req: NextApiRequest | IncomingMessage,
  res: NextApiResponse | ServerResponse,
  username: string,
  password: string,
): Promise<boolean> {
  const users = loadUsers()
  const user  = users.find(u => u.username === username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return false
  const session = await getIronSession<{ user?: SessionUser; csrf?: string }>(req, res, sessionOptions)
  session.user  = {
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


export function changePassword(username: string, newPassword: string): boolean {
  const users = loadUsers()
  const user  = users.find(u => u.username === username)
  if (!user) return false
  user.password_hash = bcrypt.hashSync(newPassword, 10)
  saveUsers(users)
  return true
}

export function listUsers(): Omit<StoredUser, 'password_hash'>[] {
  return loadUsers().map(({ password_hash: _, ...u }) => u)
}

/** Controleert of een medewerker al een gebruikersaccount heeft in users.json */
export function checkEmployeeHasAccount(employeeId: number): boolean {
  return loadUsers().some(u => u.employee_id === employeeId)
}

export function upsertUser(data: Omit<StoredUser, 'password_hash'> & { password?: string }): void {
  const users = loadUsers()
  const idx   = users.findIndex(u => u.username === data.username)
  const hash  = data.password ? bcrypt.hashSync(data.password, 10) : users[idx]?.password_hash ?? ''
  const entry: StoredUser = {
    username:      data.username,
    password_hash: hash,
    role:          data.role,
    employee_id:   data.employee_id,
    display_name:  data.display_name,
  }
  if (idx >= 0) users[idx] = entry
  else users.push(entry)
  saveUsers(users)
}

export function deleteUser(username: string): boolean {
  const users = loadUsers()
  const idx   = users.findIndex(u => u.username === username)
  if (idx < 0) return false
  users.splice(idx, 1)
  saveUsers(users)
  return true
}

/**
 * Genereer een tijdelijk wachtwoord, update de hash in users.json en stuur
 * de uitnodigingsmail. Update ook het `invite_sent_at` veld in de DB.
 *
 * Retourneert het tijdelijke wachtwoord (voor logging — niet naar client sturen).
 */
export async function sendInviteForEmployee(employeeId: number): Promise<void> {
  // Haal e-mailadres op uit employees tabel — vereist vóór account-check
  const { data: emp, error } = await supabase
    .from(T('employees'))
    .select('email, name')
    .eq('id', employeeId)
    .maybeSingle()
  if (error) throw error
  if (!emp?.email) throw new Error('Medewerker heeft geen e-mailadres — voeg er eerst een toe onder Gegevens.')

  // Zoek of er al een users.json-account bestaat voor dit employee_id
  const users = loadUsers()
  let user = users.find(u => u.employee_id === employeeId)

  // AM-003 fix: als er geen account is, maak er automatisch één aan op basis van het e-mailadres.
  // Controleer ook of het e-mailadres al in gebruik is als username (andere medewerker).
  if (!user) {
    const existingByEmail = users.find(u => u.username === emp.email)
    if (existingByEmail) {
      // Account bestaat al op dit e-mailadres maar is niet gekoppeld — koppel het
      existingByEmail.employee_id = employeeId
      user = existingByEmail
    } else {
      // Maak nieuw account aan
      const newUser: StoredUser = {
        username:      emp.email!,
        password_hash: '',          // wordt hieronder ingevuld
        role:          'employee',
        employee_id:   employeeId,
        display_name:  emp.name,
      }
      users.push(newUser)
      user = newUser
    }
  }

  // Genereer een leesbaar tijdelijk wachtwoord (bv. "A3F9D2B1")
  const tempPw = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)

  // Sla de hash op
  user.password_hash = bcrypt.hashSync(tempPw, 10)
  saveUsers(users)

  // Stuur de uitnodigingsmail
  await sendInviteEmail({
    to:           emp.email!,
    toName:       emp.name,
    username:     user.username,
    tempPassword: tempPw,
  })

  // Update invite_sent_at in de database
  await supabase
    .from(T('employees'))
    .update({ invite_sent_at: new Date().toISOString(), invite_pending: false })
    .eq('id', employeeId)
}
