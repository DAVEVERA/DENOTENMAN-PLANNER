import type { ExpenseClaim } from '@/types'

const STATUS_LABEL: Record<ExpenseClaim['status'], string> = {
  pending: 'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
}

const CLAIM_LABEL: Record<ExpenseClaim['claim_type'], string> = {
  reiskosten: 'Reiskosten',
  overuren: 'Overuren',
  overig: 'Overig',
}

function eur(value: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0)
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function row(claim: ExpenseClaim) {
  return {
    ID: claim.id,
    Medewerker: claim.employee_name,
    Type: CLAIM_LABEL[claim.claim_type] ?? claim.claim_type,
    Bedrag: Number(claim.amount || 0),
    Omschrijving: claim.description,
    Declaratiedatum: claim.claim_date,
    Referentiedatum: claim.reference_date ?? '',
    Status: STATUS_LABEL[claim.status] ?? claim.status,
    'Beoordeeld door': claim.reviewed_by ?? '',
    'Beoordeeld op': claim.reviewed_at ?? '',
    'Review-opmerking': claim.review_note ?? '',
    Bijlage: claim.attachment_path ? 'ja' : 'nee',
  }
}

export function buildExpenseCSV(claims: ExpenseClaim[]): string {
  const header = [
    'ID', 'Medewerker', 'Type', 'Bedrag', 'Omschrijving', 'Declaratiedatum',
    'Referentiedatum', 'Status', 'Beoordeeld door', 'Beoordeeld op', 'Review-opmerking', 'Bijlage',
  ]
  const rows = claims.map(claim => {
    const r = row(claim)
    return [
      r.ID, r.Medewerker, r.Type, String(r.Bedrag).replace('.', ','), r.Omschrijving,
      r.Declaratiedatum, r.Referentiedatum, r.Status, r['Beoordeeld door'],
      r['Beoordeeld op'], r['Review-opmerking'], r.Bijlage,
    ].map(csvCell).join(';')
  })
  return ['\uFEFF' + header.map(csvCell).join(';'), ...rows].join('\n')
}

export function buildExpenseJSON(claims: ExpenseClaim[]): string {
  return JSON.stringify(claims.map(row), null, 2)
}

export async function buildExpenseExcel(claims: ExpenseClaim[], from: string, to: string): Promise<Buffer> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const detail = claims.map(row)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Declaraties detail')

  const summary = new Map<string, { medewerker: string; totaal: number; pending: number; approved: number; rejected: number }>()
  for (const claim of claims) {
    const current = summary.get(claim.employee_name) ?? {
      medewerker: claim.employee_name,
      totaal: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }
    current.totaal += Number(claim.amount || 0)
    current[claim.status] += Number(claim.amount || 0)
    summary.set(claim.employee_name, current)
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...summary.values()].map(s => ({
    Medewerker: s.medewerker,
    'Totaal bedrag': +s.totaal.toFixed(2),
    'In behandeling': +s.pending.toFixed(2),
    Goedgekeurd: +s.approved.toFixed(2),
    Afgewezen: +s.rejected.toFixed(2),
  }))), 'Samenvatting')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    Periode: `${from || '?'} - ${to || '?'}`,
    Aantal: claims.length,
    Totaal: +claims.reduce((sum, c) => sum + Number(c.amount || 0), 0).toFixed(2),
  }]), 'Info')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function buildExpensePDF(claims: ExpenseClaim[], from: string, to: string): Promise<Buffer> {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const total = claims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Declaraties De Notenman', 40, 40)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Periode: ${from || '?'} - ${to || '?'}`, 40, 56)
  doc.text(`Aantal: ${claims.length} | Totaal: ${eur(total)}`, 40, 68)

  autoTable(doc, {
    startY: 84,
    head: [['Datum', 'Medewerker', 'Type', 'Bedrag', 'Status', 'Omschrijving', 'Review']],
    body: claims.map(claim => [
      claim.claim_date,
      claim.employee_name,
      CLAIM_LABEL[claim.claim_type] ?? claim.claim_type,
      eur(claim.amount),
      STATUS_LABEL[claim.status] ?? claim.status,
      claim.description,
      claim.review_note ?? '',
    ]),
    headStyles: { fillColor: [200, 136, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 245, 240] },
    margin: { left: 40, right: 40 },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
