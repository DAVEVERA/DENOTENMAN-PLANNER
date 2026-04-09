import fs from 'fs'
import path from 'path'
import type { AppSettings } from '@/types'

const SETTINGS_FILE = path.join(process.cwd(), 'config', 'settings.json')

function defaults(): AppSettings {
  return {
    accountant_email:          '',
    accountant_name:           'Boekhouder',
    export_auto_email:         false,
    location_markt_name:       'De Notenkar (Markt)',
    location_nootmagazijn_name: 'Het Nootmagazijn',
  }
}

export function getSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    return { ...defaults(), ...JSON.parse(raw) }
  } catch {
    return defaults()
  }
}

export function saveSettings(s: Partial<AppSettings>): void {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...getSettings(), ...s }, null, 2))
}
