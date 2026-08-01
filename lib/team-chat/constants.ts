export const TEAM_CHAT_MAX_MESSAGE_LENGTH = 2_000
export const TEAM_CHAT_PAGE_SIZE = 50
export const TEAM_CHAT_ACTIVE_POLL_MS = 2_000
export const TEAM_CHAT_IDLE_POLL_MS = 15_000

export const FIXED_TEAM_CHANNELS = [
  { slug: 'nootities', name: 'Nootities', description: 'Algemene teamnotities.' },
  { slug: 'nootzakelijk', name: 'Nootzakelijk', description: 'Belangrijke operationele updates.' },
  { slug: 'the-nootorious', name: 'The Nootorious', description: 'Teamgesprekken en ideeën.' },
  { slug: 'nootschap', name: 'NOOTSCHAP!!', description: 'Samenwerking en teamnieuws.' },
] as const
