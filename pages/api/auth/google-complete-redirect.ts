/**
 * pages/api/auth/google-complete-redirect.ts
 * Google OAuth is verwijderd — dit endpoint is uitgeschakeld.
 */
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.redirect(302, '/login')
}
