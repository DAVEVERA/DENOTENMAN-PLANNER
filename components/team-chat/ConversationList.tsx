import { Hash, MessageCircle, Search, ShieldCheck } from 'lucide-react'

import type { TeamConversationSummary } from '../../types/team-chat'
import styles from './TeamChat.module.css'

interface Props {
  conversations: TeamConversationSummary[]
  activeId: number | null
  onSelect(id: number): void
  onSearch(): void
  emptyMessage?: string | null
}

function relativeTime(value: string | null): string {
  if (!value) return ''
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'nu'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}u`
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export default function ConversationList({ conversations, activeId, onSelect, onSearch, emptyMessage }: Props) {
  return (
    <section className={styles.inbox} aria-label="Gesprekken">
      <div className={styles.inboxHeader}>
        <div>
          <p className={styles.eyebrow}>Samen plannen</p>
          <h1>Teamchat</h1>
        </div>
        <button className={styles.iconButton} type="button" onClick={onSearch} aria-label="Zoeken in berichten">
          <Search size={20} />
        </button>
      </div>

      <div className={styles.fixedNotice}>
        <ShieldCheck size={18} />
        <span>Vier vaste werkkanalen. Alleen beheer maakt andere gesprekken aan.</span>
      </div>

      <div className={styles.conversationItems}>
        {conversations.length === 0 && (
          <div className={styles.emptyInbox} role="status">
            <MessageCircle size={24} />
            <strong>Geen gesprekken geladen</strong>
            <span>{emptyMessage ?? 'Probeer het zo opnieuw.'}</span>
          </div>
        )}
        {conversations.map(conversation => (
          <button
            key={conversation.id}
            type="button"
            className={`${styles.conversationItem} ${conversation.id === activeId ? styles.activeConversation : ''}`}
            onClick={() => onSelect(conversation.id)}
            aria-current={conversation.id === activeId ? 'page' : undefined}
          >
            <span className={styles.conversationIcon} aria-hidden="true">
              {conversation.kind === 'channel' ? <Hash size={20} /> : <MessageCircle size={20} />}
            </span>
            <span className={styles.conversationCopy}>
              <span className={styles.conversationTopline}>
                <strong>{conversation.name}</strong>
                <time>{relativeTime(conversation.last_message_at)}</time>
              </span>
              <span className={styles.conversationDescription}>{conversation.description || 'Werkafspraken en planning'}</span>
            </span>
            {conversation.unread_count > 0 && (
              <span className={styles.unreadBadge} aria-label={`${conversation.unread_count} ongelezen`}>
                {Math.min(conversation.unread_count, 99)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
