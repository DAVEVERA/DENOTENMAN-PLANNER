import type { Location } from '@/types'
import { LOCATION_LABELS } from '@/types'

interface Props {
  location: Location
  size?: 'xs' | 'sm' | 'md'
  label?: 'full' | 'short' | 'initial'
}

export default function LocationBadge({ location, size = 'sm', label = 'full' }: Props) {
  const className = `loc-badge loc-badge-${location === 'both' ? 'both' : (location === 'markt' ? 'markt' : 'noot')} ${size !== 'sm' ? size : ''}`.trim()
  const accessibleLabel = LOCATION_LABELS[location]

  if (location === 'both') {
    return (
      <span className={className} aria-label={accessibleLabel} title={accessibleLabel}>
        <span className="dot markt" aria-hidden="true" />
        <span className="dot noot" aria-hidden="true" />
        Beide
      </span>
    )
  }
  const displayLabel = label === 'initial'
    ? (location === 'markt' ? 'M' : 'N')
    : label === 'short'
      ? (location === 'markt' ? 'Markt' : 'Magazijn')
      : accessibleLabel
  return (
    <span className={className} aria-label={accessibleLabel} title={accessibleLabel}>
      <span className="dot" aria-hidden="true" />
      {displayLabel}
    </span>
  )
}
