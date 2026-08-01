import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const migrationsDirectory = path.join(process.cwd(), 'supabase', 'migrations')
const migrationNames = readdirSync(migrationsDirectory)
  .filter(name => /^\d{14}_operational_team_chat\.sql$/.test(name))
  .sort()
const sql = migrationNames.length === 1
  ? readFileSync(path.join(migrationsDirectory, migrationNames[0]), 'utf8')
  : ''
const canonicalSchema = readFileSync(path.join(process.cwd(), 'supabase', 'schema.sql'), 'utf8')

const tables = [
  'planner20_team_conversations',
  'planner20_team_conversation_members',
  'planner20_team_chat_managers',
  'planner20_team_messages',
  'planner20_team_message_revisions',
  'planner20_team_message_reactions',
  'planner20_team_message_shift_links',
  'planner20_team_read_positions',
  'planner20_shift_exchange_requests',
  'planner20_shift_exchange_approvals',
  'planner20_planning_chat_events',
] as const

const sequenceTables = tables.filter(table => table !== 'planner20_shift_exchange_requests')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tableBlock = (table: string) => {
  const match = sql.match(new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${escapeRegExp(table)}\\b[\\s\\S]*?^\\);`,
    'im',
  ))
  assert.ok(match, `Missing bounded CREATE TABLE block for ${table}`)
  return match[0]
}

const rpcMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_respond_to_shift_exchange[\s\S]+?as\s+\$function\$([\s\S]+?)\$function\$;/i)
const rpc = rpcMatch?.[1] ?? ''
const shiftGuardMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_guard_shift_assignment[\s\S]+?as\s+\$shift_assignment_guard\$([\s\S]+?)\$shift_assignment_guard\$;/i)
const shiftGuard = shiftGuardMatch?.[1] ?? ''
const shiftStatementValidatorMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_validate_shift_assignment_statement[\s\S]+?as\s+\$shift_assignment_statement_validator\$([\s\S]+?)\$shift_assignment_statement_validator\$;/i)
const shiftStatementValidator = shiftStatementValidatorMatch?.[1] ?? ''
const createMessageMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_create_team_message[\s\S]+?as\s+\$create_team_message\$([\s\S]+?)\$create_team_message\$;/i)
const createMessageRpc = createMessageMatch?.[1] ?? ''
const ensureMembershipsMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_ensure_fixed_channel_memberships[\s\S]+?as\s+\$ensure_fixed_channel_memberships\$([\s\S]+?)\$ensure_fixed_channel_memberships\$;/i)
const ensureMembershipsRpc = ensureMembershipsMatch?.[1] ?? ''
const bootstrapStatsMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_team_chat_bootstrap_stats[\s\S]+?as\s+\$team_chat_bootstrap_stats\$([\s\S]+?)\$team_chat_bootstrap_stats\$;/i)
const bootstrapStatsRpc = bootstrapStatsMatch?.[1] ?? ''
const editMessageMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_edit_team_message[\s\S]+?as\s+\$edit_team_message\$([\s\S]+?)\$edit_team_message\$;/i)
const editMessageRpc = editMessageMatch?.[1] ?? ''
const toggleReactionMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_toggle_team_message_reaction[\s\S]+?as\s+\$toggle_team_message_reaction\$([\s\S]+?)\$toggle_team_message_reaction\$;/i)
const toggleReactionRpc = toggleReactionMatch?.[1] ?? ''
const markReadMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_mark_team_conversation_read[\s\S]+?as\s+\$mark_team_conversation_read\$([\s\S]+?)\$mark_team_conversation_read\$;/i)
const markReadRpc = markReadMatch?.[1] ?? ''
const createExchangeMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_create_shift_exchange[\s\S]+?as\s+\$create_shift_exchange\$([\s\S]+?)\$create_shift_exchange\$;/i)
const createExchangeRpc = createExchangeMatch?.[1] ?? ''
const publishPlanningTriggerMatch = sql.match(/create\s+or\s+replace\s+function\s+(?:public\.)?planner20_publish_planning_trigger[\s\S]+?as\s+\$publish_planning_trigger\$([\s\S]+?)\$publish_planning_trigger\$;/i)
const publishPlanningTriggerRpc = publishPlanningTriggerMatch?.[1] ?? ''

test('uses exactly one Supabase CLI-generated operational team chat migration', () => {
  assert.equal(migrationNames.length, 1, `Expected one operational migration, found: ${migrationNames.join(', ') || 'none'}`)
})

test('mirrors the migration exactly in one bounded canonical schema section', () => {
  const startMarker = '-- Operational team chat'
  const endMarker = '-- End operational team chat'
  const start = canonicalSchema.indexOf(startMarker)
  const end = canonicalSchema.indexOf(endMarker)

  assert.notEqual(start, -1, 'Missing operational team chat schema marker')
  assert.notEqual(end, -1, 'Missing operational team chat end marker')
  assert.equal(canonicalSchema.indexOf(startMarker, start + startMarker.length), -1, 'Operational section is duplicated')
  assert.equal(canonicalSchema.indexOf(endMarker, end + endMarker.length), -1, 'Operational end marker is duplicated')
  assert.ok(end > start, 'Operational schema markers are out of order')
  assert.equal(canonicalSchema.slice(start, end).trimEnd(), sql.trimEnd())
})

test('contains no destructive SQL', () => {
  assert.doesNotMatch(sql, /\b(delete\s+from|truncate|drop\s+(table|column|schema)|alter\s+table[^;]+drop)\b/i)
})

test('creates every operational chat table additively', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${escapeRegExp(table)}\\b`, 'i'))
  }
  assert.match(sql, /alter\s+table\s+(?:public\.)?planner20_shifts\s+add\s+column\s+if\s+not\s+exists\s+assignment_version\s+integer\s+not\s+null\s+default\s+0/i)
})

test('seeds the four exact fixed channels without changing existing rows', () => {
  assert.match(sql, /Nootities/)
  assert.match(sql, /Nootzakelijk/)
  assert.match(sql, /The Nootorious/)
  assert.match(sql, /NOOTSCHAP!!/)
  assert.match(sql, /on\s+conflict\s*\(\s*slug\s*\)\s+do\s+nothing/i)
  assert.match(sql, /insert\s+into\s+(?:public\.)?planner20_team_conversation_members[\s\S]+on\s+conflict[\s\S]+do\s+nothing/i)
  assert.match(sql, /insert\s+into\s+(?:public\.)?planner20_team_chat_managers[\s\S]+on\s+conflict[\s\S]+do\s+nothing/i)
  assert.match(sql, /kind\s*=\s*'channel'[\s\S]+is_fixed\s*=\s*true[\s\S]+status\s*=\s*'active'[\s\S]+archived_at\s+is\s+null/i)
  assert.match(sql, /slug\s*=\s*'nootities'\s+and\s+name\s*=\s*'Nootities'/i)
  assert.match(sql, /slug\s*=\s*'nootzakelijk'\s+and\s+name\s*=\s*'Nootzakelijk'/i)
  assert.match(sql, /slug\s*=\s*'the-nootorious'\s+and\s+name\s*=\s*'The Nootorious'/i)
  assert.match(sql, /slug\s*=\s*'nootschap'\s+and\s+name\s*=\s*'NOOTSCHAP!!'/i)
  assert.match(sql, /kind\s+in\s*\(\s*'direct'\s*,\s*'group'\s*\)[\s\S]+is_fixed\s*=\s*false[\s\S]+slug\s+is\s+null/i)
  assert.match(sql, /raise\s+exception[\s\S]+fixed channel seed conflict/i)
  assert.match(sql, /where\s*\([\s\S]+kind\s*=\s*'channel'[\s\S]+\)\s+is\s+not\s+true/i)
  assert.match(sql, /add\s+constraint\s+planner20_team_conversations_identity_check[\s\S]+check\s*\([\s\S]+\)\s+is\s+true\s*\)/i)
})

test('enables RLS and keeps browser roles off every new table', () => {
  const mutableTables = new Set([
    'planner20_team_conversations',
    'planner20_team_conversation_members',
    'planner20_team_chat_managers',
    'planner20_team_messages',
    'planner20_team_message_reactions',
    'planner20_team_read_positions',
    'planner20_shift_exchange_requests',
  ])

  for (const table of tables) {
    const escapedTable = escapeRegExp(table)
    assert.match(sql, new RegExp(`alter\\s+table\\s+(?:public\\.)?${escapedTable}\\s+enable\\s+row\\s+level\\s+security`, 'i'))
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+(?:public\\.)?${escapedTable}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, 'i'))
    const privileges = mutableTables.has(table) ? 'select\\s*,\\s*insert\\s*,\\s*update' : 'select\\s*,\\s*insert'
    assert.match(sql, new RegExp(`grant\\s+${privileges}\\s+on\\s+table\\s+(?:public\\.)?${escapedTable}\\s+to\\s+service_role`, 'i'))
  }
  assert.doesNotMatch(sql, /grant\s+(?:all|delete)\b/i)
})

test('grants only explicit sequence access to service_role', () => {
  for (const table of sequenceTables) {
    const sequence = `${table}_id_seq`
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+sequence\\s+(?:public\\.)?${escapeRegExp(sequence)}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, 'i'))
    assert.match(sql, new RegExp(`grant\\s+usage\\s*,\\s*select\\s+on\\s+sequence\\s+(?:public\\.)?${escapeRegExp(sequence)}\\s+to\\s+service_role`, 'i'))
  }
  assert.match(tableBlock('planner20_shift_exchange_requests'), /id\s+uuid\s+primary\s+key\s+default\s+gen_random_uuid\s*\(\s*\)/i)
})

test('uses restrictive foreign keys for chat, exchange and audit records', () => {
  for (const table of tables) {
    const block = tableBlock(table)
    const foreignKeyCount = block.match(/foreign\s+key\s*\(/gi)?.length ?? 0
    const restrictiveCount = block.match(/on\s+delete\s+restrict/gi)?.length ?? 0
    assert.equal(restrictiveCount, foreignKeyCount, `${table} must use ON DELETE RESTRICT for every foreign key`)
    assert.doesNotMatch(block, /on\s+delete\s+(?:cascade|set\s+null)/i)
  }
})

test('creates explicit indexes for every foreign-key column', () => {
  const indexedColumns = [
    'planner20_team_conversation_members_conversation_id_idx',
    'planner20_team_conversation_members_user_id_idx',
    'planner20_team_conversation_members_employee_id_idx',
    'planner20_team_conversations_owner_user_id_idx',
    'planner20_team_conversations_created_by_user_id_idx',
    'planner20_team_chat_managers_user_id_idx',
    'planner20_team_chat_managers_granted_by_user_id_idx',
    'planner20_team_messages_conversation_id_idx',
    'planner20_team_messages_sender_user_id_idx',
    'planner20_team_messages_sender_employee_id_idx',
    'planner20_team_messages_reply_to_message_id_idx',
    'planner20_team_message_revisions_message_id_idx',
    'planner20_team_message_revisions_editor_user_id_idx',
    'planner20_team_message_reactions_message_id_idx',
    'planner20_team_message_reactions_user_id_idx',
    'planner20_team_message_shift_links_message_id_idx',
    'planner20_team_message_shift_links_shift_id_idx',
    'planner20_team_message_shift_links_snapshot_employee_id_idx',
    'planner20_team_read_positions_conversation_id_idx',
    'planner20_team_read_positions_user_id_idx',
    'planner20_team_read_positions_last_read_message_id_idx',
    'planner20_shift_exchange_requests_conversation_id_idx',
    'planner20_shift_exchange_requests_source_shift_id_idx',
    'planner20_shift_exchange_requests_target_shift_id_idx',
    'planner20_shift_exchange_requests_initiator_user_id_idx',
    'planner20_shift_exchange_requests_initiator_employee_id_idx',
    'planner20_shift_exchange_requests_counterparty_user_id_idx',
    'planner20_shift_exchange_requests_counterparty_employee_id_idx',
    'planner20_shift_exchange_requests_source_employee_id_idx',
    'planner20_shift_exchange_requests_target_employee_id_idx',
    'planner20_shift_exchange_approvals_request_id_idx',
    'planner20_shift_exchange_approvals_actor_user_id_idx',
    'planner20_shift_exchange_approvals_actor_employee_id_idx',
    'planner20_planning_chat_events_conversation_id_idx',
    'planner20_planning_chat_events_request_id_idx',
    'planner20_planning_chat_events_message_id_idx',
    'planner20_planning_chat_events_actor_user_id_idx',
  ]
  for (const indexName of indexedColumns) {
    assert.match(sql, new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${escapeRegExp(indexName)}\\b`, 'i'))
  }
})

test('locks requests and shifts in a consistent order before transfer', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_respond_to_shift_exchange\s*\(\s*p_request_id\s+uuid\s*,\s*p_user_id\s+text\s*,\s*p_employee_id\s+integer\s*,\s*p_decision\s+text\s*\)\s*returns\s+jsonb/i)
  assert.match(sql, /language\s+plpgsql\s+security\s+invoker\s+set\s+search_path\s*=\s*public\s*,\s*pg_temp/i)
  assert.match(sql, /from\s+planner20_shift_exchange_requests[\s\S]+where\s+id\s*=\s*p_request_id[\s\S]+for\s+update/i)
  assert.match(sql, /from\s+planner20_shifts[\s\S]+order\s+by\s+(?:[a-z_]+\.)?id[\s\S]+for\s+update/i)
  assert.ok(rpc, 'Missing isolated exchange RPC body')
  const requestRowLock = rpc.indexOf('select request_row.*')
  const globalPlanningLock = rpc.indexOf('pg_catalog.pg_advisory_xact_lock(20420, 0)')
  const shiftRowLock = rpc.indexOf('perform shift_row.id')
  const overlapRead = rpc.indexOf('from planner20_shifts as existing_shift')
  const leaveRead = rpc.indexOf('from planner20_leave_requests as leave_request')
  assert.ok(globalPlanningLock >= 0, 'Missing global planning lock in RPC')
  assert.ok(requestRowLock < globalPlanningLock, 'Request row lock must precede the global planning lock')
  assert.ok(globalPlanningLock < shiftRowLock, 'Global planning lock must precede sorted shift row locks')
  assert.ok(shiftRowLock < overlapRead, 'Sorted shift row locks must precede overlap reads')
  assert.ok(shiftRowLock < leaveRead, 'Sorted shift row locks must precede leave reads')
})

test('serializes all shift and leave writes with one statement-level global planning lock', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_lock_planning_write\s*\(\s*\)\s*returns\s+trigger[\s\S]+security\s+invoker/i)
  assert.ok((sql.match(/pg_catalog\.pg_advisory_xact_lock\s*\(\s*20420\s*,\s*0\s*\)/gi) ?? []).length >= 2)
  assert.match(sql, /before\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.planner20_shifts\s+for\s+each\s+statement\s+execute\s+function\s+public\.planner20_lock_planning_write\s*\(\s*\)/i)
  assert.match(sql, /before\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.planner20_leave_requests\s+for\s+each\s+statement\s+execute\s+function\s+public\.planner20_lock_planning_write\s*\(\s*\)/i)
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.planner20_lock_planning_write\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i)
  assert.doesNotMatch(sql, /pg_catalog\.pg_advisory_xact_lock\s*\(\s*20420\s*,\s*v_employee_id\s*\)/i)
  assert.doesNotMatch(sql, /planner20_guard_approved_leave/i)

  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_guard_shift_assignment\s*\(\s*\)\s*returns\s+trigger/i)
  assert.match(sql, /new\.employee_id\s+is\s+distinct\s+from\s+old\.employee_id[\s\S]+new\.employee_name\s+is\s+distinct\s+from\s+old\.employee_name[\s\S]+new\.assignment_version\s*:=\s*old\.assignment_version\s*\+\s*1/i)
  assert.match(sql, /new\.assignment_version\s*<\s*old\.assignment_version[\s\S]+raise\s+exception/i)
  assert.match(sql, /before\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.planner20_shifts\s+for\s+each\s+row\s+execute\s+function\s+public\.planner20_guard_shift_assignment\s*\(\s*\)/i)
  assert.ok(shiftGuard, 'Missing isolated assignment-version row guard body')
  assert.doesNotMatch(shiftGuard, /from\s+(?:public\.)?planner20_shifts|from\s+(?:public\.)?planner20_leave_requests/i)
  assert.doesNotMatch(shiftGuard, /planner20_shift_overlap|planner20_shift_approved_leave/i)
  assert.match(sql, /from\s+pg_catalog\.pg_trigger[\s\S]+pg_catalog\.pg_class[\s\S]+pg_catalog\.pg_namespace/i)
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.planner20_guard_shift_assignment\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i)
  assert.doesNotMatch(sql, /drop\s+trigger/i)
})

test('validates the final work-shift statement state through transition tables', () => {
  assert.ok(shiftStatementValidator, 'Missing isolated AFTER STATEMENT shift validator body')
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_validate_shift_assignment_statement\s*\(\s*\)\s*returns\s+trigger[\s\S]+security\s+invoker/i)
  assert.match(shiftStatementValidator, /from\s+new_rows\s+as\s+changed_shift/i)
  assert.match(shiftStatementValidator, /changed_shift\.employee_id\s+is\s+not\s+null[\s\S]+lower\s*\(\s*trim\s*\(\s*changed_shift\.shift_type\s*\)\s*\)\s+not\s+in\s*\(\s*'verlof'\s*,\s*'vakantie'\s*,\s*'verzuim'\s*\)/i)
  assert.match(shiftStatementValidator, /existing_shift\.employee_id\s*=\s*changed_shift\.employee_id[\s\S]+existing_shift\.id\s*<>\s*changed_shift\.id[\s\S]+existing_shift\.week_number\s*=\s*changed_shift\.week_number[\s\S]+existing_shift\.year\s*=\s*changed_shift\.year[\s\S]+existing_shift\.day_of_week\s*=\s*changed_shift\.day_of_week/i)
  assert.match(sql, /lower\s*\(\s*trim\s*\(\s*existing_shift\.shift_type\s*\)\s*\)\s+not\s+in\s*\(\s*'verlof'\s*,\s*'vakantie'\s*,\s*'verzuim'\s*\)/i)
  assert.match(shiftStatementValidator, /existing_shift\.full_day\s*=\s*1[\s\S]+changed_shift\.full_day\s*=\s*1[\s\S]+existing_shift\.start_time\s+is\s+null[\s\S]+existing_shift\.end_time\s+is\s+null[\s\S]+changed_shift\.start_time\s+is\s+null[\s\S]+changed_shift\.end_time\s+is\s+null[\s\S]+existing_shift\.start_time\s*<\s*changed_shift\.end_time[\s\S]+existing_shift\.end_time\s*>\s*changed_shift\.start_time/i)
  assert.match(sql, /raise\s+exception[\s\S]+planner20_shift_overlap/i)
  assert.match(shiftStatementValidator, /from\s+new_rows\s+as\s+changed_shift[\s\S]+join\s+public\.planner20_leave_requests\s+as\s+leave_request[\s\S]+leave_request\.status\s*=\s*'approved'[\s\S]+to_date\s*\([\s\S]+'IYYY-IW-ID'[\s\S]+between\s+leave_request\.start_date\s+and\s+leave_request\.end_date/i)
  assert.match(sql, /raise\s+exception[\s\S]+planner20_shift_approved_leave/i)
  assert.match(sql, /after\s+insert\s+on\s+public\.planner20_shifts\s+referencing\s+new\s+table\s+as\s+new_rows\s+for\s+each\s+statement\s+execute\s+function\s+public\.planner20_validate_shift_assignment_statement\s*\(\s*\)/i)
  assert.match(sql, /after\s+update\s+on\s+public\.planner20_shifts\s+referencing\s+new\s+table\s+as\s+new_rows\s+for\s+each\s+statement\s+execute\s+function\s+public\.planner20_validate_shift_assignment_statement\s*\(\s*\)/i)
  assert.match(sql, /do\s+\$shift_assignment_insert_statement_trigger\$[\s\S]+tgname\s*=\s*'planner20_validate_shift_assignment_insert_trigger'[\s\S]+create\s+trigger\s+planner20_validate_shift_assignment_insert_trigger[\s\S]+\$shift_assignment_insert_statement_trigger\$\s*;/i)
  assert.match(sql, /do\s+\$shift_assignment_update_statement_trigger\$[\s\S]+tgname\s*=\s*'planner20_validate_shift_assignment_update_trigger'[\s\S]+create\s+trigger\s+planner20_validate_shift_assignment_update_trigger[\s\S]+\$shift_assignment_update_statement_trigger\$\s*;/i)
  assert.doesNotMatch(sql, /after\s+insert\s+or\s+update[\s\S]+referencing\s+new\s+table/i)
  assert.doesNotMatch(sql, /\b(?:current_setting|set_config)\s*\(/i)
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.planner20_validate_shift_assignment_statement\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i)
})

test('applies both sides of a swap in one statement before final-state validation', () => {
  const transferBlock = rpc.match(/if\s+v_request\.kind\s*=\s*'takeover'\s+then\s+update\s+planner20_shifts([\s\S]+?)end\s+if\s*;/i)?.[0] ?? ''
  assert.ok(transferBlock, 'Missing final takeover/swap transfer block')
  assert.equal((transferBlock.match(/update\s+planner20_shifts/gi) ?? []).length, 2, 'Expected one takeover UPDATE and one atomic swap UPDATE')
  assert.match(transferBlock, /else\s+update\s+planner20_shifts\s+set\s+employee_id\s*=\s*case\s+when\s+id\s*=\s*v_source_shift\.id\s+then\s+v_new_source_employee_id\s+when\s+id\s*=\s*v_target_shift\.id\s+then\s+v_new_target_employee_id\s+end/i)
  assert.match(transferBlock, /employee_name\s*=\s*case\s+when\s+id\s*=\s*v_source_shift\.id\s+then\s+v_new_source_employee_name\s+when\s+id\s*=\s*v_target_shift\.id\s+then\s+v_new_target_employee_name\s+end[\s\S]+assignment_version\s*=\s*assignment_version\s*\+\s*1[\s\S]+where\s+id\s+in\s*\(\s*v_source_shift\.id\s*,\s*v_target_shift\.id\s*\)/i)
})

test('returns stable RPC overlap conflicts for conservative nullable-time cases', () => {
  const sourceOverlapPrecheck = rpc.match(/if\s+exists\s*\([\s\S]+?existing_shift\.employee_id\s*=\s*v_new_source_employee_id[\s\S]+?conflict_code\s*=\s*'source_overlap'[\s\S]+?end\s+if\s*;/i)?.[0] ?? ''
  const targetOverlapPrecheck = rpc.match(/if\s+exists\s*\([\s\S]+?existing_shift\.employee_id\s*=\s*v_new_target_employee_id[\s\S]+?conflict_code\s*=\s*'target_overlap'[\s\S]+?end\s+if\s*;/i)?.[0] ?? ''
  assert.ok(sourceOverlapPrecheck, 'Missing isolated source-overlap precheck')
  assert.ok(targetOverlapPrecheck, 'Missing isolated target-overlap precheck')

  assert.match(sourceOverlapPrecheck, /existing_shift\.full_day\s*=\s*1[\s\S]+v_source_shift\.full_day\s*=\s*1[\s\S]+existing_shift\.start_time\s+is\s+null[\s\S]+existing_shift\.end_time\s+is\s+null[\s\S]+v_source_shift\.start_time\s+is\s+null[\s\S]+v_source_shift\.end_time\s+is\s+null[\s\S]+existing_shift\.start_time\s*<\s*v_source_shift\.end_time[\s\S]+existing_shift\.end_time\s*>\s*v_source_shift\.start_time/i)
  assert.match(targetOverlapPrecheck, /existing_shift\.full_day\s*=\s*1[\s\S]+v_target_shift\.full_day\s*=\s*1[\s\S]+existing_shift\.start_time\s+is\s+null[\s\S]+existing_shift\.end_time\s+is\s+null[\s\S]+v_target_shift\.start_time\s+is\s+null[\s\S]+v_target_shift\.end_time\s+is\s+null[\s\S]+existing_shift\.start_time\s*<\s*v_target_shift\.end_time[\s\S]+existing_shift\.end_time\s*>\s*v_target_shift\.start_time/i)
})

test('rejects absence shifts as exchange sources or targets', () => {
  assert.match(rpc, /lower\s*\(\s*trim\s*\(\s*v_source_shift\.shift_type\s*\)\s*\)\s+in\s*\(\s*'verlof'\s*,\s*'vakantie'\s*,\s*'verzuim'\s*\)[\s\S]+source_shift_not_exchangeable/i)
  assert.match(rpc, /lower\s*\(\s*trim\s*\(\s*v_target_shift\.shift_type\s*\)\s*\)\s+in\s*\(\s*'verlof'\s*,\s*'vakantie'\s*,\s*'verzuim'\s*\)[\s\S]+target_shift_not_exchangeable/i)
})

test('keeps canonical channel identities immutable across transitions and deletes', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_guard_team_conversation_identity\s*\(\s*\)\s*returns\s+trigger[\s\S]+security\s+invoker/i)
  assert.match(sql, /tg_op\s*=\s*'DELETE'[\s\S]+old\.slug\s+in\s*\(\s*'nootities'\s*,\s*'nootzakelijk'\s*,\s*'the-nootorious'\s*,\s*'nootschap'\s*\)[\s\S]+planner20_fixed_channel_immutable/i)
  assert.match(sql, /tg_op\s*=\s*'UPDATE'[\s\S]+old\.slug\s*=\s*'nootities'[\s\S]+new\.slug\s*=\s*'nootities'[\s\S]+new\.name\s*=\s*'Nootities'[\s\S]+new\.kind\s*=\s*'channel'[\s\S]+new\.is_fixed\s*=\s*true[\s\S]+new\.status\s*=\s*'active'[\s\S]+new\.archived_at\s+is\s+null/i)
  assert.match(sql, /new\.kind\s*=\s*'channel'[\s\S]+new\.slug\s*=\s*'nootities'\s+and\s+new\.name\s*=\s*'Nootities'[\s\S]+planner20_invalid_conversation_identity/i)
  assert.ok((sql.match(/\)\s+is\s+not\s+true/gi) ?? []).length >= 6, 'Canonical identity guards must reject SQL NULL/unknown states')
  assert.match(sql, /new\.kind\s+in\s*\(\s*'direct'\s*,\s*'group'\s*\)[\s\S]+new\.is_fixed\s*=\s*false[\s\S]+new\.slug\s+is\s+null/i)
  assert.match(sql, /before\s+insert\s+or\s+update\s+or\s+delete\s+on\s+public\.planner20_team_conversations\s+for\s+each\s+row\s+execute\s+function\s+public\.planner20_guard_team_conversation_identity\s*\(\s*\)/i)
  assert.match(sql, /revoke\s+all\s+on\s+function\s+public\.planner20_guard_team_conversation_identity\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i)
})

test('creates text GIF or shift messages atomically behind database guards', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_create_team_message\s*\(\s*p_user_id\s+text\s*,\s*p_employee_id\s+integer\s*,\s*p_conversation_id\s+bigint\s*,\s*p_client_nonce\s+uuid\s*,\s*p_body\s+text\s*,\s*p_gif_provider\s+text\s*,\s*p_gif_provider_id\s+text\s*,\s*p_gif_url\s+text\s*,\s*p_gif_width\s+integer\s*,\s*p_gif_height\s+integer\s*,\s*p_shift_id\s+integer\s*,\s*p_reply_to_message_id\s+bigint\s*\)\s*returns\s+jsonb/i)
  assert.ok(createMessageRpc, 'Missing isolated create-team-message RPC body')
  assert.match(createMessageRpc, /from\s+planner20_users\s+as\s+account[\s\S]+v_account\.employee_id\s+is\s+null[\s\S]+lower\s*\(\s*v_account\.role\s*\)\s*<>\s*'admin'[\s\S]+employee\.is_active\s*=\s*1/i)
  assert.match(createMessageRpc, /from\s+planner20_team_conversations\s+as\s+conversation[\s\S]+conversation\.status\s*=\s*'active'[\s\S]+conversation\.archived_at\s+is\s+null/i)
  assert.match(createMessageRpc, /from\s+planner20_team_conversation_members\s+as\s+membership[\s\S]+membership\.user_id\s*=\s*p_user_id[\s\S]+membership\.inactive_at\s+is\s+null/i)
  assert.match(createMessageRpc, /from\s+planner20_team_messages\s+as\s+reply_message[\s\S]+reply_message\.id\s*=\s*p_reply_to_message_id[\s\S]+reply_message\.conversation_id\s*=\s*p_conversation_id[\s\S]+reply_message_not_in_conversation/i)
  assert.match(createMessageRpc, /num_nonnulls[\s\S]+v_content_count\s*<>\s*1[\s\S]+invalid_content/i)
  assert.match(createMessageRpc, /p_gif_provider\s*<>\s*'giphy'[\s\S]+p_gif_url\s*!~\*[\s\S]+media\\?\.giphy\\?\.com[\s\S]+media0\\?\.giphy\\?\.com[\s\S]+invalid_giphy/i)
  assert.match(createMessageRpc, /insert\s+into\s+planner20_team_messages[\s\S]+returning\s+\*\s+into\s+v_message[\s\S]+insert\s+into\s+planner20_team_message_shift_links/i)
  assert.doesNotMatch(createMessageRpc, /delete\s+from/i)
  assert.ok(createMessageRpc.indexOf('exception\n      when unique_violation') < createMessageRpc.indexOf('insert into planner20_team_message_shift_links'), 'Shift-link writes must remain outside the nonce-race handler')
})

test('returns nonce duplicates with their existing immutable shift snapshot', () => {
  assert.match(createMessageRpc, /where\s+message\.sender_user_id\s*=\s*p_user_id[\s\S]+message\.client_nonce\s*=\s*p_client_nonce[\s\S]+client_nonce_conversation_conflict/i)
  assert.match(createMessageRpc, /exception\s+when\s+unique_violation[\s\S]+where\s+message\.sender_user_id\s*=\s*p_user_id[\s\S]+message\.client_nonce\s*=\s*p_client_nonce/i)
  assert.match(createMessageRpc, /from\s+planner20_team_message_shift_links\s+as\s+shift_link[\s\S]+shift_link\.message_id\s*=\s*v_message\.id/i)
  assert.match(createMessageRpc, /'status'\s*,\s*v_result_status[\s\S]+'error_code'\s*,\s*null[\s\S]+'message'[\s\S]+'shift'/i)
})

test('reactivates exactly four fixed memberships without resetting preferences or roles', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_ensure_fixed_channel_memberships\s*\(\s*p_user_id\s+text\s*,\s*p_employee_id\s+integer\s*\)\s*returns\s+jsonb/i)
  assert.ok(ensureMembershipsRpc, 'Missing isolated fixed-membership RPC body')
  assert.match(ensureMembershipsRpc, /from\s+planner20_users\s+as\s+account[\s\S]+v_account\.employee_id\s+is\s+null[\s\S]+lower\s*\(\s*v_account\.role\s*\)\s*<>\s*'admin'[\s\S]+employee\.is_active\s*=\s*1/i)
  assert.match(ensureMembershipsRpc, /count\s*\(\s*\*\s*\)[\s\S]+slug\s+in\s*\(\s*'nootities'\s*,\s*'nootzakelijk'\s*,\s*'the-nootorious'\s*,\s*'nootschap'\s*\)[\s\S]+<>\s*4[\s\S]+fixed_channels_unavailable/i)
  assert.match(ensureMembershipsRpc, /insert\s+into\s+planner20_team_conversation_members[\s\S]+on\s+conflict\s*\(\s*conversation_id\s*,\s*user_id\s*\)\s+do\s+update\s+set\s+employee_id\s*=\s*excluded\.employee_id\s*,\s*inactive_at\s*=\s*null\s*,\s*updated_at\s*=\s*now\s*\(\s*\)/i)
  const conflictUpdate = ensureMembershipsRpc.match(/on\s+conflict\s*\(\s*conversation_id\s*,\s*user_id\s*\)\s+do\s+update\s+set([\s\S]+?)\s+returning/i)?.[1] ?? ''
  assert.ok(conflictUpdate, 'Missing isolated fixed-membership conflict update')
  assert.doesNotMatch(conflictUpdate, /member_role|notification_preference/i)
  assert.match(ensureMembershipsRpc, /'status'\s*,\s*'ok'[\s\S]+'membership_count'\s*,\s*v_membership_count/i)
})

test('batches bootstrap message stats with correct per-user unread semantics', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+(?:public\.)?planner20_team_chat_bootstrap_stats\s*\(\s*p_user_id\s+text\s*,\s*p_conversation_ids\s+bigint\s*\[\s*\]\s*\)\s*returns\s+jsonb/i)
  assert.ok(bootstrapStatsRpc, 'Missing isolated bootstrap-stats RPC body')
  assert.match(bootstrapStatsRpc, /from\s+planner20_users\s+as\s+account[\s\S]+v_account\.employee_id\s+is\s+null[\s\S]+lower\s*\(\s*v_account\.role\s*\)\s*<>\s*'admin'[\s\S]+planner20_employees[\s\S]+employee\.is_active\s*=\s*1/i)
  assert.match(bootstrapStatsRpc, /unnest\s*\(\s*coalesce\s*\(\s*p_conversation_ids\s*,\s*array\s*\[\s*\]\s*::\s*bigint\s*\[\s*\]\s*\)\s*\)/i)
  assert.match(bootstrapStatsRpc, /join\s+planner20_team_conversation_members\s+as\s+membership[\s\S]+membership\.user_id\s*=\s*p_user_id[\s\S]+membership\.inactive_at\s+is\s+null[\s\S]+conversation\.status\s*=\s*'active'[\s\S]+conversation\.archived_at\s+is\s+null/i)
  assert.match(bootstrapStatsRpc, /join\s+planner20_team_read_positions\s+as\s+read_position[\s\S]+read_position\.conversation_id\s*=\s*accessible\.conversation_id[\s\S]+read_position\.user_id\s*=\s*p_user_id/i)
  assert.match(bootstrapStatsRpc, /unread_message\.id\s*>\s*coalesce\s*\(\s*read_cursors\.last_read_message_id\s*,\s*0\s*\)[\s\S]+unread_message\.sender_user_id\s+is\s+distinct\s+from\s+p_user_id/i)
  assert.match(bootstrapStatsRpc, /latest_message_id[\s\S]+latest_message_at[\s\S]+unread_count/i)
  assert.doesNotMatch(bootstrapStatsRpc, /\bloop\b|for\s+.+\s+in\s+select/i)
})

test('binds read cursors to messages in the same conversation additively', () => {
  assert.match(sql, /add\s+constraint\s+planner20_team_messages_conversation_id_id_key\s+unique\s*\(\s*conversation_id\s*,\s*id\s*\)/i)
  assert.match(sql, /add\s+constraint\s+planner20_team_read_positions_conversation_message_fkey\s+foreign\s+key\s*\(\s*conversation_id\s*,\s*last_read_message_id\s*\)\s+references\s+public\.planner20_team_messages\s*\(\s*conversation_id\s*,\s*id\s*\)\s+on\s+delete\s+restrict\s+not\s+valid/i)
  assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+planner20_team_read_positions_conversation_message_idx\s+on\s+public\.planner20_team_read_positions\s*\(\s*conversation_id\s*,\s*last_read_message_id\s*\)/i)
  assert.match(sql, /from\s+pg_catalog\.pg_constraint[\s\S]+conname\s*=\s*'planner20_team_messages_conversation_id_id_key'[\s\S]+from\s+pg_catalog\.pg_constraint[\s\S]+conname\s*=\s*'planner20_team_read_positions_conversation_message_fkey'/i)
})

test('restricts all Task 3 chat RPCs to service_role with invoker security', () => {
  const functions = [
    ['planner20_create_team_message', 'text, integer, bigint, uuid, text, text, text, text, integer, integer, integer, bigint'],
    ['planner20_ensure_fixed_channel_memberships', 'text, integer'],
    ['planner20_team_chat_bootstrap_stats', 'text, bigint[]'],
  ] as const

  for (const [functionName, signature] of functions) {
    const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]+?security\\s+invoker\\s+set\\s+search_path\\s*=\\s*public\\s*,\\s*pg_temp`, 'i'))
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(\\s*${escapedSignature}\\s*\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, 'i'))
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(\\s*${escapedSignature}\\s*\\)\\s+to\\s+service_role`, 'i'))
  }
})

test('edits text messages atomically while preserving an append-only revision', () => {
  assert.ok(editMessageRpc, 'Missing isolated edit-message RPC body')
  assert.match(editMessageRpc, /from\s+planner20_team_messages\s+as\s+message[\s\S]+for\s+update/i)
  assert.match(editMessageRpc, /v_message\.sender_user_id\s+is\s+distinct\s+from\s+p_user_id[\s\S]+v_message\.message_type\s*<>\s*'text'/i)
  const revisionInsert = editMessageRpc.indexOf('insert into planner20_team_message_revisions')
  const messageUpdate = editMessageRpc.indexOf('update planner20_team_messages')
  assert.ok(revisionInsert >= 0 && messageUpdate > revisionInsert, 'Revision must be inserted before the message update in one RPC')
  assert.match(editMessageRpc, /previous_body[\s\S]+new_body[\s\S]+edited_at\s*=\s*now\s*\(\s*\)/i)
  assert.doesNotMatch(editMessageRpc, /delete\s+from/i)
})

test('toggles reactions by inactive_at without deleting history', () => {
  assert.ok(toggleReactionRpc, 'Missing isolated reaction-toggle RPC body')
  assert.match(toggleReactionRpc, /insert\s+into\s+planner20_team_message_reactions[\s\S]+on\s+conflict\s*\(\s*message_id\s*,\s*user_id\s*,\s*emoji\s*\)\s+do\s+update/i)
  assert.match(toggleReactionRpc, /inactive_at\s*=\s*case[\s\S]+inactive_at\s+is\s+null[\s\S]+then\s+now\s*\(\s*\)[\s\S]+else\s+null/i)
  assert.match(toggleReactionRpc, /count\s*\(\s*\*\s*\)[\s\S]+inactive_at\s+is\s+null/i)
  assert.doesNotMatch(toggleReactionRpc, /delete\s+from/i)
})

test('moves read state forward only and validates the conversation message pair', () => {
  assert.ok(markReadRpc, 'Missing isolated mark-read RPC body')
  assert.match(markReadRpc, /message\.id\s*=\s*p_message_id[\s\S]+message\.conversation_id\s*=\s*p_conversation_id/i)
  assert.match(markReadRpc, /insert\s+into\s+planner20_team_read_positions[\s\S]+on\s+conflict\s*\(\s*conversation_id\s*,\s*user_id\s*\)\s+do\s+update/i)
  assert.match(markReadRpc, /last_read_message_id\s*=\s*greatest\s*\(/i)
  assert.match(markReadRpc, /excluded\.last_read_message_id\s*>\s*coalesce\s*\(/i)
  assert.doesNotMatch(markReadRpc, /delete\s+from/i)
})

test('restricts all Task 4 mutation RPCs to service_role', () => {
  const functions = [
    ['planner20_edit_team_message', 'text, integer, bigint, text'],
    ['planner20_toggle_team_message_reaction', 'text, integer, bigint, text'],
    ['planner20_mark_team_conversation_read', 'text, integer, bigint, bigint'],
  ] as const
  for (const [functionName, signature] of functions) {
    const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]+?security\\s+invoker\\s+set\\s+search_path\\s*=\\s*public\\s*,\\s*pg_temp`, 'i'))
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(\\s*${escapedSignature}\\s*\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`, 'i'))
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(\\s*${escapedSignature}\\s*\\)\\s+to\\s+service_role`, 'i'))
  }
})

test('creates an exchange request, first approval, pending message and audit event atomically', () => {
  const body = createExchangeRpc
  assert.ok(body, 'Missing isolated create-exchange RPC body')
  assert.match(body, /for update/i)
  assert.match(body, /insert into planner20_shift_exchange_requests/i)
  assert.match(body, /insert into planner20_shift_exchange_approvals/i)
  assert.match(body, /insert into planner20_team_messages/i)
  assert.match(body, /insert into planner20_planning_chat_events/i)
  assert.match(body, /on conflict \(initiator_user_id, client_nonce\) do nothing/i)
  assert.match(body, /takeover_source_owned_by_initiator/i)
  assert.match(body, /swap_source_not_owned_by_initiator/i)
  assert.match(body, /counterparty_account_not_found/i)
})

test('restricts exchange creation to service_role with invoker security', () => {
  assert.match(sql, /create or replace function public\.planner20_create_shift_exchange\([\s\S]*?security invoker/i)
  assert.match(sql, /revoke all on function public\.planner20_create_shift_exchange\([\s\S]*?from PUBLIC, anon, authenticated, service_role;/i)
  assert.match(sql, /grant execute on function public\.planner20_create_shift_exchange\([\s\S]*?to service_role;/i)
})

test('publishes planning-to-chat triggers idempotently without touching the roster', () => {
  assert.ok(publishPlanningTriggerRpc, 'Missing isolated planning trigger RPC body')
  assert.match(publishPlanningTriggerRpc, /insert into planner20_team_messages/i)
  assert.match(publishPlanningTriggerRpc, /on conflict \(system_event_key\) do nothing/i)
  assert.match(publishPlanningTriggerRpc, /insert into planner20_planning_chat_events/i)
  assert.match(publishPlanningTriggerRpc, /team_chat_managers/i)
  assert.doesNotMatch(publishPlanningTriggerRpc, /(?:update|insert into)\s+planner20_shifts/i)
  assert.doesNotMatch(publishPlanningTriggerRpc, /delete\s+from/i)
  assert.match(sql, /revoke all on function public\.planner20_publish_planning_trigger\([\s\S]*?from PUBLIC, anon, authenticated, service_role;/i)
  assert.match(sql, /grant execute on function public\.planner20_publish_planning_trigger\([\s\S]*?to service_role;/i)
})

test('enforces two-party idempotent approval and assignment guardrails', () => {
  assert.match(sql, /initiator_user_id/)
  assert.match(sql, /counterparty_user_id/)
  assert.match(sql, /on\s+conflict\s*\(\s*request_id\s*,\s*actor_user_id\s*\)\s+do\s+nothing/i)
  assert.match(sql, /count\s*\(\s*distinct\s+actor_user_id\s*\)/i)
  assert.match(sql, /source_assignment_version/i)
  assert.match(sql, /target_assignment_version/i)
  assert.match(sql, /source_employee_id/i)
  assert.match(sql, /target_employee_id/i)
  assert.match(sql, /planner20_leave_requests/i)
  assert.match(sql, /status\s*=\s*'approved'/i)
  assert.match(sql, /start_time\s*</i)
  assert.match(sql, /end_time\s*>/i)
  assert.match(sql, /p_decision\s+is\s+null\s+or\s+p_decision\s+not\s+in/i)
  assert.match(sql, /timezone\s*\(\s*'Europe\/Amsterdam'\s*,\s*now\s*\(\s*\)\s*\)/i)
  assert.match(sql, /v_source_date\s*=\s*v_amsterdam_now::date[\s\S]+v_source_shift\.start_time\s+is\s+null[\s\S]+v_source_shift\.full_day\s*=\s*1[\s\S]+v_source_date\s*\+\s*v_source_shift\.start_time\s*<=\s*v_amsterdam_now/i)
  assert.match(sql, /v_target_date\s*=\s*v_amsterdam_now::date[\s\S]+v_target_shift\.start_time\s+is\s+null[\s\S]+v_target_shift\.full_day\s*=\s*1[\s\S]+v_target_date\s*\+\s*v_target_shift\.start_time\s*<=\s*v_amsterdam_now/i)
  assert.match(sql, /v_request\.initiator_employee_id\s+is\s+distinct\s+from\s+v_request\.source_employee_id/i)
  assert.match(sql, /v_request\.counterparty_employee_id\s+is\s+distinct\s+from\s+v_request\.source_employee_id/i)
  assert.match(sql, /v_request\.initiator_employee_id\s*=\s*v_request\.source_employee_id[\s\S]+v_request\.counterparty_employee_id\s*=\s*v_request\.target_employee_id/i)
  assert.match(sql, /v_request\.initiator_employee_id\s*=\s*v_request\.target_employee_id[\s\S]+v_request\.counterparty_employee_id\s*=\s*v_request\.source_employee_id/i)
})

test('authorizes the actor before every terminal or expiry response', () => {
  assert.ok(rpc, 'Missing isolated exchange RPC body')
  const requestFetch = rpc.indexOf('select request_row.*')
  const actorValidation = rpc.indexOf('if p_user_id = v_request.initiator_user_id')
  const completedReturn = rpc.indexOf("if v_request.status = 'completed'")
  const nonPendingReturn = rpc.indexOf("if v_request.status <> 'pending'")
  const expiryMutation = rpc.indexOf('if v_request.expires_at <= now()')
  assert.ok(requestFetch >= 0 && actorValidation > requestFetch)
  assert.ok(actorValidation < completedReturn)
  assert.ok(actorValidation < nonPendingReturn)
  assert.ok(actorValidation < expiryMutation)
  assert.match(rpc, /if\s+v_request\.status\s*=\s*'completed'[\s\S]+?'completed'\s*,\s*true/i)
})

test('whitelists every shift column changed by the exchange RPC', () => {
  assert.ok(rpc, 'Missing isolated exchange RPC body')
  const updates = [...rpc.matchAll(/update\s+planner20_shifts\s+set([\s\S]+?)\s+where\s+id\s*(?:=|in\s*\()/gi)]
  assert.equal(updates.length, 2)

  const columns = updates.map(match => [...match[1].matchAll(/(?:^|,)\s*([a-z_]+)\s*=/gim)].map(item => item[1]))
  assert.deepEqual(columns[0], [
    'employee_id',
    'employee_name',
    'is_open',
    'open_invite_emp_id',
    'open_invite_status',
    'assignment_version',
  ])
  assert.deepEqual(columns[1], ['employee_id', 'employee_name', 'assignment_version'])

  const immutableColumns = ['week_number', 'year', 'day_of_week', 'shift_type', 'start_time', 'end_time', 'full_day', 'break_minutes', 'location']
  for (const column of immutableColumns) {
    assert.ok(columns.every(updateColumns => !updateColumns.includes(column)), `${column} must remain immutable`)
  }
})

test('restricts the transfer RPC to service_role', () => {
  assert.match(sql, /revoke\s+all\s+on\s+function\s+(?:public\.)?planner20_respond_to_shift_exchange/i)
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+(?:public\.)?planner20_respond_to_shift_exchange[^;]+from\s+anon\s*,\s*authenticated/i)
  assert.match(sql, /grant\s+execute\s+on\s+function\s+(?:public\.)?planner20_respond_to_shift_exchange[^;]+service_role/i)
})

test('returns the stable exchange response contract', () => {
  for (const key of ['status', 'completed', 'source_shift_id', 'target_shift_id', 'error_code']) {
    assert.match(sql, new RegExp(`'${key}'`, 'i'))
  }
})
