import { ArrowLeft, Search, ShieldCheck, WifiOff, X } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { TeamMessage, TeamShiftSnapshot } from '../../lib/team-chat/repository'
import type { SessionUser } from '../../types'
import { useDialogFocus } from '../ui/useDialogFocus'
import ChatComposer from './ChatComposer'
import ConversationList from './ConversationList'
import ExchangeSheet from './ExchangeSheet'
import MessageTimeline from './MessageTimeline'
import PlanningWatchPanel from './PlanningWatchPanel'
import styles from './TeamChat.module.css'
import { useTeamChat } from './useTeamChat'

interface Props { user: SessionUser }

export default function ChatWorkspace({ user }: Props) {
  const router = useRouter()
  const routeConversation = Number(Array.isArray(router.query.conversation) ? router.query.conversation[0] : router.query.conversation)
  const routeShift = Number(Array.isArray(router.query.shift) ? router.query.shift[0] : router.query.shift)
  const preferredConversation = Number.isInteger(routeConversation) && routeConversation > 0 ? routeConversation : null
  const initialShiftId = Number.isInteger(routeShift) && routeShift > 0 ? routeShift : null
  const chat = useTeamChat(preferredConversation)
  const { activeConversationId, bootstrap, selectConversation: setActiveConversation } = chat
  const [mobileOpen, setMobileOpen] = useState(Boolean(preferredConversation || initialShiftId))
  const [exchangeShift, setExchangeShift] = useState<TeamShiftSnapshot | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TeamMessage[]>([])
  const [searching, setSearching] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const handledShiftRef = useRef<number | null>(null)
  const searchDialogRef = useRef<HTMLDivElement>(null)
  const watchDialogRef = useRef<HTMLElement>(null)
  useDialogFocus(searchOpen, searchDialogRef, () => setSearchOpen(false))
  useDialogFocus(watchOpen, watchDialogRef, () => setWatchOpen(false))

  const active = useMemo(
    () => bootstrap?.conversations.find(conversation => conversation.id === activeConversationId) ?? null,
    [activeConversationId, bootstrap?.conversations],
  )

  useEffect(() => {
    if (!initialShiftId || !bootstrap) return
    if (handledShiftRef.current === initialShiftId) return
    handledShiftRef.current = initialShiftId
    const nootschap = bootstrap.conversations.find(conversation => conversation.slug === 'nootschap')
    if (nootschap && activeConversationId !== nootschap.id) setActiveConversation(nootschap.id)
    setMobileOpen(true)
  }, [activeConversationId, bootstrap, initialShiftId, setActiveConversation])

  function selectConversation(id: number) {
    setActiveConversation(id)
    setMobileOpen(true)
    void router.replace({ pathname: '/me/chat', query: { conversation: id } }, undefined, { shallow: true })
  }

  function closeMobileConversation() {
    setMobileOpen(false)
    void router.replace('/me/chat', undefined, { shallow: true })
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    if (searchQuery.trim().length < 2) return
    setSearching(true)
    try {
      const response = await fetch(`/api/team-chat/search?q=${encodeURIComponent(searchQuery.trim())}`, { cache: 'no-store' })
      const payload = await response.json()
      setSearchResults(response.ok && payload.success ? payload.data : [])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={`${styles.workspace} ${mobileOpen ? styles.mobileConversationOpen : ''}`}>
      <ConversationList
        conversations={chat.bootstrap?.conversations ?? []}
        activeId={chat.activeConversationId}
        onSelect={selectConversation}
        onSearch={() => setSearchOpen(true)}
        emptyMessage={chat.error}
        loading={!chat.bootstrap}
      />

      <section className={styles.conversation} aria-label={active?.name ?? 'Gesprek'}>
        <header className={styles.conversationHeader}>
          <button type="button" className={`${styles.iconButton} ${styles.mobileBack}`} onClick={closeMobileConversation} aria-label="Terug naar gesprekken"><ArrowLeft size={21} /></button>
          <div className={styles.channelTitle}>
            <strong>{active?.name ?? 'Teamchat'}</strong>
            <span>{active?.description || 'Operationeel samenwerken'}</span>
          </div>
          <div className={styles.connection} data-state={chat.connectionState} role="status" aria-live="polite">
            {chat.connectionState === 'offline' || chat.connectionState === 'error' ? <WifiOff size={15} /> : <span className={styles.onlineDot} />}
            <span>{chat.connectionState === 'loading' ? 'Verbinden…' : chat.connectionState === 'online' ? 'Actueel' : chat.connectionState === 'offline' ? 'Offline' : 'Verbinding mislukt'}</span>
          </div>
          <button type="button" className={`${styles.iconButton} ${styles.mobileWatchButton}`} onClick={() => setWatchOpen(true)} aria-label="Planningwacht openen"><ShieldCheck size={19} /></button>
          <button type="button" className={styles.iconButton} onClick={() => setSearchOpen(true)} aria-label="Zoeken"><Search size={19} /></button>
        </header>

        {chat.error && (
          <button className={styles.connectionError} type="button" onClick={() => void chat.reload()}>
            <WifiOff size={17} /><span>{chat.error}</span><strong>Probeer opnieuw</strong>
          </button>
        )}

        {chat.bootstrap && active ? (
          <>
            <MessageTimeline
              messages={chat.messages}
              currentUserId={user.user_id}
              currentEmployeeId={user.employee_id}
              onRetry={nonce => void chat.retryMessage(nonce)}
              onVisible={chat.markRead}
              onExchange={setExchangeShift}
            />
            <ChatComposer
              initialShiftId={initialShiftId}
              employeeId={user.employee_id}
              location={user.location}
              disabled={chat.connectionState === 'offline'}
              onSend={chat.sendMessage}
            />
          </>
        ) : chat.connectionState === 'loading' ? (
          <div className={styles.chatLoading}><span /><span /><span /><p>Veilige teamchat laden…</p></div>
        ) : (
          <div className={styles.emptyTimeline}>
            <ShieldCheck size={30} />
            <h2>Chat is nog niet beschikbaar</h2>
            <p>{chat.error ?? 'De chatdatabase moet nog worden geactiveerd.'}</p>
            <button className={styles.primaryButton} type="button" onClick={() => void chat.reload()}>Opnieuw proberen</button>
          </div>
        )}
      </section>

      <PlanningWatchPanel
        onNavigate={conversationId => conversationId && selectConversation(conversationId)}
        onChanged={() => void chat.reload()}
      />

      {watchOpen && (
        <div className={styles.watchOverlay} role="presentation" onMouseDown={event => event.target === event.currentTarget && setWatchOpen(false)}>
          <section ref={watchDialogRef} className={styles.mobileWatchSheet} role="dialog" aria-modal="true" aria-label="Planningwacht" tabIndex={-1}>
            <PlanningWatchPanel
              onClose={() => setWatchOpen(false)}
              onNavigate={conversationId => {
                if (conversationId) selectConversation(conversationId)
                setWatchOpen(false)
              }}
              onChanged={() => void chat.reload()}
            />
          </section>
        </div>
      )}

      {exchangeShift && chat.activeConversationId && (
        <ExchangeSheet
          shift={exchangeShift}
          currentEmployeeId={user.employee_id}
          conversationId={chat.activeConversationId}
          onClose={() => setExchangeShift(null)}
          onCreated={() => void chat.reload()}
        />
      )}

      {searchOpen && (
        <div className={styles.searchOverlay} role="dialog" aria-modal="true" aria-labelledby="chat-search-title">
          <div ref={searchDialogRef} className={styles.searchPanel} tabIndex={-1}>
            <div className={styles.sheetHeader}>
              <div><p className={styles.eyebrow}>Alle kanalen</p><h2 id="chat-search-title">Berichten zoeken</h2></div>
              <button className={styles.iconButton} type="button" onClick={() => setSearchOpen(false)} aria-label="Zoeken sluiten"><X size={21} /></button>
            </div>
            <form className={styles.searchForm} onSubmit={search}>
              <Search size={19} />
              <input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Zoek op woorden…" aria-label="Zoekterm voor chatberichten" />
              <button type="submit" disabled={searchQuery.trim().length < 2 || searching}>{searching ? 'Zoekt…' : 'Zoek'}</button>
            </form>
            <div className={styles.searchResults}>
              {searchResults.map(message => (
                <button key={message.id} type="button" onClick={() => { selectConversation(message.conversation_id); setSearchOpen(false) }}>
                  <strong>{message.sender_display_name}</strong>
                  <span>{message.body || (message.shift ? `Dienst #${message.shift.shift_id}` : 'GIF')}</span>
                </button>
              ))}
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && <p>Geen berichten gevonden.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
