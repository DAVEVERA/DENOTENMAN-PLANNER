/**
 * pages/api/chat.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Support — hoofd-chat API
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
import { hasSameOrigin } from '@/lib/request-security'

// ── Lazy Anthropic client ────────────────────────────────────────────────────
// Instantiated on first request, after the ANTHROPIC_API_KEY guard has run.
let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

// ── Per-user rate limiting ────────────────────────────────────────────────────
// Allows up to MAX_MSG messages per WINDOW_MS per user_id (in-memory).
const chatRateMap = new Map<string, { count: number; resetAt: number }>()
const CHAT_MAX_MSG  = 20
const CHAT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function isChatRateLimited(userId: string): boolean {
  const now   = Date.now()
  const entry = chatRateMap.get(userId)
  if (!entry || now > entry.resetAt) return false
  return entry.count >= CHAT_MAX_MSG
}

function recordChatMessage(userId: string): void {
  const now   = Date.now()
  const entry = chatRateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    chatRateMap.set(userId, { count: 1, resetAt: now + CHAT_WINDOW_MS })
  } else {
    entry.count++
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2_000  // chars per user message
const MAX_TOOL_RESULT_LEN = 8_000 // chars stored per tool-result in DB

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadHistory(sessionId: string, limit = DAVE_MAX_CONTEXT_MESSAGES) {
  const { data } = await supabase
    .from(T('chat_messages'))
    .select('role, content, tool_name, tool_input, tool_result')
    .eq('session_id', sessionId)
    .is('archived_at', null)
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

/** Bouw Anthropic message array op uit database-rijen.
 *
 * Werkwijze:
 *  - user-rijen   → {role:'user', content: string}
 *  - tool-rijen   → samengesteld als assistant tool_use + user tool_result paar
 *  - assistant-rijen → {role:'assistant', content: string}
 *
 * Opeenvolgende tool-rijen (meerdere tools in één agentic iteratie) worden als
 * één assistant-turn + één user-turn gegroepeerd, wat de Anthropic API vereist.
 * Synthetische IDs worden aangemaakt (toolu_h{i}_{j}) — die hoeven niet
 * overeen te komen met de originele Anthropic IDs, zolang ze intern consistent zijn.
 */
function buildMessages(history: Awaited<ReturnType<typeof loadHistory>>, newUserMessage: string): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = []
  let i = 0

  while (i < history.length) {
    const row = history[i]

    if (row.role === 'user') {
      msgs.push({ role: 'user', content: row.content })
      i++

    } else if (row.role === 'tool') {
      // Groepeer opeenvolgende tool-rijen (= één agentic iteratie)
      const groupStart = i
      const toolRows: typeof history = []
      while (i < history.length && history[i].role === 'tool') {
        toolRows.push(history[i])
        i++
      }

      // Assistant-turn: één tool_use block per tool-aanroep
      const toolUseBlocks = toolRows.map((t, j) => ({
        type:  'tool_use' as const,
        id:    `toolu_h${groupStart}_${j}`,  // synthetisch maar intern consistent
        name:  t.tool_name ?? 'unknown_tool',
        input: (t.tool_input as Record<string, unknown>) ?? {},
      })) as Anthropic.ToolUseBlock[]
      msgs.push({ role: 'assistant', content: toolUseBlocks })

      // User-turn: tool_result per tool-aanroep
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = toolRows.map((t, j) => ({
        type:        'tool_result',
        tool_use_id: `toolu_h${groupStart}_${j}`,
        content:     typeof t.tool_result === 'string'
          ? t.tool_result
          : JSON.stringify(t.tool_result ?? {}),
      }))
      msgs.push({ role: 'user', content: toolResultBlocks })

    } else if (row.role === 'assistant') {
      msgs.push({ role: 'assistant', content: row.content })
      i++

    } else {
      i++ // sla onbekende roles over
    }
  }

  // Voeg het nieuwe gebruikersbericht toe
  msgs.push({ role: 'user', content: newUserMessage })
  return msgs
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false, message: 'Niet ingelogd' })
  const user = session.user
  if (user.role === 'inspector') return res.status(403).json({ success: false, message: 'Geen toegang' })
  if (req.method !== 'GET' && !hasSameOrigin(req)) {
    return res.status(403).json({ success: false, message: 'Ongeldige herkomst' })
  }

  // Guard: ANTHROPIC_API_KEY must be set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY is not set')
    return res.status(500).json({ success: false, message: 'Support is niet geconfigureerd (API-sleutel ontbreekt).' })
  }

  const sessionId = user.user_id

  // ── GET: geschiedenis ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from(T('chat_messages'))
      .select('id, role, content, tool_name, tool_result, created_at')
      .eq('session_id', sessionId)
      .is('archived_at', null)
    .order('created_at', { ascending: true })
      .limit(100)

    if (error) return res.status(500).json({ success: false, message: error.message })
    return res.json({ success: true, data: data ?? [] })
  }

  // ── DELETE: wis gesprek ──────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { error } = await supabase.from(T('chat_messages'))
      .update({ archived_at: new Date().toISOString(), archived_by: user.user_id })
      .eq('session_id', sessionId)
      .is('archived_at', null)
    if (error) {
      console.error('[chat] archive conversation failed:', error.message)
      return res.status(500).json({ success: false, message: 'Gesprek kon niet veilig worden gearchiveerd.' })
    }
    return res.json({ success: true, message: 'Gesprek gearchiveerd.' })
  }

  // ── POST: stuur bericht ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { message } = req.body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Geen bericht ontvangen.' })
    }

    // Rate limit per user
    if (isChatRateLimited(user.user_id)) {
      return res.status(429).json({
        success: false,
        message: 'Je stuurt te snel berichten. Wacht even en probeer opnieuw.',
      })
    }
    recordChatMessage(user.user_id)

    // Lengte-check
    const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'Geen bericht ontvangen.' })
    }

    // Laad historiek VÓÓR opslaan van het nieuwe bericht (zodat buildMessages geen slice nodig heeft)
    const history = await loadHistory(sessionId, DAVE_MAX_CONTEXT_MESSAGES)

    // Sla gebruikersbericht op
    await saveMessage(sessionId, 'user', trimmed)

    // Bouw context op
    const now = new Date()
    const systemPrompt = buildSystemPrompt(user.role, {
      currentWeek: getISOWeek(now),
      currentYear: now.getFullYear(),
      userName:    user.display_name,
    })
    const tools    = getToolsForRole(user.role)
    const messages = buildMessages(history, trimmed)

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

        const response = await getAnthropic().messages.create({
          model:      'claude-3-5-sonnet-20241022',
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
          // Truncate for DB storage to avoid bloat; full result goes to Anthropic
          const resultDb = resultStr.length > MAX_TOOL_RESULT_LEN
            ? resultStr.slice(0, MAX_TOOL_RESULT_LEN) + '…'
            : resultStr

          toolCalls.push({ name: tb.name, input: tb.input, result })

          // Sla tool-aanroep op in DB
          await saveMessage(sessionId, 'tool', resultDb, {
            tool_name:   tb.name,
            tool_input:  tb.input,
            tool_result: result,
          })

          toolResults.push({
            type:        'tool_result',
            tool_use_id: tb.id,
            content:     resultStr, // volledige resultaat naar Anthropic
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

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[chat] error:', errMsg)
      // In development expose the real error; in production return a friendly message
      const clientMsg = process.env.NODE_ENV === 'development'
        ? `Support-fout: ${errMsg}`
        : 'Da ging ff mis bij Support. Probeer nog eens.'
      return res.status(500).json({ success: false, message: clientMsg })
    }
  }

  res.status(405).json({ success: false })
}
