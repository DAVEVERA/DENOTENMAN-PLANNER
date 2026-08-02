import { isDirectInvocation, verifyHoursSchema } from './verify-hours-schema.mjs'

export function shouldVerifyProductionSchema(env) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'production'
}

async function main() {
  if (!shouldVerifyProductionSchema(process.env)) {
    console.log('Production hours schema preflight skipped outside Vercel production.')
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
  console.log('Production hours schema preflight passed.')
}

if (isDirectInvocation(process.argv[1], import.meta.url)) {
  void main().catch(() => {
    console.error('Production hours schema preflight failed unexpectedly.')
    process.exitCode = 1
  })
}
