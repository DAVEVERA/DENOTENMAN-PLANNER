import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const scheduler = readFileSync('lib/scheduler.ts', 'utf8')
const adminOpenShifts = readFileSync('pages/admin/open-shifts.tsx', 'utf8')

test('admin removal of an open shift is a retained soft close', () => {
  const implementation = scheduler.match(
    /export async function withdrawOpenShift[\s\S]*?\n}\r?\n/,
  )?.[0] ?? ''

  assert.match(implementation, /is_open:\s*0/)
  assert.doesNotMatch(implementation, /deleteShift|\.delete\s*\(/)
  assert.match(implementation, /\.eq\('is_open',\s*1\)/)
})

test('admin open-shift UI has no destructive DELETE request', () => {
  assert.doesNotMatch(adminOpenShifts, /method:\s*['"]DELETE['"]/)
  assert.match(adminOpenShifts, /method:\s*['"]PATCH['"]/)
  assert.match(adminOpenShifts, /registratie blijft veilig bewaard/)
})
