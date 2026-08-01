import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { TeamChatBootstrap, TeamMessage } from '../../lib/team-chat/repository'
import type { CreateMessageInput } from '../../types/team-chat'
import { createClientNonce } from '../../lib/team-chat/client'
import { TEAM_CHAT_ACTIVE_POLL_MS, TEAM_CHAT_IDLE_POLL_MS } from '../../lib/team-chat/constants'
import {
  createInitialChatState,
  teamChatReducer,
  type ClientTeamMessage,
} from './state'

export type TeamChatConnectionState = 'loading' | 'online' | 'offline' | 'error'

interface ApiSuccess<T> { success: true; data: T }
interface ApiFailure { success: false; code?: string; message?: string }

export interface UseTeamChatResult {
  bootstrap: TeamChatBootstrap | null
  activeConversationId: number | null
  messages: ClientTeamMessage[]
  connectionState: TeamChatConnectionState
  error: string | null
  sendMessage(input: Omit<CreateMessageInput, 'conversation_id'>): Promise<void>
  retryMessage(clientNonce: string): Promise<void>
  selectConversation(id: number): void
  markRead(messageId: number): Promise<void>
  reload(): Promise<void>
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    cache: 'no-store',
  })
  const payload = await response.json() as ApiSuccess<T> | ApiFailure
  if (!response.ok || !payload.success) {
    const code = 'code' in payload ? payload.code : undefined
    throw new Error(code || ('message' in payload ? payload.message : undefined) || 'CHAT_REQUEST_FAILED')
  }
  return payload.data
}

function userFacingError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  const labels: Record<string, string> = {
    UNAUTHENTICATED: 'Je sessie is verlopen. Log opnieuw in.',
    CHAT_BOOTSTRAP_FAILED: 'Chat kan nog niet worden geladen. Probeer het zo opnieuw.',
    CONVERSATION_ARCHIVED: 'Dit gesprek is gearchiveerd en alleen-lezen.',
    MESSAGE_BODY_REQUIRED: 'Schrijf eerst een bericht.',
    GIF_PROVIDER_UNAVAILABLE: 'GIF-zoeken is tijdelijk niet beschikbaar.',
  }
  return labels[code] ?? 'Er ging iets mis. Controleer je verbinding en probeer opnieuw.'
}

export function useTeamChat(preferredConversationId?: number | null): UseTeamChatResult {
  const [bootstrap, setBootstrap] = useState<TeamChatBootstrap | null>(null)
  const [state, dispatch] = useReducer(teamChatReducer, createInitialChatState())
  const [connectionState, setConnectionState] = useState<TeamChatConnectionState>('loading')
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef<number | null>(null)
  const messagesRef = useRef<ClientTeamMessage[]>([])
  const lastActivityRef = useRef(Date.now())
  const lastReadRef = useRef(new Map<number, number>())
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => { activeRef.current = state.activeConversationId }, [state.activeConversationId])
  useEffect(() => { messagesRef.current = state.messages }, [state.messages])

  const loadMessages = useCallback(async (conversationId: number, replace = false) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const current = messagesRef.current.filter(message => message.id > 0)
    const after = replace || !current.length ? '' : `&after_id=${Math.max(...current.map(message => message.id))}`
    try {
      const data = await api<TeamMessage[]>(
        `/api/team-chat/messages?conversation_id=${conversationId}${after}`,
        { signal: controller.signal },
      )
      if (activeRef.current !== conversationId) return
      dispatch({ type: replace ? 'replace' : 'merge', messages: data })
      setConnectionState('online')
      setError(null)
    } catch (loadError) {
      if (controller.signal.aborted) return
      setConnectionState(navigator.onLine ? 'error' : 'offline')
      setError(userFacingError(loadError))
    }
  }, [])

  const reload = useCallback(async () => {
    setConnectionState(navigator.onLine ? 'loading' : 'offline')
    try {
      const data = await api<TeamChatBootstrap>('/api/team-chat/bootstrap')
      setBootstrap(data)
      const allowedPreferred = preferredConversationId
        && data.conversations.some(conversation => conversation.id === preferredConversationId)
        ? preferredConversationId
        : null
      const nextId = allowedPreferred ?? activeRef.current ?? data.conversations[0]?.id ?? null
      if (nextId !== activeRef.current) {
        activeRef.current = nextId
        dispatch({ type: 'select', conversationId: nextId })
      }
      if (nextId) await loadMessages(nextId, true)
      else setConnectionState('online')
      setError(null)
    } catch (bootstrapError) {
      setConnectionState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
      setError(userFacingError(bootstrapError))
    }
  }, [loadMessages, preferredConversationId])

  useEffect(() => {
    void reload()
    return () => requestRef.current?.abort()
  }, [reload])

  const selectConversation = useCallback((conversationId: number) => {
    if (conversationId === activeRef.current) return
    activeRef.current = conversationId
    dispatch({ type: 'select', conversationId })
    setConnectionState(navigator.onLine ? 'loading' : 'offline')
    void loadMessages(conversationId, true)
  }, [loadMessages])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const schedule = () => {
      if (stopped) return
      const idle = Date.now() - lastActivityRef.current > 60_000
      timeout = setTimeout(tick, idle ? TEAM_CHAT_IDLE_POLL_MS : TEAM_CHAT_ACTIVE_POLL_MS)
    }
    const tick = async () => {
      const active = activeRef.current
      if (active && navigator.onLine && document.visibilityState === 'visible') await loadMessages(active)
      schedule()
    }
    const noteActivity = () => {
      lastActivityRef.current = Date.now()
    }
    const refresh = () => {
      noteActivity()
      if (navigator.onLine && document.visibilityState === 'visible' && activeRef.current) {
        void loadMessages(activeRef.current)
      }
    }
    const offline = () => setConnectionState('offline')
    const online = () => {
      setConnectionState('loading')
      refresh()
    }

    window.addEventListener('pointerdown', noteActivity, { passive: true })
    window.addEventListener('keydown', noteActivity)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', refresh)
    schedule()

    return () => {
      stopped = true
      if (timeout) clearTimeout(timeout)
      window.removeEventListener('pointerdown', noteActivity)
      window.removeEventListener('keydown', noteActivity)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadMessages])

  const sendMessage = useCallback(async (input: Omit<CreateMessageInput, 'conversation_id'>) => {
    const conversationId = activeRef.current
    if (!conversationId || !bootstrap) return
    const clientNonce = input.client_nonce || createClientNonce()
    const payload: CreateMessageInput = { ...input, client_nonce: clientNonce, conversation_id: conversationId }
    const optimistic: ClientTeamMessage = {
      id: -Date.now(),
      conversation_id: conversationId,
      message_type: input.gif ? 'gif' : input.shift_id ? 'shift' : 'text',
      body: input.body?.trim() || null,
      gif: input.gif ?? null,
      sender_user_id: bootstrap.user.user_id,
      sender_employee_id: bootstrap.user.employee_id,
      sender_display_name: bootstrap.user.display_name,
      reply_to_message_id: input.reply_to_id ?? null,
      client_nonce: clientNonce,
      edited_at: null,
      created_at: new Date().toISOString(),
      delivery: 'sending',
      retry_payload: payload,
    }
    dispatch({ type: 'optimistic', message: optimistic })

    try {
      const message = await api<TeamMessage>('/api/team-chat/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      dispatch({ type: 'acknowledged', nonce: clientNonce, message })
      setConnectionState('online')
      setError(null)
    } catch (sendError) {
      dispatch({ type: 'failed', nonce: clientNonce })
      setError(userFacingError(sendError))
    }
  }, [bootstrap])

  const retryMessage = useCallback(async (clientNonce: string) => {
    const pending = messagesRef.current.find(message => message.client_nonce === clientNonce)
    if (!pending?.retry_payload) return
    dispatch({ type: 'retrying', nonce: clientNonce })
    try {
      const message = await api<TeamMessage>('/api/team-chat/messages', {
        method: 'POST',
        body: JSON.stringify(pending.retry_payload),
      })
      dispatch({ type: 'acknowledged', nonce: clientNonce, message })
      setError(null)
    } catch (retryError) {
      dispatch({ type: 'failed', nonce: clientNonce })
      setError(userFacingError(retryError))
    }
  }, [])

  const markRead = useCallback(async (messageId: number) => {
    const conversationId = activeRef.current
    if (!conversationId || messageId <= 0) return
    const previous = lastReadRef.current.get(conversationId) ?? 0
    if (messageId <= previous) return
    lastReadRef.current.set(conversationId, messageId)
    try {
      await api('/api/team-chat/read', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
      })
      setBootstrap(current => {
        if (!current) return current
        const target = current.conversations.find(conversation => conversation.id === conversationId)
        if (!target || target.unread_count === 0) return current
        return {
          ...current,
          conversations: current.conversations.map(conversation => conversation.id === conversationId
            ? { ...conversation, unread_count: 0 }
            : conversation),
        }
      })
    } catch {
      if (lastReadRef.current.get(conversationId) === messageId) lastReadRef.current.delete(conversationId)
      // Read receipts are best-effort and are retried on the next visible message.
    }
  }, [])

  return {
    bootstrap,
    activeConversationId: state.activeConversationId,
    messages: state.messages,
    connectionState,
    error,
    sendMessage,
    retryMessage,
    selectConversation,
    markRead,
    reload,
  }
}
