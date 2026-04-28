import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser } from '@/types'
import Spinner from '@/components/ui/Spinner'
import { DAVE_AVATAR_URL, DAVE_NAME } from '@/lib/dave-config'

interface Props { user: SessionUser }

interface ChatSession {
  session_id:     string
  message_count:  number
  user_messages:  number
  last_activity:  string
  first_activity: string
}

interface ChatMessage {
  id:          number
  role:        'user' | 'assistant' | 'tool'
  content:     string
  tool_name:   string | null
  tool_result: unknown
  created_at:  string
}

const TOOL_LABELS: Record<string, string> = {
  plan_shift:          '📅 Dienst gepland',
  create_open_shift:   '📋 Open dienst aangemaakt',
  get_schedule:        '📆 Rooster opgehaald',
  get_employees:       '👥 Medewerkers opgehaald',
  approve_leave:       '✅ Verlof verwerkt',
  get_leave_requests:  '📩 Verlofaanvragen opgehaald',
  save_workflow:       '💾 Workflow opgeslagen',
  get_insights:        '📊 Inzichten opgehaald',
  get_my_schedule:     '📅 Rooster opgehaald',
  get_open_shifts_list:'📋 Open diensten opgehaald',
  request_leave:       '✉️ Verlof aangevraagd',
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('nl-NL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatLogsPage({ user }: Props) {
  const [sessions,         setSessions]         = useState<ChatSession[]>([])
  const [sessionsLoading,  setSessionsLoading]  = useState(true)
  const [activeSession,    setActiveSession]    = useState<string | null>(null)
  const [messages,         setMessages]         = useState<ChatMessage[]>([])
  const [messagesLoading,  setMessagesLoading]  = useState(false)
  const [search,           setSearch]           = useState('')
  const [deleting,         setDeleting]         = useState<string | null>(null)

  // Laad sessie-overzicht
  useEffect(() => {
    fetch('/api/admin/chat-logs')
      .then(r => r.json())
      .then(d => { if (d.success) setSessions(d.data) })
      .catch(() => {})
      .finally(() => setSessionsLoading(false))
  }, [])

  // Laad berichten van geselecteerde sessie
  const loadMessages = useCallback((sid: string) => {
    setActiveSession(sid)
    setMessagesLoading(true)
    fetch(`/api/admin/chat-logs?session=${encodeURIComponent(sid)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setMessages(d.data) })
      .catch(() => {})
      .finally(() => setMessagesLoading(false))
  }, [])

  // Wis gesprek
  async function deleteSession(sid: string) {
    if (!confirm(`Gesprek van "${sid}" wissen? Dit kan niet ongedaan gemaakt worden.`)) return
    setDeleting(sid)
    try {
      await fetch(`/api/admin/chat-logs?session=${encodeURIComponent(sid)}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.session_id !== sid))
      if (activeSession === sid) { setActiveSession(null); setMessages([]) }
    } catch {}
    setDeleting(null)
  }

  const filteredSessions = sessions.filter(s =>
    s.session_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout user={user} title="Support — Gesprekken">

      <div className="chat-logs-layout">

        {/* ── Zijbalk: sessie-lijst ── */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <div className="dave-mini-avatar">
              {DAVE_AVATAR_URL
                ? <img src={DAVE_AVATAR_URL} alt={DAVE_NAME} />
                : <span>🎩</span>
              }
            </div>
            <div>
              <div className="sidebar-title">{DAVE_NAME}</div>
              <div className="sidebar-sub">{sessions.length} gesprekken</div>
            </div>
          </div>

          <input
            className="sidebar-search"
            type="search"
            placeholder="Zoek gebruiker…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Zoek op gebruikersnaam"
            id="chat-logs-search"
          />

          {sessionsLoading ? (
            <div className="sidebar-loading"><Spinner /> Laden…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="sidebar-empty">
              {search ? 'Geen gebruikers gevonden.' : 'Nog geen gesprekken.'}
            </div>
          ) : (
            <ul className="session-list" role="listbox" aria-label="Gesprekken">
              {filteredSessions.map(s => (
                <li
                  key={s.session_id}
                  className={`session-item${activeSession === s.session_id ? ' active' : ''}`}
                  role="option"
                  aria-selected={activeSession === s.session_id ? 'true' : 'false'}
                  onClick={() => loadMessages(s.session_id)}
                  id={`session-${s.session_id}`}
                >
                  <div className="session-avatar">
                    {s.session_id.charAt(0).toUpperCase()}
                  </div>
                  <div className="session-info">
                    <div className="session-name">{s.session_id}</div>
                    <div className="session-meta">
                      <span className="meta-pill">{s.user_messages} vragen</span>
                      <span className="meta-time">{fmt(s.last_activity)}</span>
                    </div>
                  </div>
                  <button
                    className="session-del-btn"
                    onClick={e => { e.stopPropagation(); deleteSession(s.session_id) }}
                    disabled={deleting === s.session_id}
                    aria-label={`Gesprek van ${s.session_id} wissen`}
                    title="Gesprek wissen"
                  >
                    {deleting === s.session_id ? '…' : '🗑'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Hoofd: gespreks-view ── */}
        <main className="chat-main">
          {!activeSession ? (
            <div className="chat-empty-state">
              <div className="empty-icon">
                {DAVE_AVATAR_URL
                  ? <img src={DAVE_AVATAR_URL} alt={DAVE_NAME} className="empty-dave-img" />
                  : '🎩'
                }
              </div>
              <div className="empty-title">Kies een gesprek</div>
              <div className="empty-sub">Klik op een gebruiker aan de linkerkant om het gesprek te bekijken.</div>
            </div>
          ) : (
            <>
              {/* Header van het gesprek */}
              <div className="convo-header">
                <div className="convo-avatar">{activeSession.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="convo-name">{activeSession}</div>
                  <div className="convo-meta">
                    {messages.filter(m => m.role !== 'tool').length} berichten
                    {messages.length > 0 && ` · ${fmt(messages[0].created_at)} t/m ${fmt(messages[messages.length - 1].created_at)}`}
                  </div>
                </div>
                <button
                  className="btn btn-danger-sm"
                  onClick={() => deleteSession(activeSession)}
                  id="convo-delete-btn"
                  title="Volledig gesprek wissen"
                >
                  🗑 Wis gesprek
                </button>
              </div>

              {/* Berichten */}
              {messagesLoading ? (
                <div className="convo-loading"><Spinner /> Berichten laden…</div>
              ) : messages.length === 0 ? (
                <div className="convo-empty">Geen berichten gevonden.</div>
              ) : (
                <div className="convo-messages" role="log" aria-label="Gesprek berichten">
                  {messages
                    .filter(m => m.role !== 'tool') // tool-berichten tonen we als kaartje
                    .map(msg => (
                      <div key={msg.id} className={`log-msg ${msg.role}`}>
                        <div className="log-meta">
                          {msg.role === 'assistant' ? (
                            <span className="log-sender dave">
                              {DAVE_AVATAR_URL
                                ? <img src={DAVE_AVATAR_URL} alt="" className="log-dave-img" />
                                : '🎩 '
                              }
                              {DAVE_NAME}
                            </span>
                          ) : (
                            <span className="log-sender user">👤 {activeSession}</span>
                          )}
                          <span className="log-time">{fmtTime(msg.created_at)}</span>
                        </div>
                        <div className={`log-bubble ${msg.role}`}>
                          {msg.content
                            ? msg.content.split('\n').map((line, i, arr) => (
                              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                            ))
                            : <em className="tool-action-label">[Actie uitgevoerd]</em>
                          }
                        </div>
                      </div>
                    ))
                  }

                  {/* Tool-acties samenvatting onderaan */}
                  {messages.some(m => m.role === 'tool') && (
                    <div className="tool-summary">
                      <div className="tool-summary-title">🔧 Uitgevoerde acties in dit gesprek</div>
                      <div className="tool-chips">
                        {messages
                          .filter(m => m.role === 'tool' && m.tool_name)
                          .map((m, i) => (
                            <span key={i} className="tool-chip">
                              {TOOL_LABELS[m.tool_name!] ?? m.tool_name}
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        /* Layout */
        .chat-logs-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 0;
          height: calc(100vh - 120px);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        /* Zijbalk */
        .chat-sidebar {
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          background: var(--surface-alt);
          overflow: hidden;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, #1A1412, #2D1F14);
        }
        .dave-mini-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--brand);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid rgba(200,136,42,.4);
        }
        .dave-mini-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-title { font-size: .9375rem; font-weight: 700; color: #fff; }
        .sidebar-sub { font-size: .6875rem; color: rgba(255,255,255,.5); }

        .sidebar-search {
          margin: 12px;
          padding: 8px 12px;
          background: var(--surface);
          border: 1.5px solid var(--border-strong);
          border-radius: var(--r2);
          font-size: .875rem;
          color: var(--text);
          outline: none;
          transition: border-color .15s;
        }
        .sidebar-search:focus { border-color: var(--brand); }

        .sidebar-loading, .sidebar-empty {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px;
          font-size: .875rem;
          color: var(--text-muted);
        }

        .session-list {
          list-style: none;
          margin: 0;
          padding: 0 8px 8px;
          overflow-y: auto;
          flex: 1;
        }
        .session-list::-webkit-scrollbar { width: 4px; }
        .session-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        .session-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: var(--r2);
          cursor: pointer;
          transition: background .15s;
          position: relative;
        }
        .session-item:hover { background: var(--surface); }
        .session-item.active {
          background: var(--brand-subtle);
          border: 1px solid rgba(200,136,42,.2);
        }

        .session-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--brand);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .875rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .session-info { flex: 1; min-width: 0; }
        .session-name {
          font-size: .875rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .session-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }
        .meta-pill {
          font-size: .6875rem;
          background: var(--border);
          padding: 1px 6px;
          border-radius: var(--r-pill);
          color: var(--text-sub);
        }
        .meta-time {
          font-size: .6875rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-del-btn {
          opacity: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: .875rem;
          color: var(--text-muted);
          padding: 4px;
          border-radius: var(--r1);
          transition: opacity .15s, background .15s, color .15s;
          flex-shrink: 0;
        }
        .session-item:hover .session-del-btn { opacity: 1; }
        .session-del-btn:hover { background: var(--danger-bg); color: var(--danger); }

        /* Hoofd gesprek-view */
        .chat-main {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--surface);
        }

        .chat-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
        }
        .empty-icon { font-size: 3rem; }
        .empty-title { font-size: 1.125rem; font-weight: 700; color: var(--text); }
        .empty-sub { font-size: .875rem; max-width: 280px; text-align: center; line-height: 1.5; }

        .convo-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-alt);
          flex-shrink: 0;
        }
        .convo-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--brand);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .convo-name { font-size: 1rem; font-weight: 700; color: var(--text); }
        .convo-meta { font-size: .75rem; color: var(--text-muted); }
        .btn-danger-sm {
          margin-left: auto;
          padding: 6px 14px;
          background: var(--danger-bg);
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--r2);
          font-size: .8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s;
        }
        .btn-danger-sm:hover { background: var(--danger); color: #fff; }

        .convo-loading, .convo-empty {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 24px;
          color: var(--text-muted);
          font-size: .875rem;
        }

        .convo-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .convo-messages::-webkit-scrollbar { width: 4px; }
        .convo-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        /* Bericht-rijen */
        .log-msg { display: flex; flex-direction: column; gap: 4px; }
        .log-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .6875rem;
        }
        .log-sender { font-weight: 600; display: flex; align-items: center; }
        .log-sender.dave { color: var(--brand-dark); }
        .log-sender.user { color: var(--text-sub); }
        .log-time { color: var(--text-muted); }

        .log-bubble {
          padding: 10px 14px;
          border-radius: var(--r2);
          font-size: .875rem;
          line-height: 1.55;
          max-width: 80%;
          word-break: break-word;
        }
        .log-bubble.user {
          background: var(--brand);
          color: #fff;
          align-self: flex-end;
          border-radius: 12px 4px 12px 12px;
          margin-left: auto;
        }
        .log-bubble.assistant {
          background: var(--surface-alt);
          border: 1px solid var(--border);
          color: var(--text);
          align-self: flex-start;
          border-radius: 4px 12px 12px 12px;
        }

        /* Tool-acties overzicht */
        .tool-summary {
          margin-top: 8px;
          padding: 12px 16px;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-left: 3px solid var(--brand);
          border-radius: var(--r2);
        }
        .tool-summary-title {
          font-size: .75rem;
          font-weight: 600;
          color: var(--text-sub);
          margin-bottom: 8px;
        }
        .tool-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .tool-chip {
          padding: 3px 10px;
          background: var(--brand-subtle);
          border: 1px solid rgba(200,136,42,.2);
          border-radius: var(--r-pill);
          font-size: .75rem;
          color: var(--brand-dark);
          font-weight: 500;
        }

        /* Inline-style vervangingen */
        .empty-dave-img {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--brand);
        }
        .log-dave-img {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          object-fit: cover;
          vertical-align: middle;
          margin-right: 4px;
        }
        .tool-action-label {
          color: var(--text-muted);
          font-size: .8125rem;
        }

        @media (max-width: 768px) {
          .chat-logs-layout { grid-template-columns: 1fr; height: auto; }
          .chat-sidebar { max-height: 40vh; }
          .chat-main { min-height: 60vh; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user || session.user.role !== 'admin') {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: { user: session.user } }
}
