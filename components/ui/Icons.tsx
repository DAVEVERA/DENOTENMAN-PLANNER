import React from 'react'

// ════════════════════════════════════════════════════════════════════════════
//  ICON REGISTRY  —  DENOTENMAN PLANNER
// ════════════════════════════════════════════════════════════════════════════
//
//  HOE VERVANG IK EEN ICON?
//  ─────────────────────────────────────────────────────────────────────────
//  1. Ontwerp jouw icon als SVG-bestand (aanbevolen: gevulde vormen, donkere
//     kleur of currentColor op transparante achtergrond, 24×24 viewBox).
//
//  2. Sla het op in:  public/icons/<bestandsnaam>.svg
//     (De juiste bestandsnaam staat hieronder bij elk icon vermeld.)
//
//  3. Klaar! Het icon wordt automatisch bijgewerkt op ALLE pagina's.
//
//  KLEURGEDRAG:
//  ─────────────────────────────────────────────────────────────────────────
//  Icons erven automatisch de CSS tekstkleur van hun omgeving (currentColor).
//  Actieve navigatie-items worden oranje (--brand), inactieve items grijs —
//  dit werkt automatisch zonder extra code.
//  Voor het beste resultaat: gebruik SVG-bestanden met gevulde vormen (fill).
//
// ════════════════════════════════════════════════════════════════════════════
//
//  ICON OVERZICHT — BESTANDSNAAM → PAGINA('S)
//  ─────────────────────────────────────────────────────────────────────────
//
//  logo.svg           → Login-pagina (groot merk-logo)
//                       Admin sidebar (bovenaan links)
//                       Team header (bovenaan links)
//
//  schedule.svg       → Admin navigatie: "Rooster"
//                       Team navigatie: "Rooster"
//                       Mobiele bottom navigatie: Rooster-tab
//
//  employees.svg      → Admin navigatie: "Medewerkers"
//
//  leave.svg          → Admin navigatie: "Verlof"
//                       Team navigatie: "Verlof"
//                       Mobiele bottom navigatie: Verlof-tab
//
//  hours.svg          → Admin navigatie: "Uren"
//
//  export.svg         → Admin navigatie: "Export"
//
//  settings.svg       → Admin navigatie: "Instellingen"
//                       Team navigatie: "Beheer" (admin-link)
//                       Mobiele bottom navigatie: Beheer-tab (team)
//
//  my-schedule.svg    → Team navigatie: "Mijn rooster"
//                       Mobiele bottom navigatie: Mijn rooster-tab
//
//  team-view.svg      → Admin sidebar footer: "Team view" link
//
//  close.svg          → ShiftModal: sluit-knop (×)
//                       Admin uren-tabel: annuleer bewerkknop (×)
//
//  prev.svg           → Admin rooster: "Vorige week" knop (‹)
//                       Mijn rooster (me/index): "Vorige periode" knop
//                       Team rooster: "Vorige week" knop
//
//  next.svg           → Admin rooster: "Volgende week" knop (›)
//                       Mijn rooster (me/index): "Volgende periode" knop
//                       Team rooster: "Volgende week" knop
//
// ════════════════════════════════════════════════════════════════════════════

interface IconProps {
  size?: number
  className?: string
}

/**
 * Interne helper — rendert een SVG-bestand uit public/icons/ als CSS-masker.
 * Hierdoor erft het icon automatisch de CSS-tekstkleur (currentColor).
 */
function AppIcon({ file, size = 20, className = '' }: IconProps & { file: string }) {
  return (
    <span
      className={className || undefined}
      style={{
        display:    'inline-block',
        width:      size,
        height:     size,
        minWidth:   size,
        flexShrink: 0,
        verticalAlign: 'middle',
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url('/icons/${file}')`,
        maskImage:       `url('/icons/${file}')`,
        WebkitMaskRepeat:   'no-repeat',
        maskRepeat:         'no-repeat',
        WebkitMaskSize:     'contain',
        maskSize:           'contain',
        WebkitMaskPosition: 'center',
        maskPosition:       'center',
      } as React.CSSProperties}
      aria-hidden="true"
    />
  )
}

// ── Exporteerde icon-componenten ─────────────────────────────────────────────
// Gebruik deze in de code. Voorbeeld: <ScheduleIcon size={20} />

/** Logo / merkicoon  →  public/icons/logo.svg */
export const LogoIcon = (p: IconProps) =>
  <AppIcon file="logo.svg" size={p.size ?? 24} className={p.className} />

/** Rooster / kalender  →  public/icons/schedule.svg */
export const ScheduleIcon = (p: IconProps) =>
  <AppIcon file="schedule.svg" size={p.size ?? 20} className={p.className} />

/** Medewerkers / personen  →  public/icons/employees.svg */
export const EmployeesIcon = (p: IconProps) =>
  <AppIcon file="employees.svg" size={p.size ?? 20} className={p.className} />

/** Verlof / vakantie  →  public/icons/leave.svg */
export const LeaveIcon = (p: IconProps) =>
  <AppIcon file="leave.svg" size={p.size ?? 20} className={p.className} />

/** Uren / klok  →  public/icons/hours.svg */
export const HoursIcon = (p: IconProps) =>
  <AppIcon file="hours.svg" size={p.size ?? 20} className={p.className} />

/** Export / uploaden  →  public/icons/export.svg */
export const ExportIcon = (p: IconProps) =>
  <AppIcon file="export.svg" size={p.size ?? 20} className={p.className} />

/** Instellingen / tandwiel  →  public/icons/settings.svg */
export const SettingsIcon = (p: IconProps) =>
  <AppIcon file="settings.svg" size={p.size ?? 20} className={p.className} />

/** Mijn rooster / persoon  →  public/icons/my-schedule.svg */
export const MyScheduleIcon = (p: IconProps) =>
  <AppIcon file="my-schedule.svg" size={p.size ?? 20} className={p.className} />

/** Team view / oog  →  public/icons/team-view.svg */
export const TeamViewIcon = (p: IconProps) =>
  <AppIcon file="team-view.svg" size={p.size ?? 20} className={p.className} />

/** Sluiten / kruisje  →  public/icons/close.svg */
export const CloseIcon = (p: IconProps) =>
  <AppIcon file="close.svg" size={p.size ?? 18} className={p.className} />

/** Vorige / links-pijl  →  public/icons/prev.svg */
export const PrevIcon = (p: IconProps) =>
  <AppIcon file="prev.svg" size={p.size ?? 18} className={p.className} />

/** Volgende / rechts-pijl  →  public/icons/next.svg */
export const NextIcon = (p: IconProps) =>
  <AppIcon file="next.svg" size={p.size ?? 18} className={p.className} />
