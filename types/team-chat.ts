export type TeamConversationKind = 'channel' | 'direct' | 'group'
export type TeamMessageType = 'text' | 'gif' | 'shift' | 'system'
export type ShiftExchangeKind = 'takeover' | 'swap'
export type ShiftExchangeStatus = 'pending' | 'declined' | 'completed' | 'conflict' | 'expired' | 'cancelled'

export interface TeamConversationSummary {
  id: number
  kind: TeamConversationKind
  slug: string | null
  name: string
  description: string
  fixed: boolean
  member_count: number
  unread_count: number
  last_message_at: string | null
  archived_at: string | null
}

export interface TeamGif {
  provider: 'giphy'
  id: string
  url: string
  width: number
  height: number
}

export interface CreateMessageInput {
  conversation_id: number
  client_nonce: string
  body?: string
  reply_to_id?: number
  shift_id?: number
  gif?: TeamGif
}

export interface CreateExchangeInput {
  kind: ShiftExchangeKind
  source_shift_id: number
  target_shift_id?: number
}

export type PlanningIntent =
  | { kind: 'share_shift'; shiftId: number | null; confidence: number }
  | { kind: 'takeover_shift'; shiftId: number | null; confidence: number }
  | { kind: 'swap_shift'; shiftId: number | null; confidence: number }
  | { kind: 'request_help'; shiftId: number | null; confidence: number }
