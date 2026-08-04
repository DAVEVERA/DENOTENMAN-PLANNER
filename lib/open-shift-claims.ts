import { supabase, T } from './db'
import type { OpenShiftClaim, Shift } from '@/types'

function isMissingTableError(err: any): boolean {
  return err?.code === '42P01' || String(err?.message ?? '').includes('open_shift_claims')
}

export async function getClaimsForShifts(shiftIds: number[]): Promise<Record<number, OpenShiftClaim[]>> {
  if (shiftIds.length === 0) return {}

  const { data, error } = await supabase
    .from(T('open_shift_claims'))
    .select('*')
    .in('shift_id', shiftIds)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTableError(error)) return {}
    throw error
  }

  const byShift: Record<number, OpenShiftClaim[]> = {}
  for (const claim of (data ?? []) as OpenShiftClaim[]) {
    if (!byShift[claim.shift_id]) byShift[claim.shift_id] = []
    byShift[claim.shift_id].push(claim)
  }
  return byShift
}

export async function attachOpenShiftClaims<TShift extends Shift>(shifts: TShift[]): Promise<TShift[]> {
  const claimsByShift = await getClaimsForShifts(shifts.map(s => s.id))
  return shifts.map(s => ({ ...s, claims: claimsByShift[s.id] ?? [] }))
}

export async function createOpenShiftClaim(shift: Shift, employeeId: number, employeeName: string): Promise<OpenShiftClaim | { error: string }> {
  const { data: existing, error: existingError } = await supabase
    .from(T('open_shift_claims'))
    .select('*')
    .eq('shift_id', shift.id)
    .eq('employee_id', employeeId)
    .neq('status', 'withdrawn')
    .maybeSingle()

  if (existingError) {
    if (isMissingTableError(existingError)) {
      return { error: 'De tabel voor meerdere inschrijvingen ontbreekt. Voer de nieuwe Supabase-migratie uit.' }
    }
    return { error: existingError.message }
  }
  if (existing) return { error: 'Je bent al ingeschreven voor deze open dienst' }

  const { data, error } = await supabase
    .from(T('open_shift_claims'))
    .insert({
      shift_id: shift.id,
      employee_id: employeeId,
      employee_name: employeeName,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      return { error: 'De tabel voor meerdere inschrijvingen ontbreekt. Voer de nieuwe Supabase-migratie uit.' }
    }
    return { error: error.message }
  }

  await supabase
    .from(T('shifts'))
    .update({ open_invite_emp_id: employeeId, open_invite_status: 'pending' })
    .eq('id', shift.id)
    .is('archived_at', null)

  return data as OpenShiftClaim
}

export async function withdrawOpenShiftClaim(shiftId: number, employeeId: number): Promise<boolean> {
  const { error } = await supabase
    .from(T('open_shift_claims'))
    .update({ status: 'withdrawn' })
    .eq('shift_id', shiftId)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')

  if (error) return false
  await refreshShiftClaimSummary(shiftId)
  return true
}

export async function approveOpenShiftClaim(shift: Shift, employeeId: number, reviewedBy: string): Promise<{ ok: boolean; error?: string; claimer?: OpenShiftClaim }> {
  const { data: claim, error: claimError } = await supabase
    .from(T('open_shift_claims'))
    .select('*')
    .eq('shift_id', shift.id)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
    .maybeSingle()

  if (claimError) return { ok: false, error: claimError.message }
  if (!claim) return { ok: false, error: 'Geen open inschrijving gevonden voor deze medewerker' }

  const { data: updatedShift, error: shiftError } = await supabase.from(T('shifts')).update({
    employee_id: claim.employee_id,
    employee_name: claim.employee_name,
    is_open: 0,
    open_invite_status: 'accepted',
    shift_category: 'regular',
    open_invite_emp_id: null,
  }).eq('id', shift.id).is('archived_at', null).select('id').maybeSingle()

  if (shiftError) return { ok: false, error: shiftError.message }
  if (!updatedShift) return { ok: false, error: 'Deze dienst is niet meer beschikbaar' }

  const now = new Date().toISOString()
  const { error: acceptError } = await supabase
    .from(T('open_shift_claims'))
    .update({ status: 'accepted', reviewed_by: reviewedBy, reviewed_at: now })
    .eq('id', claim.id)
  if (acceptError) return { ok: false, error: acceptError.message }

  await supabase
    .from(T('open_shift_claims'))
    .update({ status: 'declined', reviewed_by: reviewedBy, reviewed_at: now })
    .eq('shift_id', shift.id)
    .eq('status', 'pending')
    .neq('employee_id', employeeId)

  return { ok: true, claimer: claim as OpenShiftClaim }
}

export async function declineOpenShiftClaim(shiftId: number, employeeId: number, reviewedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from(T('open_shift_claims'))
    .update({ status: 'declined', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('shift_id', shiftId)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')

  if (error) return false
  await refreshShiftClaimSummary(shiftId)
  return true
}

export async function refreshShiftClaimSummary(shiftId: number): Promise<void> {
  const { data } = await supabase
    .from(T('open_shift_claims'))
    .select('employee_id')
    .eq('shift_id', shiftId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  const next = data?.[0]?.employee_id ?? null
  await supabase
    .from(T('shifts'))
    .update({ open_invite_emp_id: next, open_invite_status: next ? 'pending' : null })
    .eq('id', shiftId)
    .is('archived_at', null)
}
