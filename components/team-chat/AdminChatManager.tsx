import { Archive, Check, Crown, Hash, MessageCircle, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ManagedConversation, ManagedConversationInput, TeamChatAccountOption, TeamChatAdminData } from '../../lib/team-chat/admin'

const EMPTY: ManagedConversationInput = {
  kind: 'group',
  name: '',
  member_user_ids: [],
  owner_user_ids: [],
  archived: false,
}

function ManagerStatus({ error, retry }: { error: string | null; retry?: () => void }) {
  return (
    <div className="chat-manager">
      <div className="manager-error" role={error ? 'alert' : 'status'}>
        <span>{error ?? 'Chatbeheer laden...'}</span>
        {retry && <button type="button" onClick={retry}>Opnieuw proberen</button>}
      </div>
      <style jsx>{`
        .chat-manager { max-width: 1060px; margin: 0 auto; }
        .manager-error { display: flex; min-height: 120px; align-items: center; justify-content: center; gap: 10px; padding: 20px; color: var(--danger); text-align: center; background: #fff1ed; border: 1px solid #ffd6ca; border-radius: 15px; }
        .manager-error span { max-width: 520px; line-height: 1.45; }
        .manager-error button { min-height: 44px; padding: 8px 12px; color: var(--text); background: #fff; border-radius: 10px; font-weight: 800; }
        @media (max-width: 700px) { .manager-error { align-items: stretch; flex-direction: column; text-align: left; } .manager-error button { width: 100%; } }
      `}</style>
    </div>
  )
}

export default function AdminChatManager() {
  const [data, setData] = useState<TeamChatAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<ManagedConversationInput | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingManagerId, setPendingManagerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/team-chat/conversations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.code)
      setData(payload.data)
      setError(null)
    } catch {
      setError('Chatbeheer is nu niet beschikbaar. Probeer het opnieuw of meld dit bij IT.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredAccounts = useMemo(() => {
    const query = memberQuery.trim().toLowerCase()
    return (data?.accounts ?? []).filter(account => !query
      || account.display_name.toLowerCase().includes(query)
      || account.user_id.toLowerCase().includes(query)
      || account.location?.toLowerCase().includes(query))
  }, [data?.accounts, memberQuery])

  function editConversation(conversation: ManagedConversation) {
    const active = conversation.members.filter(member => !member.inactive)
    setEditor({
      id: conversation.id,
      kind: conversation.kind === 'direct' ? 'direct' : 'group',
      name: conversation.name,
      member_user_ids: active.map(member => member.user_id),
      owner_user_ids: active.filter(member => member.role === 'owner').map(member => member.user_id),
      archived: conversation.archived,
    })
  }

  function toggleMember(userId: string) {
    if (!editor) return
    const selected = editor.member_user_ids.includes(userId)
    setEditor({
      ...editor,
      member_user_ids: selected ? editor.member_user_ids.filter(id => id !== userId) : [...editor.member_user_ids, userId],
      owner_user_ids: selected ? editor.owner_user_ids.filter(id => id !== userId) : editor.owner_user_ids,
    })
  }

  function toggleOwner(userId: string) {
    if (!editor || !editor.member_user_ids.includes(userId)) return
    const selected = editor.owner_user_ids.includes(userId)
    setEditor({ ...editor, owner_user_ids: selected ? editor.owner_user_ids.filter(id => id !== userId) : [...editor.owner_user_ids, userId] })
  }

  async function save() {
    if (!editor) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/team-chat/conversations', {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.code)
      setEditor(null)
      await load()
    } catch {
      setError('Opslaan mislukt. Er ging iets mis op de server — probeer het nogmaals.')
    } finally {
      setSaving(false)
    }
  }

  async function setManager(account: TeamChatAccountOption, active: boolean) {
    if (pendingManagerId) return
    setPendingManagerId(account.user_id)
    setError(null)
    try {
      const response = await fetch('/api/admin/team-chat/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: account.user_id, active }),
      })
      if (!response.ok) throw new Error('owner_toggle_failed')
      await load()
    } catch {
      setError(`${active ? 'Owner maken' : 'Owner verwijderen'} van ${account.display_name} is mislukt. Probeer het opnieuw.`)
    } finally {
      setPendingManagerId(null)
    }
  }

  if (loading) return <ManagerStatus error={null} />
  if (!data) return <ManagerStatus error={error} retry={() => void load()} />

  const fixed = data.conversations.filter(conversation => conversation.fixed)
  const custom = data.conversations.filter(conversation => !conversation.fixed)
  const validEditor = Boolean(editor
    && editor.name.trim().length >= 2
    && (editor.kind === 'direct' ? editor.member_user_ids.length === 2 : editor.member_user_ids.length >= 2)
    && editor.owner_user_ids.length >= 1)

  return (
    <div className="chat-manager">
      <header className="manager-head">
        <div><span className="manager-eyebrow">Veilige samenwerking</span><h1>Chatbeheer</h1><p>Beheer gesprekken en owners. Berichten en memberships worden nooit fysiek verwijderd.</p></div>
        <button className="create-button" type="button" onClick={() => setEditor({ ...EMPTY })}><Plus size={19} />Gesprek maken</button>
      </header>
      {error && <div className="manager-error" role="alert">{error}</div>}

      <section className="manager-section">
        <div className="section-title"><div><h2>Vaste kanalen</h2><p>Altijd actief en beschikbaar voor medewerkers.</p></div><ShieldCheck size={22} /></div>
        <div className="conversation-grid">
          {fixed.map(conversation => (
            <article key={conversation.id} className="conversation-card fixed">
              <span className="card-icon"><Hash size={20} /></span>
              <div><strong>{conversation.name}</strong><span>{conversation.members.filter(member => !member.inactive).length} leden · vast kanaal</span></div>
              <span className="locked-label">Beveiligd</span>
            </article>
          ))}
        </div>
      </section>

      <section className="manager-section">
        <div className="section-title"><div><h2>Privé- en groepsgesprekken</h2><p>Alleen admins en aangewezen owners kunnen deze aanmaken.</p></div><MessageCircle size={22} /></div>
        {custom.length === 0 ? <div className="empty-admin">Nog geen aanvullende gesprekken.</div> : (
          <div className="conversation-grid">
            {custom.map(conversation => (
              <button key={conversation.id} type="button" className="conversation-card custom" onClick={() => editConversation(conversation)}>
                <span className="card-icon">{conversation.kind === 'direct' ? <UserRound size={20} /> : <UsersRound size={20} />}</span>
                <div><strong>{conversation.name}</strong><span>{conversation.members.filter(member => !member.inactive).length} leden · {conversation.kind === 'direct' ? 'privé' : 'groep'}</span></div>
                <span className={conversation.archived ? 'status archived' : 'status active'}>{conversation.archived ? 'Gearchiveerd' : 'Actief'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {data.can_manage_owners && (
        <section className="manager-section">
          <div className="section-title"><div><h2>Chat-owners</h2><p>Owners mogen via dit portaal gesprekken maken en beheren.</p></div><Crown size={22} /></div>
          <div className="owner-list">
            {data.accounts.filter(account => account.role !== 'admin').map(account => (
              <div key={account.user_id} className="owner-row">
                <span className="mini-avatar">{account.display_name.slice(0,1).toUpperCase()}</span>
                <div><strong>{account.display_name}</strong><small>{account.location || 'Geen locatie'} · {account.user_id}</small></div>
                <button
                  type="button"
                  className={account.is_chat_manager ? 'owner-toggle active' : 'owner-toggle'}
                  onClick={() => void setManager(account, !account.is_chat_manager)}
                  aria-pressed={account.is_chat_manager}
                  disabled={pendingManagerId === account.user_id}
                >
                  {pendingManagerId === account.user_id
                    ? 'Bezig…'
                    : account.is_chat_manager ? <><Check size={16} /> Owner</> : 'Maak owner'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {editor && (
        <div className="editor-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setEditor(null)}>
          <section className="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="editor-handle" />
            <header><div><span>{editor.id ? 'Gesprek aanpassen' : 'Nieuw gesprek'}</span><h2 id="editor-title">{editor.name || 'Naamloos gesprek'}</h2></div><button type="button" onClick={() => setEditor(null)} aria-label="Sluiten"><X size={21} /></button></header>
            <div className="type-switch">
              <button type="button" className={editor.kind === 'direct' ? 'active' : ''} onClick={() => setEditor({ ...editor, kind: 'direct', member_user_ids: editor.member_user_ids.slice(0, 2), owner_user_ids: editor.owner_user_ids.filter(id => editor.member_user_ids.slice(0,2).includes(id)) })}><UserRound size={17} /> Privé</button>
              <button type="button" className={editor.kind === 'group' ? 'active' : ''} onClick={() => setEditor({ ...editor, kind: 'group' })}><UsersRound size={17} /> Groep</button>
            </div>
            <label className="editor-label">Naam<input value={editor.name} maxLength={80} onChange={event => setEditor({ ...editor, name: event.target.value })} placeholder="Bijvoorbeeld Markt zaterdag" /></label>
            <div className="member-head"><strong>Leden</strong><span>{editor.member_user_ids.length} geselecteerd</span></div>
            <label className="member-search"><Search size={18} /><input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Zoek medewerker…" /></label>
            <div className="member-list">
              {filteredAccounts.map(account => {
                const selected = editor.member_user_ids.includes(account.user_id)
                const owner = editor.owner_user_ids.includes(account.user_id)
                const directFull = editor.kind === 'direct' && editor.member_user_ids.length >= 2 && !selected
                return (
                  <div key={account.user_id} className={selected ? 'member-row selected' : 'member-row'}>
                    <button type="button" className="member-select" disabled={directFull} onClick={() => toggleMember(account.user_id)} aria-pressed={selected}>
                      <span className="check-box">{selected && <Check size={15} />}</span>
                      <span><strong>{account.display_name}</strong><small>{account.location || 'Geen locatie'} · {account.user_id}</small></span>
                    </button>
                    {selected && <button type="button" className={owner ? 'crown-button active' : 'crown-button'} onClick={() => toggleOwner(account.user_id)} aria-label={`${account.display_name} ${owner ? 'owner verwijderen' : 'owner maken'}`} aria-pressed={owner}><Crown size={18} /></button>}
                  </div>
                )
              })}
            </div>
            {editor.id && <button className="archive-button" type="button" onClick={() => setEditor({ ...editor, archived: !editor.archived })}><Archive size={17} />{editor.archived ? 'Gesprek heractiveren' : 'Gesprek archiveren (zonder verwijderen)'}</button>}
            <div className="editor-actions"><button type="button" onClick={() => setEditor(null)}>Annuleren</button><button type="button" className="save-button" disabled={!validEditor || saving} onClick={() => void save()}>{saving ? 'Veilig opslaan…' : 'Opslaan'}</button></div>
          </section>
        </div>
      )}

      <style jsx>{`
        .chat-manager { max-width: 1060px; margin: 0 auto; }
        .manager-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
        .manager-head h1 { margin: 3px 0 5px; font-size: clamp(1.55rem, 4vw, 2.1rem); }.manager-head p, .section-title p { margin: 0; color: var(--text-muted); font-size: .83rem; }.manager-eyebrow { color: #98703d; font-size: .68rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .create-button { display: inline-flex; min-height: 46px; align-items: center; gap: 8px; padding: 10px 15px; color: #fff; background: var(--brand); border-radius: 13px; font-weight: 800; white-space: nowrap; }
        .manager-section { margin-bottom: 28px; }.section-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; }.section-title h2 { margin: 0 0 3px; font-size: 1.03rem; }.section-title > svg { color: var(--brand); }
        .conversation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.conversation-card { display: flex; min-height: 76px; align-items: center; gap: 11px; padding: 12px; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; }.conversation-card.custom { width: 100%; }.conversation-card.custom:hover { border-color: var(--brand); }.card-icon { display: grid; width: 42px; min-width: 42px; height: 42px; place-items: center; color: var(--brand); background: var(--surface-alt); border-radius: 13px; }.conversation-card > div { display: flex; min-width: 0; flex: 1; flex-direction: column; }.conversation-card strong { overflow: hidden; font-size: .84rem; text-overflow: ellipsis; white-space: nowrap; }.conversation-card span:not(.card-icon) { margin-top: 4px; color: var(--text-muted); font-size: .68rem; }.locked-label, .status { margin-left: auto; padding: 5px 8px; border-radius: 999px; font-weight: 700; white-space: nowrap; }.locked-label, .status.active { color: #2c6e49 !important; background: #e9f2ec; }.status.archived { color: #805142 !important; background: #f5eae5; }
        .empty-admin { padding: 25px; color: var(--text-muted); text-align: center; background: var(--surface); border: 1px dashed var(--border); border-radius: 16px; }
        .owner-list { overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; }.owner-row { display: flex; min-height: 66px; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border); }.owner-row:last-child { border: 0; }.mini-avatar { display: grid; width: 38px; height: 38px; place-items: center; color: #fff; background: #7b4f2e; border-radius: 12px; font-weight: 800; }.owner-row > div { display: flex; min-width: 0; flex: 1; flex-direction: column; }.owner-row strong { font-size: .8rem; }.owner-row small { margin-top: 3px; color: var(--text-muted); font-size: .66rem; }.owner-toggle { display: inline-flex; min-height: 40px; align-items: center; gap: 5px; padding: 7px 10px; color: var(--text-sub); background: var(--surface-alt); border-radius: 10px; font-size: .7rem; font-weight: 800; }.owner-toggle.active { color: #815912; background: #fff2cf; }
        .manager-loading, .manager-error { display: flex; min-height: 120px; align-items: center; justify-content: center; gap: 10px; padding: 20px; color: var(--text-muted); background: var(--surface); border-radius: 15px; }.manager-error { min-height: auto; margin-bottom: 15px; color: var(--danger); background: #fff1ed; }.manager-error button { min-height: 40px; padding: 7px 10px; background: #fff; border-radius: 9px; }
        .editor-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 20px; background: rgba(22,16,13,.5); backdrop-filter: blur(5px); }.editor-sheet { width: min(100%, 620px); max-height: 92vh; max-height: 92dvh; padding: 18px; overflow: auto; background: #fff; border-radius: 24px; box-shadow: 0 20px 70px rgba(0,0,0,.24); }.editor-handle { width: 42px; height: 4px; margin: -6px auto 13px; background: #d4cbc4; border-radius: 99px; }.editor-sheet > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.editor-sheet header span { color: var(--text-muted); font-size: .68rem; }.editor-sheet h2 { margin: 2px 0 0; font-size: 1.2rem; }.editor-sheet header button { display: grid; width: 44px; height: 44px; place-items: center; background: var(--surface-alt); border-radius: 13px; }
        .type-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 16px 0; padding: 4px; background: var(--surface-alt); border-radius: 13px; }.type-switch button { display: flex; min-height: 44px; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; font-weight: 700; }.type-switch button.active { color: var(--brand); background: #fff; box-shadow: 0 2px 7px rgba(0,0,0,.07); }
        .editor-label { display: grid; gap: 6px; font-size: .75rem; font-weight: 800; }.editor-label input, .member-search input { min-height: 46px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 12px; font: inherit; }.member-head { display: flex; justify-content: space-between; margin: 17px 0 7px; font-size: .75rem; }.member-head span { color: var(--text-muted); }.member-search { display: flex; align-items: center; gap: 7px; padding-left: 11px; background: var(--surface-alt); border-radius: 12px; }.member-search input { min-width: 0; flex: 1; padding-left: 2px; background: transparent; border: 0; outline: 0; }
        .member-list { display: grid; max-height: 290px; gap: 5px; margin-top: 8px; overflow: auto; }.member-row { display: flex; min-height: 56px; align-items: center; padding: 4px 5px; background: #faf8f5; border: 1px solid transparent; border-radius: 12px; }.member-row.selected { border-color: #a8c1b0; background: #f2f7f4; }.member-select { display: flex; min-width: 0; flex: 1; align-items: center; gap: 9px; text-align: left; }.check-box { display: grid; width: 24px; min-width: 24px; height: 24px; place-items: center; color: #fff; background: #e0d8d1; border-radius: 7px; }.selected .check-box { background: var(--brand); }.member-select > span:last-child { display: flex; min-width: 0; flex-direction: column; }.member-select strong { font-size: .75rem; }.member-select small { margin-top: 2px; overflow: hidden; color: var(--text-muted); font-size: .63rem; text-overflow: ellipsis; white-space: nowrap; }.crown-button { display: grid; width: 42px; height: 42px; place-items: center; color: #a0958d; border-radius: 11px; }.crown-button.active { color: #946411; background: #fff0c8; }.archive-button { display: flex; min-height: 44px; align-items: center; gap: 7px; margin-top: 13px; padding: 8px 10px; color: #805142; background: #f8efeb; border-radius: 11px; font-size: .7rem; font-weight: 800; }
        .editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 17px; }.editor-actions button { min-height: 46px; padding: 9px 14px; background: var(--surface-alt); border-radius: 12px; font-weight: 800; }.editor-actions .save-button { color: #fff; background: var(--brand); }.editor-actions button:disabled { opacity: .45; }
        @media (max-width: 700px) { .manager-head { align-items: stretch; flex-direction: column; }.create-button { width: 100%; justify-content: center; }.conversation-grid { grid-template-columns: 1fr; }.editor-backdrop { padding: 0; }.editor-sheet { max-height: 95vh; max-height: 95dvh; padding: 18px 14px calc(18px + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; }.editor-actions { flex-direction: column-reverse; }.editor-actions button { width: 100%; min-height: 48px; }.owner-row { flex-wrap: wrap; }.owner-toggle { margin-left: 48px; } }
      `}</style>
    </div>
  )
}
