import type { NextApiRequest, NextApiResponse } from 'next'
import { getRawSession, getSession } from '@/lib/auth'
import { getInspectionOverview, hashInspectionValue, recordInspectionOverview, validateServiceNumber } from '@/lib/inspection'
import { hasSameOrigin } from '@/lib/request-security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false })
  if (!hasSameOrigin(req)) return res.status(403).json({ success: false, message: 'Ongeldige aanvraag' })
  const authorized = await getSession(req, res)
  if (!authorized.user) return res.status(401).json({ success: false, message: 'Inspectiesessie verlopen' })
  if (authorized.user.role !== 'inspector') return res.status(403).json({ success: false })
  const session = await getRawSession(req, res)

  const serviceNumber = validateServiceNumber(req.body?.serviceNumber)
  if (!serviceNumber) return res.status(400).json({ success: false, message: 'Vul een geldig dienst- of stamnummer in' })
  if (req.body?.integrityAccepted !== true) {
    return res.status(400).json({ success: false, message: 'Bevestig de integriteitsverklaring om door te gaan' })
  }

  try {
    session.inspection_service_number_hash = hashInspectionValue(serviceNumber)
    session.inspection_service_number_suffix = serviceNumber.slice(-4)
    session.inspection_integrity_accepted_at = Date.now()
    await session.save()
    const overview = await getInspectionOverview(session)
    await recordInspectionOverview(session)
    return res.json({ success: true, data: overview })
  } catch (error) {
    console.error('[/api/inspectie/overzicht]', error)
    return res.status(500).json({ success: false, message: 'Het inspectieoverzicht kon niet veilig worden geladen' })
  }
}
