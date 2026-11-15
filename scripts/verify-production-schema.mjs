import { isDirectInvocation, verifyHoursSchema } from './verify-hours-schema.mjs'
import { verifyShiftArchiveSchema } from './verify-shift-archive-schema.mjs'
import { verifyInspectionSchema } from './verify-inspection-schema.mjs'

export function shouldVerifyProductionSchema(env) {
  return env.PRODUCTION_SCHEMA_PREFLIGHT === '1'
    || (env.VERCEL === '1' && env.VERCEL_ENV === 'production')
}

async function main() {
  if (!shouldVerifyProductionSchema(process.env)) {
    console.log('Production schema preflight skipped; enable it with PRODUCTION_SCHEMA_PREFLIGHT=1 on non-Vercel production targets.')
    return
  }

  const result = await verifyHoursSchema({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tablePrefix: process.env.DB_PREFIX ?? 'planner20_',
  })
  if (!result.ok) {
    console.error(`Production hours schema preflight failed (${result.code}, HTTP ${result.status}).`)
    process.exitCode = 1
    return
  }
  const shiftArchiveResult = await verifyShiftArchiveSchema({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tablePrefix: process.env.DB_PREFIX ?? 'planner20_',
  })
  if (!shiftArchiveResult.ok) {
    console.error(`Production shift archive schema preflight failed (${shiftArchiveResult.code}, HTTP ${shiftArchiveResult.status}).`)
    process.exitCode = 1
    return
  }
  const inspectionResult = await verifyInspectionSchema({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tablePrefix: process.env.DB_PREFIX ?? 'planner20_',
  })
  if (!inspectionResult.ok) {
    console.error(`Production inspection schema preflight failed (${inspectionResult.code}, HTTP ${inspectionResult.status}).`)
    process.exitCode = 1
    return
  }
  console.log('Production hours, shift archive and inspection schema preflight passed.')
}

if (isDirectInvocation(process.argv[1], import.meta.url)) {
  void main().catch(() => {
    console.error('Production hours schema preflight failed unexpectedly.')
    process.exitCode = 1
  })
}
