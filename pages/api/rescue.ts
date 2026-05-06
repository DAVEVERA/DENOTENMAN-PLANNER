import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertUser } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await upsertUser({
      username: 'dave',
      password: 'walnoot1',
      role: 'admin',
      employee_id: null,
      display_name: 'Dave Vera'
    })
    
    await upsertUser({
      username: 'fedor',
      password: 'walnoot2',
      role: 'admin',
      employee_id: null,
      display_name: 'Fedor'
    })
    
    res.json({ success: true, message: 'Users dave and fedor have been reset.' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: String(error) })
  }
}
