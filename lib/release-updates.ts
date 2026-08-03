export const RELEASE_UPDATES_OPEN_EVENT = 'release-updates:open'
export const CURRENT_RELEASE_UPDATE_VERSION = '2026-08-combined-planning'

export type ReleaseUpdateAudience = 'admin' | 'employee'

export interface ReleaseUpdateItem {
  title: string
  description: string
}

export interface ReleaseUpdateContent {
  version: string
  eyebrow: string
  title: string
  intro: string
  items: ReleaseUpdateItem[]
  toggleLabel: string
  closeLabel: string
  helperText: string
}

export interface ReleaseUpdatePreference {
  schemaVersion: 1
  autoShow: boolean
  seenVersions: string[]
}

const SHARED_COPY = {
  version: CURRENT_RELEASE_UPDATE_VERSION,
  eyebrow: 'Nieuw in de planner',
  title: 'Plannen is weer een stukje makkelijker',
  intro: 'Dit is er voor jou verbeterd:',
  toggleLabel: 'Laat nieuwe verbeteringen na het inloggen zien',
  closeLabel: 'Duidelijk, bedankt!',
  helperText: 'Je kunt deze verbeteringen later altijd terugvinden op je dashboard.',
}

const CONTENT: Record<ReleaseUpdateAudience, ReleaseUpdateContent> = {
  employee: {
    ...SHARED_COPY,
    items: [
      {
        title: 'Alles in één rooster',
        description: 'Je ziet de diensten van Markt en Magazijn nu samen. Zo hoef je niet meer heen en weer.',
      },
      {
        title: 'Duidelijke locatienamen',
        description: 'De locaties heten nu gewoon Markt en Magazijn. Lekker kort en duidelijk.',
      },
      {
        title: 'Jouw eigen rooster blijft staan',
        description: 'Wil je alleen jouw eigen diensten zien? Dat kan natuurlijk nog steeds.',
      },
    ],
  },
  admin: {
    ...SHARED_COPY,
    items: [
      {
        title: 'Beide locaties tegelijk',
        description: 'Je plant Markt en Magazijn nu vanuit één overzicht. Zo zie je meteen of iemand al werkt.',
      },
      {
        title: 'Duidelijke locatienamen',
        description: 'De locaties heten nu gewoon Markt en Magazijn. Lekker kort en duidelijk.',
      },
      {
        title: 'Hele dag met één knop',
        description: 'Een hele dag plannen doe je nu met één duidelijke knop.',
      },
      {
        title: 'Sneller een dienst invullen',
        description: 'Het veld Buddy is weggehaald. Daardoor is het formulier korter en duidelijker.',
      },
    ],
  },
}

const DEFAULT_PREFERENCE: ReleaseUpdatePreference = {
  schemaVersion: 1,
  autoShow: true,
  seenVersions: [],
}

export function getReleaseUpdateContent(audience: ReleaseUpdateAudience): ReleaseUpdateContent {
  return CONTENT[audience]
}

export function openReleaseUpdates(): boolean {
  if (typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent(RELEASE_UPDATES_OPEN_EVENT))
  return true
}

export function releaseUpdatePreferenceKey(userId: string): string {
  return `release-updates:preference:${encodeURIComponent(userId)}`
}

export function readReleaseUpdatePreference(userId: string): ReleaseUpdatePreference {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCE }

  try {
    const raw = window.localStorage.getItem(releaseUpdatePreferenceKey(userId))
    if (!raw) return { ...DEFAULT_PREFERENCE }

    const stored: unknown = JSON.parse(raw)
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_PREFERENCE }

    const candidate = stored as { autoShow?: unknown; seenVersions?: unknown }
    return {
      schemaVersion: 1,
      autoShow: typeof candidate.autoShow === 'boolean' ? candidate.autoShow : true,
      seenVersions: Array.isArray(candidate.seenVersions)
        ? [...new Set(candidate.seenVersions.filter((version): version is string => typeof version === 'string'))]
        : [],
    }
  } catch {
    return { ...DEFAULT_PREFERENCE }
  }
}

export function saveReleaseUpdatePreference(
  userId: string,
  preference: ReleaseUpdatePreference,
): boolean {
  if (typeof window === 'undefined') return false

  try {
    window.localStorage.setItem(releaseUpdatePreferenceKey(userId), JSON.stringify(preference))
    return true
  } catch {
    return false
  }
}

export function hasSeenReleaseUpdate(preference: ReleaseUpdatePreference, version: string): boolean {
  return preference.seenVersions.includes(version)
}

export function markReleaseUpdateSeen(
  userId: string,
  version: string,
  autoShow: boolean,
): ReleaseUpdatePreference {
  const current = readReleaseUpdatePreference(userId)
  const next: ReleaseUpdatePreference = {
    schemaVersion: 1,
    autoShow,
    seenVersions: [...new Set([...current.seenVersions, version])],
  }
  saveReleaseUpdatePreference(userId, next)
  return next
}
