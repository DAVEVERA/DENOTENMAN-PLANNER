import type { SessionUser } from '../../types'

export function canManageTeamChat(user: SessionUser, isExplicitOwner: boolean): boolean {
  return user.role === 'admin' || isExplicitOwner
}
