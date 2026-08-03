import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSamePlannedShift, isScheduleLocation, SCHEDULE_LOCATIONS } from '../../lib/schedule-view'
import { LOCATION_LABELS, type Shift } from '../../types'

const baseShift = {
  employee_id: 7,
  day_of_week: 'maandag',
  shift_type: 'Ochtend',
  start_time: '09:00',
  end_time: '13:00',
  full_day: 0,
  location: 'markt',
} as Shift

test('combined schedule is a supported primary view beside both specific locations', () => {
  assert.deepEqual(SCHEDULE_LOCATIONS, ['both', 'markt', 'nootmagazijn'])
  assert.equal(isScheduleLocation('both'), true)
  assert.equal(isScheduleLocation('unknown'), false)
})

test('copy-week identity keeps equal shifts on different locations separate', () => {
  assert.equal(isSamePlannedShift(baseShift, { ...baseShift }), true)
  assert.equal(isSamePlannedShift(baseShift, { ...baseShift, location: 'nootmagazijn' }), false)
  assert.equal(isSamePlannedShift(baseShift, { ...baseShift, start_time: '14:00', end_time: '18:00' }), false)
})

test('planner uses the short Markt and Magazijn location names', () => {
  assert.equal(LOCATION_LABELS.markt, 'Markt')
  assert.equal(LOCATION_LABELS.nootmagazijn, 'Magazijn')
})

test('shift modal exposes Hele dag as a pressed button and no Buddy control', () => {
  const modalSource = readFileSync(join(process.cwd(), 'components/ui/ShiftModal.tsx'), 'utf8')
  const automationSource = readFileSync(join(process.cwd(), 'lib/planning-automation.ts'), 'utf8')

  assert.match(modalSource, /className={`full-day-toggle\$\{fullDay \? ' active' : ''}`}/)
  assert.match(modalSource, /aria-pressed={fullDay}/)
  assert.doesNotMatch(modalSource, /htmlFor="buddy"|id="buddy"/i)
  assert.doesNotMatch(automationSource, /buddy:\s*src\.buddy/)
})
