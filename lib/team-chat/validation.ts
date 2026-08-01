import { TEAM_CHAT_MAX_MESSAGE_LENGTH } from './constants'
import type { CreateExchangeInput, CreateMessageInput, PlanningIntent, ShiftExchangeKind, TeamGif } from '../../types/team-chat'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_GIPHY_MEDIA_HOSTS = new Set(['media.giphy.com', 'media0.giphy.com'])
const EMOJI_SEQUENCE_PATTERN = /^(?:(?:\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3))+$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`)
  }

  return value
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined
  return requiredPositiveInteger(value, field)
}

function validateGif(value: unknown): TeamGif {
  if (!isRecord(value) || value.provider !== 'giphy' || typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new Error('gif must be a valid GIPHY reference')
  }

  if (typeof value.url !== 'string') {
    throw new Error('gif URL must be an HTTPS URL')
  }

  let url: URL
  try {
    url = new URL(value.url)
  } catch {
    throw new Error('gif URL must be an HTTPS URL')
  }

  if (url.protocol !== 'https:' || !ALLOWED_GIPHY_MEDIA_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('gif URL must use an approved HTTPS GIPHY media host')
  }

  return {
    provider: 'giphy',
    id: value.id.trim(),
    url: url.toString(),
    width: requiredPositiveInteger(value.width, 'gif.width'),
    height: requiredPositiveInteger(value.height, 'gif.height'),
  }
}

export function validateCreateMessage(input: unknown): CreateMessageInput {
  if (!isRecord(input)) throw new Error('message input must be an object')

  const conversation_id = requiredPositiveInteger(input.conversation_id, 'conversation_id')
  if (typeof input.client_nonce !== 'string' || !UUID_PATTERN.test(input.client_nonce)) {
    throw new Error('client_nonce must be a UUID')
  }

  const reply_to_id = optionalPositiveInteger(input.reply_to_id, 'reply_to_id')
  const shift_id = optionalPositiveInteger(input.shift_id, 'shift_id')
  let body: string | undefined
  let gif: TeamGif | undefined

  if (input.body !== undefined) {
    if (typeof input.body !== 'string') throw new Error('body must be a string')
    body = input.body.trim()
    if (body.length === 0) throw new Error('body cannot be empty')
    if (body.length > TEAM_CHAT_MAX_MESSAGE_LENGTH) throw new Error('body exceeds the message limit')
  }

  if (input.gif !== undefined) gif = validateGif(input.gif)

  const contentTypeCount = Number(body !== undefined) + Number(gif !== undefined) + Number(shift_id !== undefined)
  if (contentTypeCount !== 1) throw new Error('message requires exactly one content type')

  return {
    conversation_id,
    client_nonce: input.client_nonce,
    ...(body === undefined ? {} : { body }),
    ...(reply_to_id === undefined ? {} : { reply_to_id }),
    ...(shift_id === undefined ? {} : { shift_id }),
    ...(gif === undefined ? {} : { gif }),
  }
}

export function validateReactionEmoji(input: unknown): string {
  if (typeof input !== 'string') throw new Error('emoji must be a string')

  const emoji = input.trim()
  if (emoji.length === 0 || Array.from(emoji).length > 16 || !EMOJI_SEQUENCE_PATTERN.test(emoji)) {
    throw new Error('emoji must be a complete emoji sequence of at most 16 Unicode code points')
  }

  return emoji
}

export function validateExchangeInput(input: unknown): CreateExchangeInput {
  if (!isRecord(input)) throw new Error('exchange input must be an object')
  if (input.kind !== 'takeover' && input.kind !== 'swap') throw new Error('exchange kind is invalid')

  const kind: ShiftExchangeKind = input.kind
  const source_shift_id = requiredPositiveInteger(input.source_shift_id, 'source_shift_id')
  const target_shift_id = optionalPositiveInteger(input.target_shift_id, 'target_shift_id')

  if (kind === 'takeover' && target_shift_id !== undefined) {
    throw new Error('takeover requests cannot include a target shift')
  }
  if (kind === 'swap' && target_shift_id === undefined) {
    throw new Error('swap requests require a target shift')
  }
  if (target_shift_id === source_shift_id) {
    throw new Error('exchange shifts must be distinct')
  }

  return { kind, source_shift_id, ...(target_shift_id === undefined ? {} : { target_shift_id }) }
}

export function detectPlanningIntent(body: string): PlanningIntent[] {
  const normalized = body.trim().toLocaleLowerCase('nl-NL')
  if (!normalized) return []

  const shiftTag = /#dienst-(\d+)\b/i.exec(normalized)
  const shiftId = shiftTag ? Number(shiftTag[1]) : null
  const intentKinds: Array<[PlanningIntent['kind'], RegExp]> = [
    ['takeover_shift', /\b(overnemen|overname)\b/u],
    ['swap_shift', /\b(ruilen|ruil|wisselen)\b/u],
    ['share_shift', /\b(delen|deel)\b/u],
    ['request_help', /\b(helpen|hulp)\b/u],
  ]

  return intentKinds
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([kind]) => ({ kind, shiftId, confidence: 1 }) as PlanningIntent)
}
