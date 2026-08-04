import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { isInspectorPathAllowed } from '../../lib/auth'
import { getBrusselsToday, validateServiceNumber } from '../../lib/inspection'
import { ROLE_CAPS } from '../../types'
import { verifyInspectionSchema } from '../../scripts/verify-inspection-schema.mjs'

const migration = readFileSync('supabase/migrations/20260804142500_belgian_inspection_environment.sql', 'utf8')
const canonicalSchema = readFileSync('supabase/schema.sql', 'utf8')
const overview = readFileSync('lib/inspection.ts', 'utf8')
const inspectionPage = readFileSync('pages/inspectie/index.tsx', 'utf8')
const inspectionContentApi = readFileSync('pages/api/inspectie/documenten/inhoud.ts', 'utf8')
const app = readFileSync('pages/_app.tsx', 'utf8')
const backup = readFileSync('lib/backup.ts', 'utf8')
const leave = readFileSync('lib/leave.ts', 'utf8')
const expenses = readFileSync('lib/expenses.ts', 'utf8')
const personalChat = readFileSync('pages/api/chat.ts', 'utf8')
const adminChat = readFileSync('pages/api/admin/chat-logs.ts', 'utf8')
const legacyUsersMigration = readFileSync('supabase/migrations/20260424_users_to_supabase.sql', 'utf8')
const legacyAmendments = readFileSync('supabase/migrations/20260424_amendments.sql', 'utf8')
const inspectionPreflight = readFileSync('scripts/verify-inspection-schema.mjs', 'utf8')
const employeeAdmin = readFileSync('pages/admin/employees/[id].tsx', 'utf8')

test('inspector role has one isolated capability and a deny-by-default path boundary', () => {
  assert.deepEqual(ROLE_CAPS.inspector, ['view_inspection'])
  assert.equal(isInspectorPathAllowed('/inspectie'), true)
  assert.equal(isInspectorPathAllowed('/api/inspectie/overzicht'), true)
  assert.equal(isInspectorPathAllowed('/inspectiex'), false)
  assert.equal(isInspectorPathAllowed('/api/inspectie-malicious'), false)
  assert.equal(isInspectorPathAllowed('/admin'), false)
  assert.equal(isInspectorPathAllowed('/api/shifts?week=32'), false)
  assert.equal(isInspectorPathAllowed('/me/documents'), false)
})

test('Brussels current day is server-derived across the UTC date boundary', () => {
  const result = getBrusselsToday(new Date('2026-08-03T22:30:00.000Z'))
  assert.deepEqual(result, { date: '2026-08-04', day: 'dinsdag', week: 32, year: 2026 })
})

test('service identifiers are narrow and never accepted as free-form text', () => {
  assert.equal(validateServiceNumber('BE-1234/7'), 'BE-1234/7')
  assert.equal(validateServiceNumber('ab'), null)
  assert.equal(validateServiceNumber('<script>alert(1)</script>'), null)
  assert.equal(validateServiceNumber('nummer met spaties'), null)
})

test('inspection migration is additive, private and server-enforced', () => {
  assert.doesNotMatch(migration, /\b(?:delete|truncate|drop|reset)\b/i)
  assert.match(migration, /add column if not exists archived_at/i)
  assert.match(migration, /enable row level security/gi)
  assert.match(migration, /revoke all[\s\S]+from public, anon, authenticated/i)
  assert.match(migration, /expires_at[\s\S]+interval '5 seconds'/i)
  assert.match(migration, /next_allowed_at = v_now \+ interval '15 seconds'/i)
  assert.match(migration, /interval '3 hours 5 seconds'/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /token_hash text not null unique/i)
  assert.match(migration, /session_hash text not null/i)
  assert.match(migration, /Europe\/Brussels/i)
  assert.match(migration, /lower\(u\.role\) = 'inspector' and u\.archived_at is null/i)
  assert.match(migration, /inspection_released boolean not null default false/i)
  assert.match(migration, /inspection_document_release_events/i)
  assert.match(migration, /grant select on table public\.planner20_inspection_document_release_events to service_role/i)
  assert.doesNotMatch(migration, /grant all on table public\.planner20_inspection_document_release_events/i)
  assert.match(migration, /and d\.inspection_released = true/i)
})

test('canonical schema mirrors the bounded inspection migration exactly once', () => {
  const startMarker = '-- Belgian inspection environment'
  const endMarker = '-- End Belgian inspection environment'
  const start = canonicalSchema.indexOf(startMarker)
  const end = canonicalSchema.indexOf(endMarker)
  assert.notEqual(start, -1)
  assert.ok(end > start)
  assert.equal(canonicalSchema.indexOf(startMarker, start + startMarker.length), -1)
  const mirrored = canonicalSchema.slice(start + startMarker.length, end).trim()
  assert.equal(mirrored, migration.trim())
})

test('inspection overview exposes metadata only for today market work', () => {
  assert.match(overview, /select\('employee_id, employee_name, start_time, end_time, full_day'\)/)
  assert.match(overview, /\.in\('location', \['markt', 'both'\]\)/)
  assert.match(overview, /INSPECTION_DOC_TYPES: DocType\[\] = \['legitimatie', 'arbeidsovereenkomst'\]/)
  assert.match(overview, /\.eq\('inspection_released', true\)/)
  assert.match(overview, /\.eq\('is_active', 1\)/)
  assert.doesNotMatch(overview.match(/export async function getInspectionOverview[\s\S]+?export async function recordInspectionOverview/)?.[0] ?? '', /storage_path|download_url|filename|notes/)
})

test('inspection client has in-app expiry controls and no third-party widgets', () => {
  assert.match(inspectionPage, /X-Inspection-Expires-At/)
  assert.match(inspectionPage, /visibilitychange/)
  assert.match(inspectionPage, /URL\.revokeObjectURL/)
  assert.match(inspectionPage, /Math\.min\(serverExpiresAt, Date\.now\(\) \+ 5_000\)/)
  assert.match(inspectionPage, /window\.setTimeout\(closeViewer/)
  assert.match(inspectionPage, /fetch\('\/api\/inspectie\/documenten\/inhoud', \{\s*method: 'POST'/)
  assert.doesNotMatch(inspectionPage, /inhoud\?token=/)
  assert.match(inspectionContentApi, /req\.method !== 'POST'/)
  assert.doesNotMatch(inspectionContentApi, /req\.query\.token/)
  assert.match(inspectionPage, /Shift\+F2/)
  assert.match(inspectionPage, /puur en alleen dit account/)
  assert.match(inspectionPage, /uniquement et exclusivement ce compte/)
  assert.match(app, /!isInspection && <AutomaticPushNotifications/)
  assert.match(app, /!isInspection && <CrispChat/)
})

test('inspection production preflight is read-only and rejects a missing contract', async () => {
  const requests: string[] = []
  const result = await verifyInspectionSchema({
    supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'test-key',
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method ?? 'GET'} ${String(url)}`)
      if (String(url).includes('inspection_document_state')) return new Response('{}', { status: 404 })
      if (String(url).includes('request_inspection_document_view')) return Response.json({ status: 'denied' })
      if (String(url).includes('/rpc/')) return Response.json(false)
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch,
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
  assert.ok(requests.every(request => request.startsWith('GET')))
  assert.doesNotMatch(inspectionPreflight, /method:\s*'POST'/)
  assert.match(inspectionPreflight, /application\/openapi\+json/)
})

test('admin inspection release controls are explicit and mobile touch safe', () => {
  assert.match(employeeAdmin, /Vrijgeven voor inspectie/)
  assert.match(employeeAdmin, /inspectionReleased/)
  assert.match(employeeAdmin, /@media \(max-width: 700px\)[\s\S]+min-height: 48px/)
  assert.match(employeeAdmin, /setDocActionId/)
  assert.match(employeeAdmin, /Controleer de verbinding/)
})

test('legacy high-risk removal paths now retain production rows', () => {
  assert.match(backup, /Vervangmodus is uitgeschakeld/)
  assert.doesNotMatch(backup, /\.delete\s*\(/)
  assert.doesNotMatch(backup, /\.update\(fields\)/)
  assert.match(leave, /archiveShift\(existing\.id, reviewedBy\)/)
  assert.doesNotMatch(leave, /\.delete\s*\(/)
  assert.match(expenses, /archive_expense_claim/)
  assert.doesNotMatch(expenses, /\.delete\s*\(/)
  assert.match(personalChat, /archived_at/)
  assert.match(adminChat, /archived_at/)
  assert.doesNotMatch(`${personalChat}\n${adminChat}`, /\.delete\s*\(/)
})

test('historical account migrations no longer embed shared password hashes or overwrite accounts', () => {
  assert.doesNotMatch(`${legacyUsersMigration}\n${legacyAmendments}`, /\$2[aby]\$/)
  assert.doesNotMatch(legacyUsersMigration, /on conflict \(username\) do update/i)
})
