import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CURRENT_RELEASE_UPDATE_VERSION,
  getReleaseUpdateContent,
  hasSeenReleaseUpdate,
  openReleaseUpdates,
  readReleaseUpdatePreference,
  releaseUpdatePreferenceKey,
} from '../../lib/release-updates'

test('release update copy stays role-specific and uses the approved location names', () => {
  const employee = getReleaseUpdateContent('employee')
  const admin = getReleaseUpdateContent('admin')

  assert.equal(employee.version, CURRENT_RELEASE_UPDATE_VERSION)
  assert.equal(admin.version, CURRENT_RELEASE_UPDATE_VERSION)
  assert.equal(employee.title, 'Plannen is weer een stukje makkelijker')
  assert.equal(admin.title, employee.title)
  assert.deepEqual(employee.items.map(item => item.title), [
    'Alles in één rooster',
    'Duidelijke locatienamen',
    'Jouw eigen rooster blijft staan',
  ])
  assert.deepEqual(admin.items.map(item => item.title), [
    'Beide locaties tegelijk',
    'Duidelijke locatienamen',
    'Hele dag met één knop',
    'Sneller een dienst invullen',
  ])
  assert.ok([...employee.items, ...admin.items].every(item =>
    !item.description.includes('De Notenkar') && !item.description.includes('Nootmagazijn')
  ))
})

test('release preference helpers are SSR-safe and isolated per user', () => {
  const preference = readReleaseUpdatePreference('employee 12')

  assert.deepEqual(preference, { schemaVersion: 1, autoShow: true, seenVersions: [] })
  assert.equal(hasSeenReleaseUpdate(preference, CURRENT_RELEASE_UPDATE_VERSION), false)
  assert.equal(releaseUpdatePreferenceKey('employee 12'), 'release-updates:preference:employee%2012')
  assert.equal(openReleaseUpdates(), false)
})
