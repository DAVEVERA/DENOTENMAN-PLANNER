// ─────────────────────────────────────────────────────────────────────────────
//  ICON REGISTRY  —  DENOTENMAN PLANNER
//  Alle icons via lucide-react (inline SVG, altijd scherp, erft CSS-kleur).
// ─────────────────────────────────────────────────────────────────────────────
import {
  CalendarDays,
  Users,
  Umbrella,
  Clock,
  FileDown,
  SlidersHorizontal,
  Eye,
  UserRound,
  ChevronLeft,
  ChevronRight,
  X,
  Bean,
  Contact,
  FileText,
  Mail,
} from 'lucide-react'

export interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

// Standaard stroke width voor alle icons
const SW = 2

/** Logo / merkicoon — pinda/bean silhouet */
export function LogoIcon({ size = 24, className }: IconProps) {
  return (
    <Bean
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Rooster / kalender */
export function ScheduleIcon({ size = 20, className }: IconProps) {
  return (
    <CalendarDays
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Medewerkers / mensen */
export function EmployeesIcon({ size = 20, className }: IconProps) {
  return (
    <Users
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Verlof / vakantie */
export function LeaveIcon({ size = 20, className }: IconProps) {
  return (
    <Umbrella
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Uren / klok */
export function HoursIcon({ size = 20, className }: IconProps) {
  return (
    <Clock
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Export / downloaden */
export function ExportIcon({ size = 20, className }: IconProps) {
  return (
    <FileDown
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Instellingen / schuifregelaars */
export function SettingsIcon({ size = 20, className }: IconProps) {
  return (
    <SlidersHorizontal
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Mijn rooster / profiel */
export function MyScheduleIcon({ size = 20, className }: IconProps) {
  return (
    <UserRound
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Team view / oog */
export function TeamViewIcon({ size = 20, className }: IconProps) {
  return (
    <Eye
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Sluiten / kruisje */
export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <X
      size={size}
      strokeWidth={2.5}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Vorige */
export function PrevIcon({ size = 18, className }: IconProps) {
  return (
    <ChevronLeft
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Volgende */
export function NextIcon({ size = 18, className }: IconProps) {
  return (
    <ChevronRight
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Profiel / contactkaart */
export function ProfileIcon({ size = 20, className }: IconProps) {
  return (
    <Contact
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Document / bestand */
export function DocumentIcon({ size = 20, className }: IconProps) {
  return (
    <FileText
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** E-mail / uitnodiging */
export function InviteIcon({ size = 20, className }: IconProps) {
  return (
    <Mail
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}
