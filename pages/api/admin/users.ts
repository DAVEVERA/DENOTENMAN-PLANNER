import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can, listUsers, upsertUser, deleteUser } from '@/lib/auth'
import { hasSameOrigin } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })
  if (!can(session.user, 'manage_settings'))
    return res.status(403).json({ success: false, message: 'Geen toegang' })

  // ── GET: lijst alle accounts ──
  if (req.method === 'GET') {
    const users = await listUsers()
    return res.json({ success: true, data: users })
  }

  // ── POST: nieuw account aanmaken / bijwerken ──
  if (req.method === 'POST') {
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
    const { username, display_name, role, password, employee_id } = req.body ?? {}
    if (!username || !display_name || !role)
      return res.status(400).json({ success: false, message: 'Username, display naam en rol zijn verplicht' })

    const validRoles = ['admin', 'manager', 'employee', 'inspector'] as const
    if (!validRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Ongeldige rol' })

    // Bij nieuw account is een wachtwoord verplicht
    // Bij update is het optioneel (bestaand wachtwoord blijft behouden)
    const cleanPassword = password ? String(password) : undefined
    if (role === 'inspector' && !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Voor een inspectieaccount is altijd een nieuw sterk wachtwoord vereist' })
    }
    if (cleanPassword && cleanPassword.length < (role === 'inspector' ? 14 : 8)) {
      return res.status(400).json({
        success: false,
        message: role === 'inspector'
          ? 'Een inspectieaccount vereist een nieuw wachtwoord van minimaal 14 tekens'
          : 'Wachtwoord moet minimaal 8 tekens bevatten',
      })
    }
    if (role === 'inspector' && cleanPassword
      && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(cleanPassword)) {
      return res.status(400).json({ success: false, message: 'Gebruik voor het inspectieaccount hoofdletters, kleine letters, cijfers en een symbool' })
    }
    if (role === 'inspector' && employee_id) {
      return res.status(400).json({ success: false, message: 'Een inspectieaccount mag niet aan een medewerker gekoppeld zijn' })
    }

    try {
      await upsertUser({
        username:     String(username).trim().toLowerCase(),
        display_name: String(display_name).trim(),
        role,
        employee_id:  employee_id ?? null,
        password:     cleanPassword,
      })
      return res.json({ success: true })
    } catch (err: unknown) {
      console.error('[/api/admin/users POST]', err)
      return res.status(500).json({ success: false, message: 'Account kon niet veilig worden opgeslagen' })
    }
  }

  // ── DELETE: account verwijderen ──
  if (req.method === 'DELETE') {
    if (!hasSameOrigin(req)) return res.status(403).json({ success: false })
    const { username } = req.body ?? {}
    if (!username)
      return res.status(400).json({ success: false, message: 'Username vereist' })

    // Voorkom dat admin zijn eigen account verwijdert
    if (username === session.user.user_id)
      return res.status(400).json({ success: false, message: 'Je kunt je eigen account niet verwijderen' })

    const ok = await deleteUser(String(username), session.user.user_id)
    if (!ok) return res.status(404).json({ success: false, message: 'Account niet gevonden' })
    return res.json({ success: true })
  }

  return res.status(405).json({ success: false })
}
