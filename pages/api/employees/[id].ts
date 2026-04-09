import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T, unwrap } from '@/lib/db'
import type { Employee } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  const id = parseInt(String(req.query.id))

  if (req.method === 'GET') {
    if (!can(session.user, 'read')) return res.status(403).json({ success: false })
    const emp = unwrap<Employee>(await supabase.from(T('employees')).select('*').eq('id', id).maybeSingle())
    if (!emp) return res.status(404).json({ success: false })
    return res.json({ success: true, data: emp })
  }

  if (req.method === 'PUT') {
    if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })
    const { name, email, phone, contract_hours, is_active, user_level, team_group, location, hourly_rate } = req.body
    const updated = unwrap<Employee>(await supabase
      .from(T('employees'))
      .update({
        name, email: email ?? null, phone: phone ?? null,
        contract_hours, is_active, user_level,
        team_group: team_group ?? null,
        location: location ?? 'markt',
        hourly_rate: hourly_rate ?? null,
      })
      .eq('id', id)
      .select()
      .single())
    return res.json({ success: true, data: updated })
  }

  if (req.method === 'DELETE') {
    if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })
    unwrap(await supabase.from(T('employees')).update({ is_active: 0 }).eq('id', id))
    return res.json({ success: true, data: { deactivated: true } })
  }

  res.status(405).json({ success: false })
}
