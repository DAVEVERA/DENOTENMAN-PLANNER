export async function verifyInspectionSchema({
  supabaseUrl,
  serviceRoleKey,
  tablePrefix = 'planner20_',
  timeoutMs = 10000,
  fetchImpl = fetch,
}) {
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, code: 'MISSING_ENV', status: 0 }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablePrefix)) return { ok: false, code: 'INVALID_PREFIX', status: 0 }
  const headers = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, accept: 'application/json' }
  const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/`

  async function request(path, select) {
    const url = new URL(`/rest/v1/${path}`, baseUrl)
    if (select) { url.searchParams.set('select', select); url.searchParams.set('limit', '0') }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try { return await fetchImpl(url, { method: 'GET', headers, signal: controller.signal }) }
    finally { clearTimeout(timer) }
  }

  const probes = [
    [`${tablePrefix}employee_documents`, 'id,archived_at,archived_by,inspection_released'],
    [`${tablePrefix}users`, 'username,archived_at,archived_by'],
    [`${tablePrefix}expense_claims`, 'id,archived_at,archived_by'],
    [`${tablePrefix}chat_messages`, 'id,archived_at,archived_by'],
    [`${tablePrefix}inspection_document_state`, 'inspector_id,document_id,consecutive_views,next_allowed_at,blocked_until'],
    [`${tablePrefix}inspection_document_grants`, 'id,token_hash,session_hash,expires_at,consumed_at'],
    [`${tablePrefix}inspection_events`, 'id,inspector_id,action,created_at'],
    [`${tablePrefix}inspection_document_release_events`, 'id,document_id,released,actor_user_id,created_at'],
    [`${tablePrefix}document_storage_reconciliation`, 'id,storage_path,employee_id,reason,recorded_at,resolved_at'],
    [`${tablePrefix}inspection_login_attempts`, 'id,attempt_key_hash,succeeded,created_at'],
  ]
  try {
    for (const [table, select] of probes) {
      const response = await request(table, select)
      if (!response.ok) return { ok: false, code: `INSPECTION_SCHEMA_MISSING_${response.status}`, status: response.status }
    }
  } catch (error) {
    return { ok: false, code: error?.name === 'AbortError' ? 'TIMEOUT' : 'CONNECTION_FAILED', status: 0 }
  }

  const openApiUrl = new URL('/rest/v1/', baseUrl)
  const openApiResponse = await fetchImpl(openApiUrl, {
    method: 'GET', headers: { ...headers, accept: 'application/openapi+json' },
  })
  if (!openApiResponse.ok) return { ok: false, code: 'OPENAPI_UNAVAILABLE', status: openApiResponse.status }
  const specification = await openApiResponse.json().catch(() => null)
  const paths = specification?.paths ?? {}
  const requiredRpcs = [
    'request_inspection_document_view', 'consume_inspection_document_grant',
    'archive_employee_document', 'archive_user_account', 'archive_expense_claim',
    'set_document_inspection_release',
  ]
  if (requiredRpcs.some(name => !paths[`/rpc/${tablePrefix}${name}`])) {
    return { ok: false, code: 'INSPECTION_RPC_CONTRACT_MISSING', status: openApiResponse.status }
  }
  return { ok: true, status: openApiResponse.status }
}
