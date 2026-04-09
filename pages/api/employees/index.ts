import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T, unwrap } from '@/lib/db'
import type { Employee, Location } from '@/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

  if (req.method === 'GET') {
    if (!can(session.user, 'read')) return res.status(403).json({ success: false })
    const all       = req.query.all === '1'
    const activeOnly = req.query.active === '1' || !all
    const location   = req.query.location as Location | undefined

    let data: Employee[] = []
    try {
      let q = supabase.from(T('employees')).select('*').order('name')
      if (activeOnly) q = q.eq('is_active', 1)
      if (location && location !== 'both') q = q.or(`location.eq.${location},location.eq.both`)
      data = unwrap<Employee[]>(await q)
    } catch (err: any) {
      if (err.message?.includes('location')) {
        let q = supabase.from(T('employees')).select('*').order('name')
        if (activeOnly) q = q.eq('is_active', 1)
        data = unwrap<Employee[]>(await q)
      } else {
        throw err
      }
    }
    return res.json({ success: true, data })
  }

  if (req.method === 'POST') {
    if (!can(session.user, 'manage_employees')) return res.status(403).json({ success: false })
    const { name, email, phone, contract_hours, is_active, user_level, team_group, location, hourly_rate } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Naam is verplicht' })
    const row = unwrap<Employee>(await supabase
      .from(T('employees'))
      .insert({
        name, email: email ?? null, phone: phone ?? null,
        contract_hours: contract_hours ?? 24,
        is_active: is_active ?? 1,
        user_level: user_level ?? 'Medewerker',
        team_group: team_group ?? null,
        location: location ?? 'markt',
        hourly_rate: hourly_rate ?? null,
      })
      .select()
      .single())
    return res.status(201).json({ success: true, data: row })
  }

  res.status(405).json({ success: false })
}
