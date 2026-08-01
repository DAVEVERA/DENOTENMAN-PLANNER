/* Animated GIPHY media must remain a native img to preserve animation and provider dimensions. */
/* eslint-disable @next/next/no-img-element */
import { CalendarPlus, Image as ImageIcon, Laugh, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { currentWeekYear, nextWeekYear } from '../../lib/dateUtils'
import { createClientNonce } from '../../lib/team-chat/client'
import type { Shift } from '../../types'
import type { CreateMessageInput, TeamGif } from '../../types/team-chat'
import styles from './TeamChat.module.css'

interface Props {
  initialShiftId?: number | null
  employeeId: number | null
  location: string | null
  disabled?: boolean
  onSend(input: Omit<CreateMessageInput, 'conversation_id'>): Promise<void>
}

const EMOJIS = ['👍', '✅', '🙌', '💪', '🙏', '🎉', '👀', '📌', '⚠️', '🥜', '😀', '😂', '❤️', '🔥', '👏']

export default function ChatComposer({ initialShiftId, employeeId, location, disabled, onSend }: Props) {
  const [body, setBody] = useState('')
  const [gif, setGif] = useState<TeamGif | null>(null)
  const [shiftId, setShiftId] = useState<number | null>(initialShiftId ?? null)
  const [panel, setPanel] = useState<'emoji' | 'gif' | 'shift' | null>(null)
  const [gifs, setGifs] = useState<TeamGif[]>([])
  const [gifQuery, setGifQuery] = useState('')
  const [gifState, setGifState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setShiftId(initialShiftId ?? null), [initialShiftId])

  useEffect(() => {
    if (panel !== 'shift') return
    const current = currentWeekYear()
    const next = nextWeekYear(current.week, current.year)
    const queryLocation = location && location !== 'both' ? `&location=${location}` : ''
    Promise.all([
      fetch(`/api/shifts?week=${current.week}&year=${current.year}${queryLocation}`, { cache: 'no-store' }).then(response => response.json()),
      fetch(`/api/shifts?week=${next.week}&year=${next.year}${queryLocation}`, { cache: 'no-store' }).then(response => response.json()),
    ]).then(results => {
      const seen = new Map<number, Shift>()
      results.flatMap(result => result.success ? result.data as Shift[] : []).forEach(shift => seen.set(shift.id, shift))
      setShifts([...seen.values()].filter(shift => shift.employee_id || shift.is_open === 1))
    }).catch(() => setShifts([]))
  }, [location, panel])

  async function searchGifs(event: React.FormEvent) {
    event.preventDefault()
    if (gifQuery.trim().length < 2) return
    setGifState('loading')
    try {
      const response = await fetch(`/api/team-chat/gifs?q=${encodeURIComponent(gifQuery.trim())}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.code)
      setGifs(payload.data)
      setGifState('idle')
    } catch {
      setGifState('error')
    }
  }

  async function submit() {
    if (sending || disabled || (!body.trim() && !gif && !shiftId)) return
    setSending(true)
    const payload: Omit<CreateMessageInput, 'conversation_id'> = {
      client_nonce: createClientNonce(),
      ...(gif ? { gif } : shiftId ? { shift_id: shiftId } : { body: body.trim() }),
    }
    await onSend(payload)
    setBody('')
    setGif(null)
    setShiftId(null)
    setPanel(null)
    setSending(false)
    inputRef.current?.focus()
  }

  function keyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className={styles.composerWrap}>
      {(gif || shiftId) && (
        <div className={styles.composerAttachment}>
          {gif && <img src={gif.url} alt="Geselecteerde GIF" />}
          {shiftId && <span><CalendarPlus size={16} /> Dienst #{shiftId} wordt gedeeld — wijzigt het rooster later, dan past dit bericht zich niet aan</span>}
          <button type="button" onClick={() => { setGif(null); setShiftId(null) }} aria-label="Bijlage verwijderen"><X size={18} /></button>
        </div>
      )}
      {panel && (
        <section className={styles.composerPanel} aria-label={panel === 'emoji' ? 'Emoji kiezen' : panel === 'gif' ? 'GIF kiezen' : 'Dienst kiezen'}>
          <div className={styles.panelTopline}>
            <strong>{panel === 'emoji' ? 'Emoji' : panel === 'gif' ? 'Zoek een GIF' : 'Tag een dienst'}</strong>
            <button type="button" className={styles.iconButton} onClick={() => setPanel(null)} aria-label="Paneel sluiten"><X size={18} /></button>
          </div>
          {panel === 'emoji' && (
            <div className={styles.emojiGrid}>
              {EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => { setBody(value => `${value}${emoji}`); inputRef.current?.focus() }}>{emoji}</button>)}
            </div>
          )}
          {panel === 'gif' && (
            <>
              <form className={styles.gifSearch} onSubmit={searchGifs}>
                <input value={gifQuery} onChange={event => setGifQuery(event.target.value)} placeholder="Zoek: dankjewel, koffie…" aria-label="GIF zoeken" />
                <button type="submit">Zoek</button>
              </form>
              {gifState === 'error' && <p className={styles.panelHint}>GIFs zijn nu niet beschikbaar. Probeer het later nog eens, of stuur je bericht zonder GIF.</p>}
              {gifState === 'loading' && <p className={styles.panelHint}>GIFs laden…</p>}
              <div className={styles.gifGrid}>
                {gifs.map(item => (
                  <button key={item.id} type="button" onClick={() => { setGif(item); setShiftId(null); setPanel(null) }}>
                    <img src={item.url} alt="GIF resultaat" loading="lazy" />
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === 'shift' && (
            <div className={styles.shiftPicker}>
              {shifts.length === 0 && <p className={styles.panelHint}>Geen zichtbare diensten in deze of volgende week.</p>}
              {shifts.map(shift => (
                <button key={shift.id} type="button" onClick={() => { setShiftId(shift.id); setGif(null); setPanel(null) }}>
                  <span>{shift.shift_type} · {shift.day_of_week}</span>
                  <small>Week {shift.week_number} · {shift.start_time?.slice(0, 5) || 'hele dag'} · {shift.employee_name || 'Open'}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <div className={styles.composer}>
        <div className={styles.composerTools}>
          <button type="button" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')} aria-label="Emoji toevoegen"><Laugh size={20} /></button>
          <button type="button" onClick={() => setPanel(panel === 'gif' ? null : 'gif')} aria-label="GIF toevoegen"><ImageIcon size={20} /></button>
          <button type="button" onClick={() => setPanel(panel === 'shift' ? null : 'shift')} aria-label="Dienst taggen"><CalendarPlus size={20} /></button>
        </div>
        <textarea
          ref={inputRef}
          value={body}
          onChange={event => setBody(event.target.value.slice(0, 2000))}
          onKeyDown={keyDown}
          placeholder="Schrijf een bericht…"
          rows={1}
          disabled={disabled}
          aria-label="Bericht"
        />
        <button className={styles.sendButton} type="button" onClick={submit} disabled={disabled || sending || (!body.trim() && !gif && !shiftId)} aria-label="Bericht verzenden">
          <Send size={20} />
        </button>
      </div>
      <span className={styles.composerHint}>Enter verstuurt · Shift+Enter maakt een nieuwe regel</span>
    </div>
  )
}
