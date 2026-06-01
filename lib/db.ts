import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Lazy singleton — only instantiated on first runtime access, not at build time. */
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    const missing = [
      !url ? 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL' : null,
      !key ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean).join(', ')
    throw new Error(
      `Missing required Supabase environment variable(s): ${missing}.`
    )
  }

  _supabase = createClient(url, key, { auth: { persistSession: false } })
  return _supabase
}

/**
 * Backwards-compatible proxy — behaves like the old `supabase` export.
 *
 * ⚠️  Type-safety trade-off: de `as unknown as Record` cast is bewust.
 * De Proxy zorgt voor lazy-loading (Supabase client wordt pas aangemaakt bij het
 * eerste echte request, niet tijdens Next.js build-time).
 * Gevolg: TypeScript kan foutieve property-namen niet compiletijd vangen op de
 * `supabase`-export zelf — die fouten manifesteren als runtime errors.
 * Gebruik `getSupabase()` als je de volledige typechecking wil behouden.
 */
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
