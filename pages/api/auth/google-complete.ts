/**
 * pages/api/auth/google-complete.ts
 * Google OAuth is verwijderd — dit endpoint is uitgeschakeld.
 */
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(404).json({ success: false, error: 'Google-authenticatie is uitgeschakeld.' })
}
