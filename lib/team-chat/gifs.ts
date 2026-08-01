import type { TeamGif } from '../../types/team-chat'

const GIPHY_SEARCH_ENDPOINT = 'https://api.giphy.com/v1/gifs/search'
const ALLOWED_GIPHY_MEDIA_HOSTS = new Set(['media.giphy.com', 'media0.giphy.com'])
const GIF_SEARCH_LIMIT = 24
const GIF_REQUEST_TIMEOUT_MS = 6_000

export type GifResult = TeamGif

export class GifProviderError extends Error {
  constructor(
    public readonly code: 'GIF_PROVIDER_UNCONFIGURED' | 'INVALID_GIF_QUERY' | 'GIF_PROVIDER_UNAVAILABLE',
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = 'GifProviderError'
  }
}

interface GifSearchDependencies {
  apiKey?: string
  fetch: typeof fetch
}

type GiphyRendition = { url?: unknown; width?: unknown; height?: unknown }
type GiphyItem = { id?: unknown; images?: { fixed_height?: GiphyRendition } }

export function isAllowedGifUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_GIPHY_MEDIA_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function normalizeGifQuery(value: string): string {
  const query = value.trim()
  if (query.length < 2 || query.length > 80) {
    throw new GifProviderError('INVALID_GIF_QUERY', 400)
  }
  return query
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function sanitizeGif(item: GiphyItem): GifResult | null {
  const rendition = item.images?.fixed_height
  if (typeof item.id !== 'string' || !rendition || typeof rendition.url !== 'string') return null
  if (!item.id.trim() || !isAllowedGifUrl(rendition.url)) return null

  const width = toPositiveInteger(rendition.width)
  const height = toPositiveInteger(rendition.height)
  if (!width || !height) return null

  return {
    provider: 'giphy',
    id: item.id.trim(),
    url: new URL(rendition.url).toString(),
    width,
    height,
  }
}

export function createGifSearch(dependencies: GifSearchDependencies) {
  return async function search(queryInput: string): Promise<GifResult[]> {
    const query = normalizeGifQuery(queryInput)
    const apiKey = dependencies.apiKey?.trim()
    if (!apiKey) throw new GifProviderError('GIF_PROVIDER_UNCONFIGURED', 503)

    const url = new URL(GIPHY_SEARCH_ENDPOINT)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', String(GIF_SEARCH_LIMIT))
    url.searchParams.set('rating', 'pg')
    url.searchParams.set('lang', 'nl')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GIF_REQUEST_TIMEOUT_MS)
    try {
      const response = await dependencies.fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new GifProviderError('GIF_PROVIDER_UNAVAILABLE', 502)

      const payload = await response.json() as { data?: unknown }
      if (!Array.isArray(payload.data)) throw new GifProviderError('GIF_PROVIDER_UNAVAILABLE', 502)
      return payload.data
        .map(item => sanitizeGif(item as GiphyItem))
        .filter((item): item is GifResult => item !== null)
        .slice(0, GIF_SEARCH_LIMIT)
    } catch (error) {
      if (error instanceof GifProviderError) throw error
      throw new GifProviderError('GIF_PROVIDER_UNAVAILABLE', 502, { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }
}

export async function searchGifs(query: string): Promise<GifResult[]> {
  return createGifSearch({
    apiKey: process.env.GIPHY_API_KEY,
    fetch: globalThis.fetch,
  })(query)
}
