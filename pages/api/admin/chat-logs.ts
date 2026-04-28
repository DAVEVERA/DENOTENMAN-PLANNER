/**
 * pages/api/admin/chat-logs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Support — Admin chat-log beheer API 
 *
 * GET  /api/admin/chat-logs            — alle sessies (gegroepeerd per gebruiker)
 * GET  /api/admin/chat-logs?session=X  — berichten van één sessie
 * DELETE /api/admin/chat-logs?session=X — wis gesprek van één sessie
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, can } from '@/lib/auth'
import { supabase, T } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })
  if (!can(session.user, 'manage_shifts')) {
    return res.status(403).json({ success: false, message: 'Alleen admins kunnen chat-logs inzien.' })
  }

  const sessionFilter = req.query.session as string | undefined

  // ── GET: alle sessies of één gesprek ───────────────────────────────────────
  if (req.method === 'GET') {

    if (sessionFilter) {
      // Één gesprek ophalen
      const { data, error } = await supabase
        .from(T('chat_messages'))
        .select('id, role, content, tool_name, tool_result, created_at')
        .eq('session_id', sessionFilter)
        .order('created_at', { ascending: true })
        .limit(500)

      if (error) return res.status(500).json({ success: false, message: error.message })
      return res.json({ success: true, data: data ?? [] })
    }

    // Alle sessies ophalen (gegroepeerd + stats)
    const { data, error } = await supabase
      .from(T('chat_messages'))
      .select('session_id, role, created_at')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ success: false, message: error.message })

    // Groepeer per session_id
    const sessionMap: Record<string, {
      session_id: string
      message_count: number
      user_messages: number
      last_activity: string
      first_activity: string
    }> = {}

    for (const row of data ?? []) {
      if (!sessionMap[row.session_id]) {
        sessionMap[row.session_id] = {
          session_id:    row.session_id,
          message_count: 0,
          user_messages: 0,
          last_activity: row.created_at,
          first_activity: row.created_at,
        }
      }
      const entry = sessionMap[row.session_id]
      entry.message_count++
      if (row.role === 'user') entry.user_messages++
      if (row.created_at > entry.last_activity)  entry.last_activity  = row.created_at
      if (row.created_at < entry.first_activity) entry.first_activity = row.created_at
    }

    const sessions = Object.values(sessionMap).sort(
      (a, b) => b.last_activity.localeCompare(a.last_activity)
    )

    return res.json({ success: true, data: sessions })
  }

  // ── DELETE: wis één gesprek ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!sessionFilter) return res.status(400).json({ success: false, message: 'session parameter ontbreekt' })

    const { error } = await supabase
      .from(T('chat_messages'))
      .delete()
      .eq('session_id', sessionFilter)

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.json({ success: true, message: 'Gesprek gewist.' })
  }

  res.status(405).json({ success: false })
}
