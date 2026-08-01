/* Animated GIPHY media must remain a native img; Next Image optimization would freeze/re-encode it. */
/* eslint-disable @next/next/no-img-element */
import { AlertCircle, CheckCheck, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { TeamShiftSnapshot } from '../../lib/team-chat/repository'
import type { ClientTeamMessage } from './state'
import { shouldAutoScroll } from './state'
import ShiftMessageCard from './ShiftMessageCard'
import styles from './TeamChat.module.css'

interface Props {
  messages: ClientTeamMessage[]
  currentUserId: string
  currentEmployeeId: number | null
  onRetry(nonce: string): void
  onVisible(messageId: number): void
  onExchange(shift: TeamShiftSnapshot): void
}

function clock(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function dayLabel(value: string): string {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Vandaag'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Gisteren'
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export default function MessageTimeline({ messages, currentUserId, currentEmployeeId, onRetry, onVisible, onExchange }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const previousLengthRef = useRef(0)
  const [showNew, setShowNew] = useState(false)
  const [reactions, setReactions] = useState<Record<string, { count: number; active: boolean }>>({})

  async function toggleReaction(messageId: number, emoji: string) {
    if (messageId <= 0) return
    const response = await fetch('/api/team-chat/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, emoji }),
    })
    const payload = await response.json()
    if (response.ok && payload.success) {
      setReactions(current => ({ ...current, [`${messageId}:${emoji}`]: { count: payload.data.count, active: payload.data.active } }))
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !messages.length) return
    const last = messages[messages.length - 1]
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    const own = last.sender_user_id === currentUserId
    if (previousLengthRef.current === 0 || shouldAutoScroll({ distanceFromBottom: distance, isOwnMessage: own })) {
      requestAnimationFrame(() => viewport.scrollTo({ top: viewport.scrollHeight, behavior: previousLengthRef.current ? 'smooth' : 'auto' }))
      setShowNew(false)
    } else if (messages.length > previousLengthRef.current) {
      setShowNew(true)
    }
    previousLengthRef.current = messages.length
    if (last.id > 0 && document.visibilityState === 'visible') onVisible(last.id)
  }, [currentUserId, messages, onVisible])

  function scrollToLatest() {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
    setShowNew(false)
  }

  if (!messages.length) {
    return (
      <div className={styles.emptyTimeline}>
        <span className={styles.emptyMark}>N</span>
        <h2>Begin het gesprek</h2>
        <p>Deel een update, tag een dienst of stem een roosterwijziging veilig af.</p>
      </div>
    )
  }

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.timeline} ref={viewportRef} role="log" aria-live="polite" aria-relevant="additions text" onScroll={event => {
        const target = event.currentTarget
        if (target.scrollHeight - target.scrollTop - target.clientHeight < 80) setShowNew(false)
      }}>
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const isOwn = message.sender_user_id === currentUserId
          const sameGroup = Boolean(previous
            && previous.sender_user_id === message.sender_user_id
            && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60_000)
          const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString()
          return (
            <div key={`${message.id}-${message.client_nonce}`}>
              {newDay && <div className={styles.dayDivider}><span>{dayLabel(message.created_at)}</span></div>}
              <article className={`${styles.messageRow} ${isOwn ? styles.ownMessageRow : ''} ${sameGroup ? styles.groupedMessage : ''}`}>
                {!sameGroup && !isOwn && (
                  <span className={styles.avatar} aria-hidden="true">{message.sender_display_name.slice(0, 1).toUpperCase()}</span>
                )}
                <div className={styles.messageStack}>
                  {!sameGroup && (
                    <div className={styles.messageMeta}>
                      <strong>{isOwn ? 'Jij' : message.sender_display_name}</strong>
                      <time dateTime={message.created_at}>{clock(message.created_at)}</time>
                    </div>
                  )}
                  <div className={`${styles.bubble} ${message.message_type === 'system' ? styles.systemBubble : ''}`}>
                    {message.body && <p>{message.body}</p>}
                    {message.gif && (
                      <img
                        className={styles.gif}
                        src={message.gif.url}
                        width={message.gif.width}
                        height={message.gif.height}
                        loading="lazy"
                        alt="Gedeelde GIF"
                      />
                    )}
                    {message.shift && (
                      <ShiftMessageCard shift={message.shift} currentEmployeeId={currentEmployeeId} onExchange={onExchange} />
                    )}
                    <span className={styles.delivery} aria-label={message.delivery === 'sent' ? 'Verzonden' : message.delivery === 'sending' ? 'Wordt verzonden' : 'Verzenden mislukt'}>
                      {message.delivery === 'sent' && isOwn && <CheckCheck size={14} />}
                      {message.delivery === 'sending' && 'Bezig…'}
                    </span>
                  </div>
                  {message.delivery === 'sent' && message.message_type !== 'system' && (
                    <div className={`${styles.reactionStrip} ${isOwn ? styles.ownReactionStrip : ''}`} aria-label="Reageren op bericht">
                      {['👍', '✅', '❤️'].map(emoji => {
                        const reaction = reactions[`${message.id}:${emoji}`]
                        return <button key={emoji} type="button" className={reaction?.active ? styles.activeReaction : ''} onClick={() => void toggleReaction(message.id, emoji)} aria-pressed={reaction?.active ?? false}>{emoji}{reaction?.count ? <span>{reaction.count}</span> : null}</button>
                      })}
                    </div>
                  )}
                  {message.delivery === 'failed' && (
                    <button className={styles.retryButton} type="button" onClick={() => onRetry(message.client_nonce)}>
                      <AlertCircle size={15} /> Niet verzonden · opnieuw proberen
                    </button>
                  )}
                </div>
              </article>
            </div>
          )
        })}
      </div>
      {showNew && (
        <button type="button" className={styles.newMessagesButton} onClick={scrollToLatest}>
          <RefreshCw size={16} /> Nieuwe berichten
        </button>
      )}
    </div>
  )
}
