import { supabase, T } from './db'
import type { EmployeeProfile } from '@/types'

const AVATAR_BUCKET = 'employee-avatars'
const SIGNED_URL_TTL = 86400  // 24 uur voor avatar

/** Haal profiel op. Genereer een signed URL voor de avatar als die aanwezig is. */
export async function getProfile(employee_id: number): Promise<EmployeeProfile | null> {
  const { data, error } = await supabase
    .from(T('employee_profiles'))
    .select('*')
    .eq('employee_id', employee_id)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    // Nog geen profiel aangemaakt → retourneer lege schil
    return {
      employee_id,
      voornaam: null, achternaam: null,
      adres: null, postcode: null, stad: null,
      ice_contact: null, geboortedatum: null,
      geboorteplaats: null, land_van_herkomst: 'Nederland',
      bijzonderheden: null, voorkeur_planning: null,
      avatar_path: null, avatar_url: null,
      updated_at: new Date().toISOString(),
    }
  }

  let avatar_url: string | null = null
  if (data.avatar_path) {
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(data.avatar_path, SIGNED_URL_TTL)
    avatar_url = signed?.signedUrl ?? null
  }

  return { ...data, avatar_url }
}

/** Sla profiel op (upsert). Retourneert het bijgewerkte profiel inclusief signed avatar URL. */
export async function upsertProfile(
  employee_id: number,
  fields: Omit<Partial<EmployeeProfile>, 'employee_id' | 'avatar_url'>,
): Promise<EmployeeProfile> {
  const { data, error } = await supabase
    .from(T('employee_profiles'))
    .upsert({
      employee_id,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id' })
    .select()
    .single()

  if (error) throw error

  let avatar_url: string | null = null
  if (data.avatar_path) {
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(data.avatar_path, SIGNED_URL_TTL)
    avatar_url = signed?.signedUrl ?? null
  }

  return { ...data, avatar_url }
}

/** Upload profielfoto. Verwijdert oude foto als die er al was. */
export async function uploadAvatar(
  employee_id: number,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext  = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const path = `${employee_id}/avatar.${ext}`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true })

  if (error) throw error

  // Sla het pad op in het profiel
  await supabase
    .from(T('employee_profiles'))
    .upsert({ employee_id, avatar_path: path, updated_at: new Date().toISOString() }, { onConflict: 'employee_id' })

  return path
}
