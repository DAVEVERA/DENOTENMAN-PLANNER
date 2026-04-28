/**
 * pages/api/chat.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * D'n Dave — hoofd-chat API
 *
 * POST /api/chat  — stuur een bericht, ontvang antwoord (+ tool-uitvoer)
 * GET  /api/chat  — haal chatgeschiedenis op
 * DELETE /api/chat — wis chatgeschiedenis van huidige sessie
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth'
import { supabase, T } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/dave-config'
import { getToolsForRole, executeTool } from '@/lib/dave-tools'
import { getISOWeek } from '@/lib/scheduler'
import { DAVE_MAX_CONTEXT_MESSAGES } from '@/lib/dave-config'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadHistory(sessionId: string, limit = DAVE_MAX_CONTEXT_MESSAGES) {
  const { data } = await supabase
    .from(T('chat_messages'))
    .select('role, content, tool_name, tool_input, tool_result')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).reverse()
}

async function saveMessage(
  sessionId: string,
  role: string,
  content: string,
  extra?: { tool_name?: string; tool_input?: unknown; tool_result?: unknown }
) {
  await supabase.from(T('chat_messages')).insert({
    session_id:  sessionId,
    role,
    content,
    tool_name:   extra?.tool_name   ?? null,
    tool_input:  extra?.tool_input  ?? null,
    tool_result: extra?.tool_result ?? null,
  })
}

/** Bouw Anthropic message array op uit database-rijen */
function buildMessages(history: Awaited<ReturnType<typeof loadHistory>>, newUserMessage: string): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []

  for (const row of history) {
    if (row.role === 'user') {
      msgs.push({ role: 'user', content: row.content })
    } else if (row.role === 'assistant') {
      msgs.push({ role: 'assistant', content: row.content })
    }
    // tool-resultaten worden niet apart toegevoegd — zitten al in assistant-berichten
  }

  // Voeg het nieuwe bericht toe
  msgs.push({ role: 'user', content: newUserMessage })
  return msgs
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })

  const { user } = session
  const sessionId = user.user_id

  // ── GET: geschiedenis ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from(T('chat_messages'))
      .select('id, role, content, tool_name, tool_result, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.json({ success: true, data: data ?? [] })
  }

  // ── DELETE: wis gesprek ──────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await supabase.from(T('chat_messages')).delete().eq('session_id', sessionId)
    return res.json({ success: true, message: 'Gesprek gewist.' })
  }

  // ── POST: stuur bericht ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { message } = req.body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Geen bericht ontvangen.' })
    }

    const trimmed = message.trim()

    // Sla gebruikersbericht op
    await saveMessage(sessionId, 'user', trimmed)

    // Bouw context op
    const history = await loadHistory(sessionId, DAVE_MAX_CONTEXT_MESSAGES)
    const now = new Date()
    const systemPrompt = buildSystemPrompt(user.role, {
      currentWeek: getISOWeek(now),
      currentYear: now.getFullYear(),
      userName:    user.display_name,
    })
    const tools = getToolsForRole(user.role)
    const messages = buildMessages(history.slice(0, -1), trimmed) // slice: nieuwste al in history, exclude het

    // Houd tool-uitvoer bij voor respons
    const toolCalls: { name: string; input: unknown; result: unknown }[] = []
    let assistantText = ''

    try {
      // Agentic loop: Claude kan meerdere tools achter elkaar aanroepen
      let loopMessages = [...messages]
      let iterations = 0
      const MAX_ITERATIONS = 6

      while (iterations < MAX_ITERATIONS) {
        iterations++

        const response = await anthropic.messages.create({
          model:      'claude-sonnet-4-5',
          max_tokens: 1024,
          system:     systemPrompt,
          tools,
          messages:   loopMessages,
        })

        // Verzamel tekst uit content-blokken
        const textBlocks = response.content.filter(b => b.type === 'text')
        const toolBlocks = response.content.filter(b => b.type === 'tool_use')

        if (textBlocks.length > 0) {
          assistantText = textBlocks.map(b => (b as Anthropic.TextBlock).text).join('\n')
        }

        // Klaar als er geen tools meer zijn, of stop_reason = end_turn
        if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') {
          break
        }

        // Voer alle tools uit en bouw tool_results op
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of toolBlocks) {
          const tb = block as Anthropic.ToolUseBlock
          const result = await executeTool(tb.name, tb.input as Record<string, unknown>, user)
          const resultStr = JSON.stringify(result)

          toolCalls.push({ name: tb.name, input: tb.input, result })

          // Sla tool-aanroep op in DB
          await saveMessage(sessionId, 'tool', resultStr, {
            tool_name:   tb.name,
            tool_input:  tb.input,
            tool_result: result,
          })

          toolResults.push({
            type:        'tool_result',
            tool_use_id: tb.id,
            content:     resultStr,
          })
        }

        // Voeg assistent-turn + tool-resultaten toe aan context voor volgende iteratie
        loopMessages = [
          ...loopMessages,
          { role: 'assistant', content: response.content },
          { role: 'user',      content: toolResults },
        ]
      }

      // Sla assistent-antwoord op
      if (assistantText) {
        await saveMessage(sessionId, 'assistant', assistantText)
      }

      return res.json({
        success:    true,
        message:    assistantText,
        tool_calls: toolCalls,
      })

    } catch (err: any) {
      console.error('[dave] Anthropic error:', err)
      return res.status(500).json({
        success: false,
        message: 'Da ging ff mis bij D\'n Dave. Probeer nog eens.',
      })
    }
  }

  res.status(405).json({ success: false })
}
