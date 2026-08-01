//
//  ICON REGISTRY  —  DENOTENMAN PLANNER
//  Alle icons via lucide-react (inline SVG) + custom noot-thema icons.
//  Alles erft CSS-kleur (currentColor), stroke-width 2, altijd scherp.
//
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
  Contact,
  FileText,
  Mail,
  MessageCircle,
  LayoutDashboard,
  Warehouse,
  TicketCheck,
  LogOut,
  ReceiptText,
  Plus,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

// Standaard stroke width voor alle icons
const SW = 2;

// Gedeelde basis voor custom noot-icons — zelfde stijl als lucide
function NootSvg({
  size = 20,
  className,
  strokeWidth = SW,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Dashboard overzicht */
export function DashboardIcon({ size = 20, className }: IconProps) {
  return <LayoutDashboard size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Logo / merkicoon — pinda in de dop (peanut) */
export function LogoIcon({ size = 24, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M12 2c-2.2 0-3.8 1.6-3.8 3.6 0 1 .4 1.8 1 2.5-1.3 1-2.2 2.6-2.2 4.4C7 16 9.2 18 12 18s5-2 5-5.5c0-1.8-.9-3.4-2.2-4.4.6-.7 1-1.5 1-2.5C15.8 3.6 14.2 2 12 2Z" />
      <path d="M9.2 8.1c1.8.9 3.8.9 5.6 0" />
      <path d="M8.4 12.4c2.3 1.1 4.9 1.1 7.2 0" />
      <path d="M10 22c-1-1.6-1-3.4 0-5" />
      <path d="M14 22c1-1.6 1-3.4 0-5" />
    </NootSvg>
  );
}

/** Rooster / kalender */
export function ScheduleIcon({ size = 20, className }: IconProps) {
  return <CalendarDays size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Medewerkers / mensen */
export function EmployeesIcon({ size = 20, className }: IconProps) {
  return <Users size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Verlof / vakantie */
export function LeaveIcon({ size = 20, className }: IconProps) {
  return <Umbrella size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Uren / klok */
export function HoursIcon({ size = 20, className }: IconProps) {
  return <Clock size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Export / downloaden */
export function ExportIcon({ size = 20, className }: IconProps) {
  return <FileDown size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Instellingen / schuifregelaars */
export function SettingsIcon({ size = 20, className }: IconProps) {
  return (
    <SlidersHorizontal size={size} strokeWidth={SW} className={className} aria-hidden="true" />
  );
}

/** Mijn rooster / profiel */
export function MyScheduleIcon({ size = 20, className }: IconProps) {
  return <UserRound size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Team view / oog */
export function TeamViewIcon({ size = 20, className }: IconProps) {
  return <Eye size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Chat / berichten */
export function ChatIcon({ size = 20, className }: IconProps) {
  return <MessageCircle size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Sluiten / kruisje */
export function CloseIcon({ size = 18, className }: IconProps) {
  return <X size={size} strokeWidth={2.5} className={className} aria-hidden="true" />;
}

/** Vorige */
export function PrevIcon({ size = 18, className }: IconProps) {
  return <ChevronLeft size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Volgende */
export function NextIcon({ size = 18, className }: IconProps) {
  return <ChevronRight size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Profiel / contactkaart */
export function ProfileIcon({ size = 20, className }: IconProps) {
  return <Contact size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** Document / bestand */
export function DocumentIcon({ size = 20, className }: IconProps) {
  return <FileText size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

/** E-mail / uitnodiging */
export function InviteIcon({ size = 20, className }: IconProps) {
  return <Mail size={size} strokeWidth={SW} className={className} aria-hidden="true" />;
}

// ============================================================
//  NOOT-THEMA ICONS  —  custom SVG, merkidentiteit De Notenman
// ============================================================

/** Enkele noot / pinda (algemeen noot-symbool) */
export function NutIcon({ size = 20, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M12 3c-3 0-5.5 2.4-5.5 5.4 0 2.1 1.2 3.9 3 4.8L9 20c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2l-.5-6.8c1.8-.9 3-2.7 3-4.8C17.5 5.4 15 3 12 3Z" />
      <path d="M9 8.5c2 1 4 1 6 0" />
      <path d="M9.5 11.5c1.7.8 3.3.8 5 0" />
    </NootSvg>
  );
}

/** Amandel / zaad-vorm */
export function AlmondIcon({ size = 20, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M12 2c3.5 3 5.5 6.5 5.5 10.5C17.5 18 15 22 12 22s-5.5-4-5.5-9.5C6.5 8.5 8.5 5 12 2Z" />
      <path d="M12 6c1.5 2 2.3 4.2 2.3 6.5" />
    </NootSvg>
  );
}

/** Zaadje / pit (seed) */
export function SeedIcon({ size = 20, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M16 4C10 5 6 9 6 14a4 4 0 0 0 8 0c0-3 1-6 4-8-.6-1.2-1.4-1.8-2-2Z" />
      <path d="M9 13c1.5-2 3.5-3.5 5.5-4" />
    </NootSvg>
  );
}

/** Borrelnootjes / bakje met noten (snack bowl) */
export function SnackBowlIcon({ size = 20, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M3 11h18" />
      <path d="M4 11a8 8 0 0 0 16 0" />
      <circle cx="9" cy="7.5" r="1.4" />
      <circle cx="13" cy="6" r="1.4" />
      <circle cx="15.5" cy="8.5" r="1.4" />
      <circle cx="11" cy="9" r="1.4" />
      <path d="M8 20h8" />
    </NootSvg>
  );
}

/** Blad / natuurlijk-bio accent (leaf) */
export function LeafIcon({ size = 20, className, strokeWidth = SW }: IconProps) {
  return (
    <NootSvg size={size} className={className} strokeWidth={strokeWidth}>
      <path d="M4 20c0-8 6-14 16-14 0 10-6 16-14 14" />
      <path d="M6 18c3-4 6-6 10-7" />
    </NootSvg>
  );
}

/** Locatie / magazijn (bv. Rooster Nootmagazijn in de overflow-sheet) */
export function WarehouseIcon({ size = 20, className }: IconProps) {
  return (
    <Warehouse
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Support / ticket */
export function TicketIcon({ size = 20, className }: IconProps) {
  return (
    <TicketCheck
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Uitloggen */
export function LogoutIcon({ size = 20, className }: IconProps) {
  return (
    <LogOut
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Declaraties / bon */
export function ReceiptIcon({ size = 20, className }: IconProps) {
  return (
    <ReceiptText
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}

/** Toevoegen — kleine inline actieknoppen (S-tier, 18px) */
export function PlusIcon({ size = 18, className }: IconProps) {
  return (
    <Plus
      size={size}
      strokeWidth={SW}
      className={className}
      aria-hidden="true"
    />
  )
}
