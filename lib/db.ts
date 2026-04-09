import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
}

// Use the service role key server-side — bypasses Row Level Security
export const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
)

const PREFIX = process.env.DB_PREFIX ?? 'planner20_'

/** Returns the full table name with prefix, e.g. "planner20_shifts" */
export const T = (table: string) => `${PREFIX}${table}`

/** Throw if Supabase returned an error, otherwise return the data. */
export function unwrap<D>(result: { data: D | null; error: unknown }): D {
  if (result.error) throw result.error
  return result.data as D
}
