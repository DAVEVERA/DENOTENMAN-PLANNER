import { supabase, T } from './db'
import type { ExpenseClaim } from '@/types'

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getExpenseClaims(filters?: {
  employeeId?: number
  status?: ExpenseClaim['status']
}): Promise<ExpenseClaim[]> {
  let q = supabase
    .from(T('expense_claims'))
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.employeeId) q = q.eq('employee_id', filters.employeeId)
  if (filters?.status)     q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getExpenseClaim(id: number): Promise<ExpenseClaim | null> {
  const { data } = await supabase
    .from(T('expense_claims'))
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}

export async function createExpenseClaim(
  data: Omit<ExpenseClaim, 'id' | 'status' | 'reviewed_by' | 'reviewed_at' | 'review_note' | 'created_at'>,
): Promise<ExpenseClaim> {
  const { data: inserted, error } = await supabase
    .from(T('expense_claims'))
    .insert({ ...data, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return inserted
}

export async function updateExpenseClaimStatus(
  id: number,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  reviewNote?: string,
): Promise<ExpenseClaim> {
  const { data, error } = await supabase
    .from(T('expense_claims'))
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpenseClaim(id: number): Promise<void> {
  const { error } = await supabase.from(T('expense_claims')).delete().eq('id', id)
  if (error) throw error
}

// ─── Summary (voor export / boekhouding) ─────────────────────────────────────

export interface ExpenseSummary {
  employee_id:   number
  employee_name: string
  total_pending:  number
  total_approved: number
  count_pending:  number
  count_approved: number
}

export async function getExpenseSummaryByEmployee(): Promise<ExpenseSummary[]> {
  const { data, error } = await supabase
    .from(T('expense_claims'))
    .select('employee_id, employee_name, status, amount')
    .in('status', ['pending', 'approved'])
  if (error) throw error

  const map = new Map<number, ExpenseSummary>()
  for (const row of data ?? []) {
    if (!map.has(row.employee_id)) {
      map.set(row.employee_id, {
        employee_id:    row.employee_id,
        employee_name:  row.employee_name,
        total_pending:  0,
        total_approved: 0,
        count_pending:  0,
        count_approved: 0,
      })
    }
    const s = map.get(row.employee_id)!
    if (row.status === 'pending')  { s.total_pending  += Number(row.amount); s.count_pending++  }
    if (row.status === 'approved') { s.total_approved += Number(row.amount); s.count_approved++ }
  }
  return [...map.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name))
}
