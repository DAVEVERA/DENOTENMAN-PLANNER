import type { TeamMessage } from '../../lib/team-chat/repository'
import type { CreateMessageInput } from '../../types/team-chat'

export type MessageDelivery = 'sending' | 'sent' | 'failed'

export interface ClientTeamMessage extends TeamMessage {
  delivery: MessageDelivery
  retry_payload?: CreateMessageInput
}

export interface TeamChatState {
  activeConversationId: number | null
  messages: ClientTeamMessage[]
}

export type TeamChatAction =
  | { type: 'select'; conversationId: number | null }
  | { type: 'replace'; messages: TeamMessage[] }
  | { type: 'merge'; messages: TeamMessage[] }
  | { type: 'optimistic'; message: ClientTeamMessage }
  | { type: 'acknowledged'; nonce: string; message: TeamMessage }
  | { type: 'failed'; nonce: string }
  | { type: 'retrying'; nonce: string }
  | { type: 'edited'; message: TeamMessage }

function asSent(message: TeamMessage): ClientTeamMessage {
  return { ...message, delivery: 'sent' }
}

export function mergeTimeline(
  current: ClientTeamMessage[],
  incoming: TeamMessage[],
): ClientTeamMessage[] {
  const byId = new Map<number, ClientTeamMessage>()
  const nonceToId = new Map<string, number>()
  for (const item of current) {
    byId.set(item.id, item)
    nonceToId.set(item.client_nonce, item.id)
  }
  for (const message of incoming) {
    const nonceId = nonceToId.get(message.client_nonce)
    if (nonceId !== undefined && nonceId !== message.id) byId.delete(nonceId)
    byId.set(message.id, asSent(message))
    nonceToId.set(message.client_nonce, message.id)
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

export function createInitialChatState(activeConversationId: number | null = null): TeamChatState {
  return { activeConversationId, messages: [] }
}

export function teamChatReducer(state: TeamChatState, action: TeamChatAction): TeamChatState {
  switch (action.type) {
    case 'select':
      return { activeConversationId: action.conversationId, messages: [] }
    case 'replace':
      return { ...state, messages: mergeTimeline([], action.messages) }
    case 'merge':
      return { ...state, messages: mergeTimeline(state.messages, action.messages) }
    case 'optimistic':
      return { ...state, messages: mergeTimeline(state.messages, []).concat(action.message).sort((a, b) => a.id - b.id) }
    case 'acknowledged': {
      const withoutOptimistic = state.messages.filter(item => item.client_nonce !== action.nonce)
      return { ...state, messages: mergeTimeline(withoutOptimistic, [action.message]) }
    }
    case 'failed':
      return {
        ...state,
        messages: state.messages.map(item => item.client_nonce === action.nonce ? { ...item, delivery: 'failed' } : item),
      }
    case 'retrying':
      return {
        ...state,
        messages: state.messages.map(item => item.client_nonce === action.nonce ? { ...item, delivery: 'sending' } : item),
      }
    case 'edited':
      return {
        ...state,
        messages: state.messages.map(item => item.id === action.message.id ? asSent(action.message) : item),
      }
    default:
      return state
  }
}

export function shouldAutoScroll(input: { distanceFromBottom: number; isOwnMessage: boolean }): boolean {
  return input.isOwnMessage || input.distanceFromBottom <= 96
}
