/**
 * components/ui/DaveChat.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Support — floating AI-chat component
 *
 * Floating knop rechts onderin → klikken opent het chat-paneel.
 * Berichten worden opgeslagen in Supabase en herladen bij open.
 * Avatar instellen: lib/dave-config.ts → DAVE_AVATAR_URL
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { DAVE_AVATAR_URL, DAVE_NAME } from '@/lib/dave-config'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolCall {
  name: string
  result: {
    success: boolean
    message?: string
    [key: string]: unknown
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  tool_calls?: ToolCall[]
  created_at: string
}

// ── Tool-naam → leesbare label ────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  plan_shift:          '📅 Dienst gepland',
  create_open_shift:   '📋 Open dienst aangemaakt',
  get_schedule:        '📆 Rooster opgehaald',
  get_employees:       '👥 Medewerkers opgehaald',
  approve_leave:       '✅ Verlof verwerkt',
  get_leave_requests:  '📩 Verlofaanvragen opgehaald',
  save_workflow:       '💾 Workflow opgeslagen',
  get_insights:        '📊 Inzichten opgehaald',
  get_my_schedule:     '📅 Jouw rooster opgehaald',
  get_open_shifts_list:'📋 Open diensten opgehaald',
  request_leave:       '✉️ Verlof aangevraagd',
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function DaveAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'dave-avatar' : 'dave-msg-avatar'
  return (
    <div className={cls}>
      {DAVE_AVATAR_URL
        ? <img src={DAVE_AVATAR_URL} alt={DAVE_NAME} />
        : <span>🎩</span>
      }
    </div>
  )
}

// ── Timestamp formattering ─────────────────────────────────────────────────────

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

// ── Quick-chips voor admins ───────────────────────────────────────────────────

const ADMIN_QUICK: { label: string; msg: string }[] = [
  { label: '📅 Rooster deze week', msg: 'Laat me het rooster zien van deze week.' },
  { label: '👥 Medewerkers', msg: 'Geef een lijst van alle actieve medewerkers.' },
  { label: '📩 Verlofaanvragen', msg: 'Welke verlofaanvragen staan nog open?' },
  { label: '📊 Bezetting', msg: 'Geef me een bezettingsoverzicht voor deze week.' },
]

const EMPLOYEE_QUICK: { label: string; msg: string }[] = [
  { label: '📅 Mijn rooster', msg: 'Wat staat er deze week in mijn rooster?' },
  { label: '🔓 Open diensten', msg: 'Welke open diensten zijn er beschikbaar?' },
  { label: '✉️ Verlof aanvragen', msg: 'Ik wil verlof aanvragen.' },
]

// ── Hoofd component ───────────────────────────────────────────────────────────

export default function DaveChat() {
  const [open, setOpen]       = useState(false)
  const [closing, setClosing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)

  // Scroll naar onderste bericht
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, loading])

  // Laad chatgeschiedenis (eenmalig bij openen)
  useEffect(() => {
    if (!open || historyLoaded) return
    setHistoryLoaded(true)

    fetch('/api/chat')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          const loaded = data.data
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({
              id:          String(m.id),
              role:        m.role,
              content:     m.content,
              created_at:  m.created_at,
            }))
          setMessages(loaded)
        }
      })
      .catch(() => {})

    // Controleer of admin (sessie-info ophalen via een simpel eindpunt)
    fetch('/api/session')
      .then(r => r.json())
      .then(d => { if (d.user) setIsAdmin(d.user.role === 'admin' || d.user.role === 'manager') })
      .catch(() => {})
  }, [open, historyLoaded])

  // Paneel sluiten met animatie
  function closePanel() {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 160)
  }
  function togglePanel() {
    if (open) closePanel()
    else setOpen(true)
  }

  // Textarea auto-groeien
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  // Bericht verzenden
  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    setInput('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    const userMsg: ChatMessage = {
      id:         Date.now().toString(),
      role:       'user',
      content:    msg,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      })
      const data = await res.json()

      if (data.success) {
        const assistantMsg: ChatMessage = {
          id:         Date.now().toString() + '_a',
          role:       'assistant',
          content:    data.message || '',
          tool_calls: data.tool_calls || [],
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        setMessages(prev => [...prev, {
          id:         Date.now().toString() + '_err',
          role:       'error',
          content:    data.message || 'Da ging ff mis. Probeer nog eens.',
          created_at: new Date().toISOString(),
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id:         Date.now().toString() + '_err',
        role:       'error',
        content:    'Geen verbinding. Ververs de pagina en probeer opnieuw.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  // Wis gesprek
  async function clearChat() {
    if (!confirm('Gesprek wissen? Alle berichten worden verwijderd.')) return
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
    setHistoryLoaded(false)
  }

  // Enter = verzenden (Shift+Enter = newline)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const quickChips = isAdmin ? ADMIN_QUICK : EMPLOYEE_QUICK

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Puls-ring */}
      {!open && <div className="dave-fab-pulse" aria-hidden="true" />}

      {/* Floating knop */}
      <button
        className="dave-fab"
        onClick={togglePanel}
        aria-label={open ? "Sluit Support" : "Open Support"}
        title={DAVE_NAME}
        id="dave-fab-btn"
      >
        {open ? '✕' : (DAVE_AVATAR_URL ? <img src={DAVE_AVATAR_URL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} /> : '🎩')}
      </button>

      {/* Chat paneel */}
      {open && (
        <div className={`dave-panel${closing ? ' closing' : ''}`} role="dialog" aria-label="Support chat" id="dave-chat-panel">

          {/* Header */}
          <div className="dave-header">
            <DaveAvatar size="md" />
            <div className="dave-header-info">
              <div className="dave-header-name">{DAVE_NAME}</div>
              <div className="dave-header-status">
                <span className="dave-status-dot" />
                <span>Online en klaar voor actie</span>
              </div>
            </div>
            <div className="dave-header-actions">
              <button className="dave-hdr-btn" onClick={clearChat} title="Gesprek wissen" aria-label="Gesprek wissen" id="dave-clear-btn">
                🗑️
              </button>
              <button className="dave-hdr-btn" onClick={closePanel} title="Sluiten" aria-label="Sluiten" id="dave-close-btn">
                ✕
              </button>
            </div>
          </div>

          {/* Berichten */}
          <div className="dave-messages" role="log" aria-live="polite" id="dave-messages">

            {/* Welkomst-scherm als gesprek leeg is */}
            {messages.length === 0 && !loading && (
              <div className="dave-welcome">
                <div className="dave-welcome-icon">
                  {DAVE_AVATAR_URL ? <img src={DAVE_AVATAR_URL} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand)' }} /> : '🎩'}
                </div>
                <div className="dave-welcome-title">Hé! Ik ben {DAVE_NAME}</div>
                <div className="dave-welcome-sub">
                  Stel me een vraag over de planner, of geef me een opdracht.
                </div>
              </div>
            )}

            {/* Berichtenlijst */}
            {messages.map(msg => {
              if (msg.role === 'error') {
                return (
                  <div key={msg.id} className="dave-msg dave">
                    <DaveAvatar />
                    <div>
                      <div className="dave-bubble dave-error-bubble">{msg.content}</div>
                      <div className="dave-ts">{fmt(msg.created_at)}</div>
                    </div>
                  </div>
                )
              }

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="dave-msg user">
                    <div>
                      <div className="dave-bubble user">{msg.content}</div>
                      <div className="dave-ts">{fmt(msg.created_at)}</div>
                    </div>
                  </div>
                )
              }

              // assistant
              return (
                <div key={msg.id} className="dave-msg dave">
                  <DaveAvatar />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tool-resultaat kaartjes (tonen vóór het antwoord) */}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {msg.tool_calls.map((tc, i) => (
                          <div key={i} className="dave-tool-card">
                            <div className="dave-tool-name">{TOOL_LABELS[tc.name] ?? tc.name}</div>
                            {tc.result?.message && <div>{tc.result.message}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="dave-bubble">
                        {msg.content.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < msg.content.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    <div className="dave-ts">{fmt(msg.created_at)}</div>
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {loading && (
              <div className="dave-msg dave">
                <DaveAvatar />
                <div className="dave-typing">
                  <div className="dave-typing-dots">
                    <div className="dave-typing-dot" />
                    <div className="dave-typing-dot" />
                    <div className="dave-typing-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick-chips */}
          {messages.length === 0 && (
            <div className="dave-quick" aria-label="Snelkoppelingen">
              {quickChips.map((chip, i) => (
                <button
                  key={i}
                  className="dave-quick-chip"
                  onClick={() => sendMessage(chip.msg)}
                  id={`dave-chip-${i}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Invoer */}
          <div className="dave-input-row">
            <textarea
              ref={textareaRef}
              className="dave-textarea"
              placeholder="Typ een vraag of opdracht…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
              aria-label="Bericht aan Support"
              id="dave-input"
            />
            <button
              className="dave-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Verzenden"
              id="dave-send-btn"
              title="Verzenden (of Enter)"
            >
              ➤
            </button>
          </div>

        </div>
      )}
    </>
  )
}
