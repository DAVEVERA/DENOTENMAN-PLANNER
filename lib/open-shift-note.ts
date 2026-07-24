export const OPEN_SHIFT_NOTE_MAX_LENGTH = 1000

export function parseOpenShiftNote(value: unknown): { value: string | null; error?: string } {
  if (value == null) return { value: null }
  if (typeof value !== 'string') return { value: null, error: 'Ongeldige notitie' }

  const note = value.trim()
  if (!note) return { value: null }
  if (note.length > OPEN_SHIFT_NOTE_MAX_LENGTH) {
    return { value: null, error: `Notitie mag maximaal ${OPEN_SHIFT_NOTE_MAX_LENGTH} tekens bevatten` }
  }
  return { value: note }
}
