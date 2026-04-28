/**
 * pages/api/chat/workflows.ts
 * D'n Dave — opgeslagen workflows beheren
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })
  if (!can(session.user, 'manage_shifts')) {
    return res.status(403).json({ success: false, message: 'Alleen admins kunnen workflows beheren.' })
  }

  // GET — lijst van actieve workflows
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from(T('chat_workflows'))
      .select('id, name, description, steps, created_by, created_at')
      .eq('is_active', 1)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.json({ success: true, data: data ?? [] })
  }

  // POST — sla nieuwe workflow op
  if (req.method === 'POST') {
    const { name, description, steps } = req.body
    if (!name || !steps) {
      return res.status(400).json({ success: false, message: 'Naam en stappen zijn verplicht.' })
    }

    const { data, error } = await supabase
      .from(T('chat_workflows'))
      .insert({ name, description: description ?? '', steps, created_by: session.user.user_id })
      .select()
      .single()

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.status(201).json({ success: true, data })
  }

  // DELETE — verwijder workflow (soft delete)
  if (req.method === 'DELETE') {
    const id = parseInt(String(req.query.id))
    if (!id) return res.status(400).json({ success: false, message: 'ID ontbreekt.' })

    const { error } = await supabase
      .from(T('chat_workflows'))
      .update({ is_active: 0 })
      .eq('id', id)

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.json({ success: true, message: 'Workflow verwijderd.' })
  }

  res.status(405).json({ success: false })
}
