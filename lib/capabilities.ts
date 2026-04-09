// Client-safe capability check — no Node.js imports
import type { SessionUser, Capability } from '@/types'
import { ROLE_CAPS } from '@/types'

export function can(user: SessionUser | undefined, capability: Capability): boolean {
  if (!user) return false
  return (ROLE_CAPS[user.role] ?? []).includes(capability)
}
