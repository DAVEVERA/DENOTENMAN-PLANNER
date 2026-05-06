/**
 * pages/api/auth/[...nextauth].ts
 * Google OAuth is verwijderd. Inloggen verloopt uitsluitend via
 * gebruikersnaam + wachtwoord (POST /api/auth/login).
 *
 * Dit bestand blijft bestaan zodat eventuele externe verwijzingen
 * naar /api/auth/* geen onverwachte server-errors geven.
 */
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(404).json({ error: 'Google-authenticatie is uitgeschakeld.' })
}
