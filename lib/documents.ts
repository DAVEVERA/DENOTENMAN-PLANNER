import crypto from 'crypto'
import { supabase, T } from './db'
import type { EmployeeDocument, DocType } from '@/types'

const DOC_BUCKET   = 'employee-documents'
const SIGNED_URL_TTL = 3600  // 1 uur — gevoelige documenten

/** Toegestane MIME-types + magic bytes voor bestandsvalidatie */
const SAFE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Valideer bestandsinhoud via magic bytes. Geeft false terug bij onbekende/foute bestandstypen. */
export function validateFileMagic(buffer: Buffer, claimedMime: string): boolean {
  if (!SAFE_EXTENSIONS[claimedMime] || buffer.byteLength < 12) return false
  if (claimedMime === 'application/pdf') return buffer.subarray(0, 4).toString('ascii') === '%PDF'
  if (claimedMime === 'image/jpeg') return buffer.subarray(0, 3).toString('hex') === 'ffd8ff'
  if (claimedMime === 'image/png') return buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
  return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
}

/** Haal alle documenten op voor een medewerker, inclusief signed download URLs. */
export async function listDocuments(employee_id: number): Promise<EmployeeDocument[]> {
  const { data, error } = await supabase
    .from(T('employee_documents'))
    .select('*')
    .eq('employee_id', employee_id)
    .is('archived_at', null)
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  if (!data?.length) return []

  // Genereer signed URLs parallel
  const docs = await Promise.all(
    (data as EmployeeDocument[]).map(async doc => {
      const { data: signed } = await supabase.storage
        .from(DOC_BUCKET)
        .createSignedUrl(doc.storage_path, SIGNED_URL_TTL)
      return { ...doc, download_url: signed?.signedUrl ?? null }
    })
  )
  return docs
}

/** Upload een document en registreer het in de database. */
export async function uploadDocument(opts: {
  employee_id: number
  doc_type:    DocType
  filename:    string
  mime_type:   string
  buffer:      Buffer
  uploaded_by: string
  notes?:      string
}): Promise<EmployeeDocument> {
  // Valideer magic bytes
  if (!validateFileMagic(opts.buffer, opts.mime_type)) {
    throw new Error('Bestandstype niet toegestaan of bestand is beschadigd')
  }

  const ext          = SAFE_EXTENSIONS[opts.mime_type]
  const safeName     = crypto.randomUUID()
  const storagePath  = `${opts.employee_id}/${safeName}.${ext}`

  // Upload naar Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(storagePath, opts.buffer, { contentType: opts.mime_type })

  if (uploadError) throw uploadError

  // Registreer in database
  const { data, error: dbError } = await supabase
    .from(T('employee_documents'))
    .insert({
      employee_id:  opts.employee_id,
      doc_type:     opts.doc_type,
      filename:     opts.filename.split(/[\\/]/).pop()?.slice(0, 180) || `document.${ext}`,
      storage_path: storagePath,
      file_size:    opts.buffer.byteLength,
      mime_type:    opts.mime_type,
      uploaded_by:  opts.uploaded_by,
      notes:        opts.notes ?? null,
    })
    .select()
    .single()

  if (dbError) {
    // Bewaar de upload én registreer hem voor herstel; fysieke verwijdering is
    // verboden en een los storage-object mag niet alleen in logs bestaan.
    const { error: reconciliationError } = await supabase
      .from(T('document_storage_reconciliation'))
      .insert({
        storage_path: storagePath,
        employee_id: opts.employee_id,
        mime_type: opts.mime_type,
        file_size: opts.buffer.byteLength,
        reason: 'metadata_insert_failed',
      })
    if (reconciliationError) {
      console.error('[documents] reconciliation ledger insert failed:', reconciliationError.message)
    }
    console.error('[documents] metadata insert failed; storage object preserved:', storagePath)
    throw dbError
  }

  // Signed URL voor directe terugkoppeling
  const { data: signed } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  return { ...data, download_url: signed?.signedUrl ?? null }
}

/** Archiveer een document zonder database- of storagegegevens te verwijderen. */
export async function deleteDocument(id: number, employee_id: number, actor: string): Promise<void> {
  const { data, error } = await supabase.rpc(T('archive_employee_document'), {
    p_document_id: id,
    p_employee_id: employee_id,
    p_actor: actor,
  })
  if (error) throw error
  if (!data) throw new Error('Document niet gevonden of geen toegang')
}

/** Beheer de expliciete inspectievrijgave; iedere wijziging wordt append-only geaudit. */
export async function setDocumentInspectionRelease(
  id: number,
  employee_id: number,
  released: boolean,
  actor: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(T('set_document_inspection_release'), {
    p_document_id: id,
    p_employee_id: employee_id,
    p_released: released,
    p_actor: actor,
  })
  if (error) throw error
  if (!data) throw new Error('Document niet gevonden, gearchiveerd of niet geschikt voor inspectie')
}

/** Genereer een éénmalige signed download URL voor een specifiek document. */
export async function getDownloadUrl(id: number, employee_id: number): Promise<string> {
  const { data, error } = await supabase
    .from(T('employee_documents'))
    .select('storage_path')
    .eq('id', id)
    .eq('employee_id', employee_id)
    .is('archived_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Document niet gevonden of geen toegang')

  const { data: signed, error: signError } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL)

  if (signError) throw signError
  return signed!.signedUrl
}
