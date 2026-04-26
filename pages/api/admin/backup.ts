import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '@/lib/auth'
import { exportFullBackup, validateBackup, getImportPreview, importBackup, getBackupHistory, type BackupData } from '@/lib/backup'

export const config = { api: { bodyParser: { sizeLimit: '16mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  if (!session.user || session.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Geen toegang' })
  }

  // GET → export backup or get history
  if (req.method === 'GET') {
    const { action } = req.query
    if (action === 'history') {
      const history = await getBackupHistory()
      return res.json({ success: true, data: history })
    }
    try {
      const backup = await exportFullBackup(session.user.display_name)
      const filename = `denotenman-backup-${new Date().toISOString().slice(0, 10)}.json`
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.send(JSON.stringify(backup, null, 2))
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Export mislukt' })
    }
  }

  // POST → validate/preview
  if (req.method === 'POST') {
    try {
      const data = req.body as BackupData
      const preview = await getImportPreview(data)
      return res.json({ success: true, data: preview })
    } catch (err: unknown) {
      return res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Validatie mislukt' })
    }
  }

  // PUT → execute import
  if (req.method === 'PUT') {
    try {
      const { backup, mode } = req.body as { backup: BackupData; mode: 'merge' | 'replace' }
      if (!backup || !mode) return res.status(400).json({ success: false, error: 'Backup data en modus vereist' })

      const validation = validateBackup(backup)
      if (!validation.valid) return res.status(400).json({ success: false, error: 'Ongeldig backup bestand', details: validation.errors })

      const result = await importBackup(backup, mode, session.user.display_name)
      return res.json({ success: result.success, data: result })
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Import mislukt' })
    }
  }

  return res.status(405).json({ success: false, error: 'Methode niet toegestaan' })
}
