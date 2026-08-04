import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const scheduler = readFileSync('lib/scheduler.ts', 'utf8')
const adminOpenShifts = readFileSync('pages/admin/open-shifts.tsx', 'utf8')
const adminPlanning = readFileSync('pages/admin/index.tsx', 'utf8')
const shiftApi = readFileSync('pages/api/shifts/[id].ts', 'utf8')
const shiftArchiveMigration = readFileSync('supabase/migrations/20260804131626_safe_shift_archiving.sql', 'utf8')

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

test('admin can remove regular shifts through retained archiving', () => {
  assert.match(adminPlanning, /method:\s*['"]DELETE['"]/)
  assert.match(adminPlanning, /volledige diensthistorie blijft veilig bewaard/i)
  assert.match(adminPlanning, /dienst van \$\{emp\.name\} verwijderen/)
  assert.match(shiftApi, /req\.method === ['"]DELETE['"][\s\S]+archiveShift\(id, session\.user\.user_id\)/)
  assert.doesNotMatch(shiftApi, /\.delete\s*\(/)
})

test('shift archive migration is additive, repeatable and retains the source row', () => {
  assert.match(shiftArchiveMigration, /add column if not exists archived_at timestamptz/i)
  assert.match(shiftArchiveMigration, /add column if not exists archived_by text/i)
  assert.match(shiftArchiveMigration, /create or replace function public\.planner20_archive_shift/i)
  assert.match(shiftArchiveMigration, /update public\.planner20_shifts\s+set archived_at = v_archived_at,\s+archived_by = p_archived_by/i)
  assert.match(shiftArchiveMigration, /pg_advisory_xact_lock\(20420, 0\)/i)
  assert.match(shiftArchiveMigration, /grant execute on function public\.planner20_archive_shift\(integer, text\)\s+to service_role/i)
  assert.doesNotMatch(shiftArchiveMigration, /\b(?:delete|truncate|drop|reset)\b/i)
})

test('active shift reads and conflicts exclude archived rows', () => {
  const activeFilters = scheduler.match(/\.is\(['"]archived_at['"],\s*null\)/g) ?? []
  assert.ok(activeFilters.length >= 8, `Expected active archive filters, found ${activeFilters.length}`)
  const conflictCheck = scheduler.match(/async function hasConflict[\s\S]*?\n}/)?.[0] ?? ''
  assert.match(conflictCheck, /\.is\(['"]archived_at['"],\s*null\)/)
  assert.match(shiftArchiveMigration, /status = 'cancelled'[\s\S]+source_shift_id = p_shift_id or target_shift_id = p_shift_id/i)
  assert.match(shiftArchiveMigration, /archived_shift_not_exchangeable/i)
})
