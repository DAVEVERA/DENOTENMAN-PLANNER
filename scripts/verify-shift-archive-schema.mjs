export async function verifyShiftArchiveSchema({
  supabaseUrl,
  serviceRoleKey,
  tablePrefix = 'planner20_',
  timeoutMs = 10000,
  fetchImpl = fetch,
}) {
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, code: 'MISSING_ENV', status: 0 }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablePrefix)) return { ok: false, code: 'INVALID_PREFIX', status: 0 }

  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: 'application/json',
  }

  async function request(url, init) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/`
  const tableUrl = new URL(`/rest/v1/${tablePrefix}shifts`, baseUrl)
  tableUrl.searchParams.set('select', 'id,archived_at,archived_by')
  tableUrl.searchParams.set('limit', '0')

  let columnsResponse
  try {
    columnsResponse = await request(tableUrl, { method: 'GET', headers })
  } catch (error) {
    return {
      ok: false,
      code: error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
        ? 'TIMEOUT'
        : 'CONNECTION_FAILED',
      status: 0,
    }
  }

  if (!columnsResponse.ok) {
    let code = 'SHIFT_ARCHIVE_COLUMNS_MISSING'
    try {
      const payload = await columnsResponse.json()
      if (payload && typeof payload === 'object' && 'code' in payload) code = String(payload.code)
    } catch {}
    return { ok: false, code, status: columnsResponse.status }
  }

  const rpcUrl = new URL(`/rest/v1/rpc/${tablePrefix}archive_shift`, baseUrl)
  let rpcResponse
  try {
    rpcResponse = await request(rpcUrl, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        p_shift_id: -2147483648,
        p_archived_by: 'production-schema-preflight',
      }),
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

  if (!rpcResponse.ok) return { ok: false, code: 'SHIFT_ARCHIVE_RPC_UNAVAILABLE', status: rpcResponse.status }
  try {
    const payload = await rpcResponse.json()
    if (payload?.status !== 'not_found' || payload.shift_id !== -2147483648) {
      return { ok: false, code: 'INVALID_SHIFT_ARCHIVE_CONTRACT', status: rpcResponse.status }
    }
  } catch {
    return { ok: false, code: 'MALFORMED_SHIFT_ARCHIVE_RESPONSE', status: rpcResponse.status }
  }

  return { ok: true, status: rpcResponse.status }
}

