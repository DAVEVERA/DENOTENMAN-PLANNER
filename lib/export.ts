import type { TimeLog, HoursSummary } from '@/types'

function calcHours(clockIn: string | null, clockOut: string | null, brk: number) {
  if (!clockIn || !clockOut) return 0
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.max(0, (oh * 60 + om - (ih * 60 + im) - brk) / 60)
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function buildCSV(logs: TimeLog[]): string {
  const header = ['Datum', 'Medewerker', 'Locatie', 'Inklok', 'Uitklok', 'Pauze (min)', 'Gewerkt (u)', 'Overwerk (u)', 'Notitie', 'Verwerkt']
  const rows = logs.map(l => [
    l.log_date,
    l.employee_name,
    l.location,
    l.clock_in  ?? '',
    l.clock_out ?? '',
    l.break_minutes,
    calcHours(l.clock_in, l.clock_out, l.break_minutes).toFixed(2),
    l.overtime_hours,
    l.note ?? '',
    l.is_processed ? 'ja' : 'nee',
  ])
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function buildJSON(logs: TimeLog[]): string {
  return JSON.stringify(
    logs.map(l => ({ ...l, hours_worked: calcHours(l.clock_in, l.clock_out, l.break_minutes) })),
    null, 2,
  )
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function buildExcel(logs: TimeLog[], from: string, to: string): Promise<Buffer> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Detail sheet
  const detail = logs.map(l => ({
    Datum:          l.log_date,
    Medewerker:     l.employee_name,
    Locatie:        l.location,
    Inklok:         l.clock_in  ?? '',
    Uitklok:        l.clock_out ?? '',
    'Pauze (min)':  l.break_minutes,
    'Gewerkt (u)':  +calcHours(l.clock_in, l.clock_out, l.break_minutes).toFixed(2),
    'Overwerk (u)': l.overtime_hours,
    Notitie:        l.note ?? '',
    Verwerkt:       l.is_processed ? 'ja' : 'nee',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Uren detail')

  // Summary sheet per employee
  const summary = new Map<string, { name: string; total: number; overtime: number }>()
  for (const l of logs) {
    const h = calcHours(l.clock_in, l.clock_out, l.break_minutes)
    const existing = summary.get(l.employee_name)
    if (existing) { existing.total += h; existing.overtime += l.overtime_hours }
    else summary.set(l.employee_name, { name: l.employee_name, total: h, overtime: l.overtime_hours })
  }
  const summaryData = [...summary.values()].map(v => ({
    Medewerker:      v.name,
    'Totaal (u)':    +v.total.toFixed(2),
    'Overwerk (u)':  +v.overtime.toFixed(2),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Samenvatting')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function buildPDF(logs: TimeLog[], from: string, to: string, title = 'Urenregistratie'): Promise<Buffer> {
  const { default: jsPDF } = await import('jspdf')
  const autoTable          = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Header
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 40, 40)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Periode: ${from} – ${to}`, 40, 56)
  doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}`, 40, 68)

  autoTable(doc, {
    startY: 84,
    head: [['Datum', 'Medewerker', 'Locatie', 'Inklok', 'Uitklok', 'Pauze', 'Gewerkt', 'Overwerk', 'Notitie']],
    body: logs.map(l => [
      l.log_date,
      l.employee_name,
      l.location,
      l.clock_in?.slice(0,5)  ?? '–',
      l.clock_out?.slice(0,5) ?? '–',
      `${l.break_minutes}m`,
      `${calcHours(l.clock_in, l.clock_out, l.break_minutes).toFixed(1)}u`,
      l.overtime_hours > 0 ? `${l.overtime_hours}u` : '–',
      l.note ?? '',
    ]),
    headStyles: { fillColor: [200, 136, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 245, 240] },
    margin: { left: 40, right: 40 },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
