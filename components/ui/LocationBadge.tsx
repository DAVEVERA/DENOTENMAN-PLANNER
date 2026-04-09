import type { Location } from '@/types'
import { LOCATION_LABELS } from '@/types'

interface Props { location: Location; size?: 'xs' | 'sm' | 'md' }

export default function LocationBadge({ location, size = 'sm' }: Props) {
  const className = `loc-badge loc-badge-${location === 'both' ? 'both' : (location === 'markt' ? 'markt' : 'noot')} ${size !== 'sm' ? size : ''}`.trim()

  if (location === 'both') {
    return (
      <span className={className}>
        <span className="dot markt" aria-hidden="true" />
        <span className="dot noot" aria-hidden="true" />
        Beide
      </span>
    )
  }
  return (
    <span className={className}>
      <span className="dot" aria-hidden="true" />
      {LOCATION_LABELS[location]}
    </span>
  )
}
