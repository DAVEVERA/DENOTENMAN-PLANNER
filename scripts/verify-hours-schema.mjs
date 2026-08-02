const REQUIRED_COLUMNS = [
  'planned_clock_in',
  'planned_clock_out',
  'planned_break_minutes',
  'confirmation_mode',
  'submission_revision',
  'submitted_at',
]

export async function verifyHoursSchema({
  supabaseUrl,
  serviceRoleKey,
  tablePrefix = 'planner20_',
  timeoutMs = 10000,
  fetchImpl = fetch,
}) {
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, code: 'MISSING_ENV', status: 0 }
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablePrefix)) {
    return { ok: false, code: 'INVALID_PREFIX', status: 0 }
  }

  const table = `${tablePrefix}time_logs`
  const url = new URL(`/rest/v1/${table}`, `${supabaseUrl.replace(/\/$/, '')}/`)
  url.searchParams.set('select', REQUIRED_COLUMNS.join(','))
  url.searchParams.set('limit', '0')

  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: 'application/json',
  }

  async function request(requestUrl, init) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(requestUrl, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }

  let response
  try {
    response = await request(url, { method: 'GET', headers })
  } catch (error) {
    return {
      ok: false,
      code: error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
        ? 'TIMEOUT'
        : 'CONNECTION_FAILED',
      status: 0,
    }
  }

  if (response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return { ok: false, code: 'MALFORMED_RESPONSE', status: response.status }
    }
    try {
      const payload = await response.json()
      if (!Array.isArray(payload)) {
        return { ok: false, code: 'MALFORMED_RESPONSE', status: response.status }
      }
    } catch {
      return { ok: false, code: 'MALFORMED_RESPONSE', status: response.status }
    }
  } else {
    let code = 'SCHEMA_CHECK_FAILED'
    try {
      const payload = await response.json()
      if (payload && typeof payload === 'object' && 'code' in payload) {
        code = String(payload.code)
      }
    } catch {
      // Keep the stable generic code for non-JSON gateway responses.
    }
    return { ok: false, code, status: response.status }
  }

  const contractUrl = new URL('/rest/v1/rpc/planner20_verify_hours_submission_schema', `${supabaseUrl.replace(/\/$/, '')}/`)
  let contractResponse
  try {
    contractResponse = await request(contractUrl, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ target_table: table }),
    })
  } catch (error) {
    return {
      ok: false,
      code: error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
        ? 'TIMEOUT'
        : 'CONNECTION_FAILED',
      status: 0,
    }
  }

  if (!contractResponse.ok) {
    return { ok: false, code: 'CONTRACT_CHECK_FAILED', status: contractResponse.status }
  }

  try {
    const contract = await contractResponse.json()
    if (contract?.ready !== true
      || contract.required_columns !== 6
      || contract.required_constraints !== 2
      || contract.required_indexes !== 2) {
      return { ok: false, code: 'INCOMPLETE_SCHEMA_CONTRACT', status: contractResponse.status }
    }
  } catch {
    return { ok: false, code: 'MALFORMED_CONTRACT_RESPONSE', status: contractResponse.status }
  }

  return { ok: true, status: contractResponse.status }
}

async function main() {
  const result = await verifyHoursSchema({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tablePrefix: process.env.DB_PREFIX ?? 'planner20_',
  })

  if (!result.ok) {
    console.error(`Hours schema verification failed (${result.code}, HTTP ${result.status}).`)
    process.exitCode = 1
    return
  }
  console.log('Hours schema verification passed.')
}

function normalizeInvocationPath(value) {
  let normalized = decodeURIComponent(value).replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  if (/^\/[a-z]:\//i.test(normalized)) normalized = normalized.slice(1)
  return normalized.toLowerCase()
}

export function isDirectInvocation(argvPath, moduleUrl) {
  if (!argvPath) return false
  return normalizeInvocationPath(argvPath) === normalizeInvocationPath(new URL(moduleUrl).pathname)
}

if (isDirectInvocation(process.argv[1], import.meta.url)) {
  void main().catch(() => {
    console.error('Hours schema verification failed unexpectedly.')
    process.exitCode = 1
  })
}
