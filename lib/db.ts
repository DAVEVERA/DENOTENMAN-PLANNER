import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Lazy singleton — only instantiated on first runtime access, not at build time. */
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.'
    )
  }

  _supabase = createClient(url, key, { auth: { persistSession: false } })
  return _supabase
}

/** Backwards-compatible proxy — behaves like the old `supabase` export. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

const PREFIX = process.env.DB_PREFIX ?? 'planner20_'

/** Returns the full table name with prefix, e.g. "planner20_shifts" */
export const T = (table: string) => `${PREFIX}${table}`

/** Throw if Supabase returned an error, otherwise return the data. */
export function unwrap<D>(result: { data: D | null; error: unknown }): D {
  if (result.error) throw result.error
  return result.data as D
}
