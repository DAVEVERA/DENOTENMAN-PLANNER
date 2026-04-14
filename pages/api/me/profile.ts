import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { getProfile, upsertProfile, uploadAvatar } from '@/lib/profile'
import type { VoorkeurPlanning } from '@/types'

// Grotere body-limit voor base64 avatars (max ~5MB → ~6.7MB base64)
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user) return res.status(401).json({ success: false })

  const { employee_id } = session.user
  if (!employee_id) return res.status(403).json({ success: false, message: 'Geen medewerker gekoppeld' })

  // ── GET: haal profiel op ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const profile = await getProfile(employee_id)
      return res.json({ success: true, data: profile })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  // ── PUT: sla profiel op ────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      const {
        voornaam, achternaam, adres, postcode, stad,
        ice_contact, geboortedatum, geboorteplaats,
        land_van_herkomst, bijzonderheden, voorkeur_planning,
        avatar_base64, avatar_mime,
      } = req.body as {
        voornaam?:          string
        achternaam?:        string
        adres?:             string
        postcode?:          string
        stad?:              string
        ice_contact?:       string
        geboortedatum?:     string
        geboorteplaats?:    string
        land_van_herkomst?: string
        bijzonderheden?:    string
        voorkeur_planning?: VoorkeurPlanning
        avatar_base64?:     string
        avatar_mime?:       string
      }

      // Optioneel: avatar uploaden
      if (avatar_base64 && avatar_mime) {
        if (!ALLOWED_AVATAR_MIME.includes(avatar_mime)) {
          return res.status(400).json({ success: false, message: 'Alleen JPEG, PNG of WebP toegestaan voor profielfoto' })
        }
        const buf = Buffer.from(avatar_base64, 'base64')
        if (buf.byteLength > 5 * 1024 * 1024) {
          return res.status(400).json({ success: false, message: 'Profielfoto mag maximaal 5 MB zijn' })
        }
        await uploadAvatar(employee_id, buf, avatar_mime)
      }

      const profile = await upsertProfile(employee_id, {
        voornaam:          voornaam ?? null,
        achternaam:        achternaam ?? null,
        adres:             adres ?? null,
        postcode:          postcode ?? null,
        stad:              stad ?? null,
        ice_contact:       ice_contact ?? null,
        geboortedatum:     geboortedatum || null,
        geboorteplaats:    geboorteplaats ?? null,
        land_van_herkomst: land_van_herkomst ?? 'Nederland',
        bijzonderheden:    bijzonderheden ?? null,
        voorkeur_planning: voorkeur_planning ?? null,
      })

      return res.json({ success: true, data: profile })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: String(err) })
    }
  }

  res.status(405).json({ success: false })
}
