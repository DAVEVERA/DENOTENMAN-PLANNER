import crypto from 'crypto'
import { supabase, T } from './db'
import type { EmployeeDocument, DocType } from '@/types'

const DOC_BUCKET   = 'employee-documents'
const SIGNED_URL_TTL = 3600  // 1 uur — gevoelige documenten

/** Toegestane MIME-types + magic bytes voor bestandsvalidatie */
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '25504446',  // %PDF
  'image/jpeg':      'ffd8ff',    // JPEG SOI
  'image/png':       '89504e47',  // PNG
  'image/webp':      '52494646',  // RIFF (WebP container)
}

/** Valideer bestandsinhoud via magic bytes. Geeft false terug bij onbekende/foute bestandstypen. */
export function validateFileMagic(buffer: Buffer, claimedMime: string): boolean {
  if (!ALLOWED_TYPES[claimedMime]) return false
  const magic = buffer.subarray(0, 4).toString('hex')
  return magic.startsWith(ALLOWED_TYPES[claimedMime])
}

/** Haal alle documenten op voor een medewerker, inclusief signed download URLs. */
export async function listDocuments(employee_id: number): Promise<EmployeeDocument[]> {
  const { data, error } = await supabase
    .from(T('employee_documents'))
    .select('*')
    .eq('employee_id', employee_id)
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

  const ext          = opts.filename.split('.').pop()?.toLowerCase() ?? 'bin'
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
      filename:     opts.filename,
      storage_path: storagePath,
      file_size:    opts.buffer.byteLength,
      mime_type:    opts.mime_type,
      uploaded_by:  opts.uploaded_by,
      notes:        opts.notes ?? null,
    })
    .select()
    .single()

  if (dbError) {
    // Verwijder het bestand als DB-insert mislukt
    await supabase.storage.from(DOC_BUCKET).remove([storagePath])
    throw dbError
  }

  // Signed URL voor directe terugkoppeling
  const { data: signed } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  return { ...data, download_url: signed?.signedUrl ?? null }
}

/** Verwijder een document (storage + database). Mag alleen door eigenaar of admin. */
export async function deleteDocument(id: number, employee_id: number): Promise<void> {
  const { data, error } = await supabase
    .from(T('employee_documents'))
    .select('storage_path')
    .eq('id', id)
    .eq('employee_id', employee_id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Document niet gevonden of geen toegang')

  await supabase.storage.from(DOC_BUCKET).remove([data.storage_path])

  const { error: delError } = await supabase
    .from(T('employee_documents'))
    .delete()
    .eq('id', id)

  if (delError) throw delError
}

/** Genereer een éénmalige signed download URL voor een specifiek document. */
export async function getDownloadUrl(id: number, employee_id: number): Promise<string> {
  const { data, error } = await supabase
    .from(T('employee_documents'))
    .select('storage_path')
    .eq('id', id)
    .eq('employee_id', employee_id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Document niet gevonden of geen toegang')

  const { data: signed, error: signError } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL)

  if (signError) throw signError
  return signed!.signedUrl
}
