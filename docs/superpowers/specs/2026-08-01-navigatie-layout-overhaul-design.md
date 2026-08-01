# Navigatie & layout-systeem overhaul — design

## Doel

Eén samenhangend navigatie- en layoutsysteem voor zowel het beheerportaal
(`AdminLayout`) als het medewerkersportaal (`TeamLayout`), dat op desktop
(≥768px) nooit horizontaal scrollen vereist om bij een hoofdfunctie te komen,
en op mobiel voelt als een echte app-shell in plaats van een responsive
website. Icoongroottes worden vastgezet op een schaal in plaats van ad hoc
gekozen per aanroepplek. Roostergrids worden geaudit op responsive breuken.

Dit document is een designspec, geen implementatie. Bestemd voor overdracht
aan een `mobile-first-developer`-uitvoering.

## Aanleiding

`components/layout/TeamLayout.tsx` regel 303–315 (`.team-nav`) rendert alle
tien navigatielinks van het medewerkersportaal als één rij in een
`overflow-x:auto`-container met verborgen scrollbar
(`scrollbar-width:none`, regel 310–315). Op elke normale desktopbreedte moet
de gebruiker horizontaal scrollen om bijvoorbeeld "Documenten" of "Support"
te bereiken, en er is geen enkele visuele aanwijzing (geen schaduw/fade aan
de rand) dát er meer content buiten beeld staat — dit is precies het
onderscheid dat de opdracht maakt tussen een *bewust* ontworpen
horizontaal-scroll-patroon en een *onbedoelde* ongestylede overflow. Dit is
het exact door de klant gemelde defect.

`components/layout/AdminLayout.tsx` heeft daarentegen al een correcte,
vaste sidebar (248px, `.sb-*`-klassen) die als visueel referentiepatroon
dient. Opvallend: `styles/globals.css` regel 284–376 bevat al een
"Sidebar — volledig overschrijf"-blok mét `!important`-regels voor
`.sb-link`/`.sb-icon`/`.sb-dot`/`.sb-user-name` (het admin-patroon) én een
apart "Team Header — volledig overschrijf"-blok voor `.tn-link`/
`.team-header` (het huidige, kapotte team-patroon). Er bestaan dus al twee
parallelle stylingsystemen voor wat conceptueel dezelfde component zou
moeten zijn. Dat is zelf een signaal: de twee navigatiesystemen zijn nooit
geconvergeerd. Dit plan converteert ze naar één systeem en maakt het
`.team-header`-override-blok in `globals.css` (regel 378–434) overbodig.

Iconen: `components/ui/Icons.tsx` is een nette registry (lucide-react,
`strokeWidth=2`, defaults meestal `size=20`), maar drie van de vier
navigatie-aangrenzende bestanden omzeilen die registry volledig en
importeren ruwe lucide-iconen met eigen maten:
`components/layout/MobileMoreNav.tsx` (21px, rechtstreeks `lucide-react`),
`components/layout/AdminMobileMoreNav.tsx` (20/21/22px gemengd), en de
`MoreHorizontal`/`MessageCircle`-iconen in beide `*Layout.tsx`-bestanden
(20/21/22px). Er is geen vastgelegde schaal — vandaar dat iconen "niet op
een grid lijken te staan".

## Scope

**Wel:** navigatie-shell (sidebar + mobile bottom-nav + overflow-sheet),
icoonschaal en -mapping, layoutaudit van de drie genoemde pagina's, met
concrete fixrichtingen.

**Niet:** geen nieuwe kleuren, geen nieuw tokensysteem, geen wijziging van
de merkkleur (`--brand:#C8882A`) of de near-black achtergronden
(`#100C0A`/`#1A1412`), geen nieuwe componentbibliotheek. Alles bouwt voort
op de bestaande tokens in `styles/globals.css` (`--s1`…`--s12`, `--r1`…
`--r4`, `--sidebar-w`, kleurvariabelen). Geen wijziging van de
databaselaag, routes, of business-logica (`can()`-capabilities,
locatie-conditionals) — die logica blijft precies zoals hij is, alleen de
presentatielaag verandert.

---

## 1. Unified navigation system (desktop ≥768px)

### Beslissing: één presentationele `<Sidebar>`-primitive, twee configs

Geen volledig gedeelde "nav-aware" component die zelf weet wie admin is en
wie medewerker. In plaats daarvan: `components/layout/Sidebar.tsx`, een
**dom presentatie-component** dat alleen weet hoe het een lijst van secties
en items tekent — het kent geen `can()`-capabilities en geen
`user.location`-logica. `AdminLayout` en `TeamLayout` blijven ieder hun
eigen navigatieconfiguratie en zichtbaarheidsregels beheren (admin
filtert op capability via `can(user, cap)`, team filtert op
`user.location`/`isAdmin`) en geven het resultaat als props door aan
`<Sidebar>`.

**Waarom niet fully-merged:** de twee rollen berekenen "welke link toon ik"
en "is deze link actief" op fundamenteel verschillende basis (admin:
capability-array; team: locatie-conditionals + exact-pathmatch op
`/team/[location]`). Eén generieke nav-item-generator die beide gevallen
dekt zou de capability-logica van admin en de locatie-logica van team aan
elkaar koppelen zonder functioneel voordeel. Een domme presentatie-primitive
met een strak getypeerd props-contract geeft 100% visuele consistentie
(één CSS-oppervlak, één plek om de actieve-status-styling te fixen) zónder
die koppeling.

### Component-API (voorstel)

```tsx
interface SidebarItem {
  href: string
  icon: React.ReactNode        // vooraf gesized element, zie icoonschaal §3
  label: string
  isActive: boolean            // door de caller berekend (routing verschilt per rol)
  badge?: React.ReactNode      // toekomstige hook, bv. ongelezen-chat-stip — niet nu invullen
}
interface SidebarSection {
  label?: string                // sectiekop, bv. "ROOSTER" — weglaten = ongelabelde top-sectie
  items: SidebarItem[]
}
interface SidebarProps {
  logoSrc: string
  sections: SidebarSection[]        // hoofdnavigatie (scrollbare .sb-body)
  footerSections?: SidebarSection[] // onderaan vastgepind, bv. "WEERGAVE" / "Beheer"-crosslink
  user: SessionUser
  onLogout: () => void
}
```

Herbruikt letterlijk de bestaande `.sb-*`-klassen en CSS uit
`AdminLayout.tsx` (regels 246–344) en het `globals.css`-overrideblok
(regels 284–376) — geen nieuwe visuele taal, alleen verplaatst naar een
gedeeld bestand. `--sidebar-w:248px` (al gedefinieerd in `globals.css`
regel 56) wordt de enige bron van waarheid voor de breedte; `AdminLayout`
regel 189 (`width:248px`) en regel 349 (`margin-left:248px`) hardcoden
momenteel de letterlijke waarde in plaats van de token te gebruiken — dat
wordt gelijk gecorrigeerd (`var(--sidebar-w)`), zodat beide layouts blijvend
gesynchroniseerd zijn.

### Admin-navigatie (ongewijzigd qua items/gedrag)

Blijft één vlakke lijst zoals nu (`NAV`-array, `AdminLayout.tsx` regel
17–30) — 8–11 items past comfortabel zonder groepering. Enige wijziging:
het bestaande "Menu"/"Weergave"-tweedeling (regel 74–116) wordt letterlijk
`sections`/`footerSections` van de nieuwe primitive.

### Employee-navigatie (nieuw: gegroepeerd, geen horizontale rij meer)

Tien links worden drie gelabelde secties + één footer-crosslink, in plaats
van één platte rij. Groepering naar taakcontext, consistent met hoe de
gebruiker erover nadenkt ("waar werk ik" vs. "mijn administratie" vs.
"contact"):

**Sectie "ROOSTER"** (primair, bovenaan, geen label nodig te onderdrukken —
dit ís de hoofdtaak van het portaal):
- Rooster Markt / Rooster Noot — conditioneel zoals nu (`user.location`),
  bij één locatie wordt dit één link "Rooster" (bestaande logica,
  `TeamLayout.tsx` regel 73–92, ongewijzigd overnemen)
- Mijn rooster
- Open diensten

**Sectie "MIJN ZAKEN"**:
- Verlof
- Mijn uren
- Declaraties
- Documenten
- Mijn profiel

**Sectie "CONTACT"**:
- Teamchat
- Support

**Footer (vastgepind onderaan, spiegelt admin's "Weergave"-blok):**
- "Beheer" — alleen `isAdmin`, cross-link naar `/admin`. Dit is exact de
  huidige `team-admin-link` (`TeamLayout.tsx` regel 169–174), alleen
  verplaatst van de topbar naar de sidebar-footer, symmetrisch met hoe
  Admin's sidebar-footer juist omgekeerd linkt naar de teamweergave
  (`AdminLayout.tsx` regel 98–116, "Weergave"-sectie met Team
  Markt/Nootmagazijn/Individueel). Beide rollen krijgen zo dezelfde
  "wissel van weergave"-plek onderaan de sidebar.

Iconen per item: hergebruik de bestaande `Icons.tsx`-registry-componenten
1-op-1 zoals nu al toegewezen in `TeamLayout.tsx` (`ScheduleIcon`,
`MyScheduleIcon`, `LeaveIcon`, `HoursIcon`, `DocumentIcon` ×2 voor
Documenten/Declaraties — zie §4-F voor een aanbevolen apart icoon voor
Declaraties, want twee verschillende navlinks delen nu hetzelfde
`DocumentIcon`), `ProfileIcon`, `MessageCircle`, en vervang de emoji 🎫 voor
Support door `TicketCheck` (zie §3).

### Locatie-accent (markt=groen / noot=bruin) verplaatst uit de nav-shell

`TeamLayout.tsx` regel 276/281–283 toont vandaag een 3px gekleurde
`box-shadow` onder de header als locatie-indicator. Zodra de nav naar een
gedeelde sidebar verhuist die *beide* locaties toont (net als Admin), hoort
een locatie-specifieke kleur niet meer thuis in de shell — het is
paginacontext, geen navigatiecontext. Verplaats deze indicator naar de
content-kolom: een 3px accentbalk bovenaan `.team-main`/`.admin-content`
wanneer de pagina een `location`-prop meekrijgt (`data-loc="markt"` /
`data-loc="nootmagazijn"`, kleur uit bestaande `--markt`/`--noot`-tokens).
Dit voorkomt dat de sidebar zelf een merk-kleur-signaal geeft dat niet
klopt met wat er inhoudelijk getoond wordt.

---

## 2. Mobile app-shell pattern (<768px)

Uitgangspunt: het bestaande bottom-nav (4 items + "Meer") + bottom-sheet
patroon in beide layouts is structureel goed — behouden, niet vervangen.
Verfijningen:

### a) Eén gedeelde `<MoreSheet>`-primitive

`components/layout/MobileMoreNav.tsx` en
`components/layout/AdminMobileMoreNav.tsx` zijn twee bijna-identieke
implementaties van hetzelfde ding (2-koloms grid van tegels, handle-bar,
header met titel + sluitknop, `useDialogFocus`-hook, backdrop). Zelfde
duplicatie-probleem als de sidebar, zelfde oplossing: één
`components/layout/MoreSheet.tsx` presentatie-component met een
`items: {href, icon, label, helper?}[]`-prop en een `footer?`-slot (voor de
Uitloggen-knop / Beheer-link). `MobileMoreNav` en `AdminMobileMoreNav`
worden dunne wrappers die alleen hun eigen itemlijst samenstellen — of
vervallen helemaal ten gunste van rechtstreeks gebruik van `<MoreSheet>`
vanuit `TeamLayout`/`AdminLayout`.

### b) Motion/transitie-polish

Vandaag verschijnt de sheet instant (conditionele render, geen CSS-
transitie) — voelt niet "app-like". Ter vergelijking: `pages/admin/
open-shifts.tsx` regel 724–726 heeft al wél een `@keyframes modal-in`
(opacity + translateY + scale, 0.2s ease) voor zijn eigen modals. Pas
hetzelfde soort polish toe op `<MoreSheet>`:
- Backdrop: fade-in opacity 0→1, ~160ms.
- Sheet: translateY(100%)→0 + opacity 0→1, ~220ms ease-out (iets trager dan
  de backdrop zodat het "van onderop komt" voelt, niet gelijktijdig pop-t).
- Sluiten: omgekeerde transitie, niet instant unmounten (huidige
  `if (!open) return null` unmount direct — vervang door een
  `closing`-state die de animatie laat afspelen vóór unmount, of gebruik
  `<dialog>`-element / CSS `@starting-style` als browserbudget dat
  toelaat — anders eenvoudige setTimeout-gated unmount).
- Respecteer `prefers-reduced-motion: reduce` (transitie-duur naar 0/1ms).

Ook de actieve-status in de bottom-nav zelf krijgt motion: een lichte
schaal-transitie op het icoon (`transform: scale(1.08)` bij `.active`,
`transition: transform .16s ease`) zodat een tab-wissel voelbaar is, niet
alleen een kleurverandering.

### c) Visuele hiërarchie van de actieve status

Nu: actief item krijgt alleen `color:var(--brand)` + een 3px balkje
bovenaan (`.tbn-bar`/`.bn-bar`). Voeg een zachte achtergrond-chip toe achter
het actieve icoon — dezelfde `rgba(200,136,42,.18)`-pil die de sidebar al
gebruikt voor `.sb-link.active` (`AdminLayout.tsx` regel 270–274). Dit
maakt de actieve-status-taal identiek tussen sidebar (desktop) en
bottom-nav (mobiel): zelfde kleurwaarde, zelfde vorm-taal, alleen andere
afmeting. Concreet: `.tbn-icon`/`.bn-icon` krijgt bij `.active` een
`background: rgba(200,136,42,.18); border-radius:var(--r2)` binnen een
vaste 32×32px box.

### d) Touch targets — al voldoende, geen wijziging nodig

`.tbn-item`/`.bn-item` hebben nu al `min-height:58px` met `flex:1` breedte
— ruim boven de 44×44px WCAG/Apple-richtlijn. De "Meer"-trigger-knop en
sheet-tegels (`.more-link`, min-height 68px in `MobileMoreNav.tsx` regel
69) zijn eveneens ruim voldoende. Geen aanpassing nodig hier — alleen
documenteren als bevestigd basispatroon zodat de developer het niet per
ongeluk verkleint bij het samenvoegen tot `<MoreSheet>`.

### e) Safe-area — aanwezig maar met een maat-mismatch

Beide layouts passen `padding-bottom: env(safe-area-inset-bottom, 0px)`
correct toe op de bottom-nav zelf (`TeamLayout.tsx` regel 455,
`AdminLayout.tsx` regel 418) én reserveren ruimte in de content
(`calc(62px + env(safe-area-inset-bottom, 0px))`, `TeamLayout.tsx` regel
440/443/505/508, `AdminLayout.tsx` regel 403). Bug: de content-padding
gebruikt het magic number **62px**, terwijl de navbalk zelf
**`min-height:58px` + `padding:8px 2px`** is (effectief ~58-66px afhankelijk
van labeltekst-wrap) — deze twee getallen zijn nooit aan elkaar gekoppeld en
kunnen uit sync raken bij toekomstige aanpassingen. Fix: introduceer
`--bnav-h: 60px` als token in `globals.css` naast de bestaande
`--sidebar-w`, gebruik die zowel voor de navbalk-hoogte als de
content-`padding-bottom`-berekening, in beide layouts. Voorkomt een
terugkerende bron van "content net achter de navbalk verstopt"-bugs.

---

## 3. Icon-size scale

Drie vaste maten, gekoppeld aan gebruikscontext (niet aan welk icoon het
toevallig is):

| Tier | Maat | Context |
|---|---|---|
| **S** | 18px | Chrome/utility-iconen in compacte controls: modal-sluiten (×), paginatie-chevrons (vorige/volgende), kleine inline actieknoppen in grid-cellen |
| **M** | 20px | Primaire navigatie-iconen in lijst/inline-context bij leestekst: sidebar-navlinks (desktop, admin én employee), inline content-iconen naast body-tekst |
| **L** | 24px | Touch-first navigatie: mobiele bottom-nav-items (beide layouts), de "Meer"-trigger, tegel-iconen in de overflow-sheet — groter voor duim-bereik en leesbaarheid op arm-afstand |

`components/ui/Icons.tsx` hoeft zelf niet te wijzigen — de meeste
componenten defaulten al naar `size=20` (M) en `CloseIcon`/`PrevIcon`/
`NextIcon` defaulten al naar `size=18` (S). Dat wordt hierbij het
afgedwongen contract: **S en M-defaults blijven staan, L moet altijd
expliciet als prop worden meegegeven** (geen `size=24`-default toevoegen
aan de registry, want dezelfde iconen worden ook op M-plekken hergebruikt).

### Mapping — huidige ad hoc waarde → nieuwe tier, per aanroepplek

| Bestand + regel | Huidig | Context | → Nieuw |
|---|---|---|---|
| `TeamLayout.tsx` 79,89,98,106,114,122,130,138,146,154,162,171 | 20 | Desktop `tn-link`-iconen | **M (20)** — ongewijzigd, migreert 1-op-1 naar nieuwe `<Sidebar>` |
| `AdminLayout.tsx` 18–29 (`NAV`-array) | 20 | Sidebar-navlinks | **M (20)** — ongewijzigd |
| `TeamLayout.tsx` 197,208,219,230,244 (`tbn-icon`) | 22 | Mobiele bottom-nav | **L (24)** |
| `AdminLayout.tsx` bottom-nav (hergebruikt `l.icon` uit `NAV`) | 20 (impliciet, want zelfde vooraf-gesizede JSX-element als de sidebar) | Mobiele bottom-nav | **L (24)** — vereist herstructurering: `NAV` moet het icoon-*component* opslaan (bv. `Icon: DashboardIcon`), niet een vooraf gesizede `<DashboardIcon size={20}/>`, zodat sidebar en bottom-nav dezelfde configregel met verschillende maat kunnen renderen |
| `AdminLayout.tsx` 167 (`MoreHorizontal`) | 21 | "Meer"-trigger | **L (24)** |
| `TeamLayout.tsx` 244 (`MoreHorizontal`) | 22 | "Meer"-trigger | **L (24)** |
| `MobileMoreNav.tsx` 43 (`X`, header-sluitknop) | 22 | Sheet-header chrome | **S (18)** — het is een sluitknop, geen navicoon; overweeg zelfs hergebruik van `CloseIcon` uit de registry i.p.v. losse `X`-import |
| `MobileMoreNav.tsx` 46–56 (Warehouse/Umbrella/Clock3/UserRound/FileText/ReceiptText/TicketCheck/Settings/LogOut) | 21 | Sheet-tegel-iconen | **L (24)** |
| `AdminMobileMoreNav.tsx` 23 (`X`) | 22 | Sheet-header chrome | **S (18)** |
| `AdminMobileMoreNav.tsx` 26 (`LogOut`) | 20 | Sheet-tegel (logout) | **L (24)** — huidige waarde was toevallig al 20 omdat hij losstaat van de overige tegel-iconen (die via `items`-prop uit `NAV` op 20 kwamen); na de bottom-nav/sidebar-ontkoppeling (zie rij hierboven) wordt de hele sheet consistent 24 |

### Registry-gat: sheet-iconen omzeilen `Icons.tsx`

`MobileMoreNav.tsx` en `AdminMobileMoreNav.tsx` importeren hun iconen
rechtstreeks uit `lucide-react` in plaats van via de registry — daardoor
staat de `strokeWidth=2`-garantie van `Icons.tsx` niet vast (werkt nu
toevallig omdat lucide's eigen default ook 2 is, maar is fragiel). Voeg
ontbrekende registry-exports toe (`WarehouseIcon`, `TicketIcon`
[Support — vervangt de 🎫-emoji, zie §4-F], `LogoutIcon`, `ReceiptIcon`
[Declaraties — zie §4-F]) en laat beide sheet-componenten die importeren in
plaats van ruwe lucide-icons.

---

## 4. Grid/layout audit findings

**A) `TeamLayout.tsx` regel 303–315, `.team-nav`** — het hoofddefect: 10
links in een ongestylede `overflow-x:auto`-strip zonder scroll-affordance
(`scrollbar-width:none` verbergt zelfs de enige hint dát het scrollt).
Breekt op elke desktopbreedte < ~1400px. **Fix**: volledig vervangen door
`<Sidebar>` (§1) — lost dit finding op zonder een losstaande CSS-patch.

**B) `pages/admin/index.tsx` regel 586–589 (`.plan-grid-wrap`) en
`pages/team/[location].tsx` regel 278 (`.team-grid-wrap`)** — beide zijn
een *legitieme* horizontale scroll (weekrooster met 7 dagkolommen +
medewerkerkolom, `min-width:600px` op de tabel, regel 599 resp. 279); dat
is onvermijdelijk en correct verborgen achter een mobiele kaartweergave
onder 768px/1024px. Ontbrekend: op tussenliggende breedtes waar de tabel
wél getoond wordt maar niet volledig past (bv. 769–1000px), is er geen
enkele visuele affordance dat er meer kolommen rechts staan — geen
fade/schaduw aan de randen. **Fix**: voeg een scroll-fade toe aan beide
wrap-containers, bv. via `mask-image: linear-gradient(to right, black
calc(100% - 24px), transparent)` wanneer `scrollWidth > clientWidth`
(of eenvoudiger: een altijd-aanwezige subtiele `box-shadow: inset -12px 0
12px -12px rgba(0,0,0,.08)` aan de rechterrand) — zelfde patroon op beide
plekken, kandidaat voor een gedeelde `.scroll-fade-x`-utility-class in
`globals.css` in plaats van twee keer los te implementeren.

**C) `pages/team/[location].tsx` regel 297–300** —
`@media (max-width:1024px){ .team-grid-section{ display:none } }` verbergt
de volledige "wie werkt welke dag"-tabel zonder mobiele vervanging. Onder
1024px ziet de medewerker alleen de 7 dag-samenvattingskaarten
(bezettingsaantal + occupancy-bar, regel 120–179) en moet per dag
uitklappen (`day-expand`, regel 153–175) om namen te zien — er is geen
compact week-per-medewerker-overzicht op mobiel, in tegenstelling tot
`pages/admin/index.tsx` dat wél zo'n kaartweergave heeft
(`.mobile-emp-card`/`.mobile-days-strip`, regel 456–497). Dit is een
functioneel gat, geen puur visueel probleem: medewerkers verliezen op
mobiel het overzicht "wie werkt wanneer" dat desktop-gebruikers wel hebben.
**Fix**: porteer hetzelfde kaartpatroon (`.mobile-emp-card`) naar
`team/[location].tsx` onder 1024px, als aanvulling op (niet vervanging
van) de dag-samenvattingskaarten. Omdat dit exact dezelfde markup/CSS-vorm
nodig heeft als de admin-pagina, is dit een goede kandidaat om te
extraheren naar één gedeelde `components/ui/MobileScheduleCards.tsx` in
plaats van een derde parallelle implementatie te bouwen.

**D) `pages/admin/index.tsx` regel 676 (`.mobile-days-strip`)** —
`grid-template-columns: repeat(7, 1fr)` zonder `min-width` per kolom.
`.mobile-chip-time` wordt al verborgen onder 480px (regel 726–731) als
gedeeltelijke mitigatie, maar de kolombreedte zelf is nooit naar beneden
geklemd — op een 320–360px scherm (bv. iPhone SE-klasse) comprimeren 7
kolommen tot ~42–48px elk, waarbinnen zowel het 3-letterige diensttype-label
als de "+"-toevoegknop moeten passen. Risico op visuele collision/wrap op
de smalste ondersteunde breedte. **Fix**: geef `.mobile-day-col` een
`min-width` (bv. 44px) en maak `.mobile-days-strip` zelf horizontaal
scrollbaar (`overflow-x:auto`) onder ~360px in plaats van oneindig te
comprimeren — analoog aan hoe de desktoptabel al met een bewuste
scroll-strategie omgaat (zie B). **Dit item moet empirisch geverifieerd
worden op een echt 320px-viewport** door de implementerende developer vóór
oplevering — de exacte kantelbreedte is een schatting, geen meting.

**E) Iconische inconsistentie in grid-cellen (tekstglyphs i.p.v. SVG)** —
`pages/admin/index.tsx`: `.cell-add-btn` (regel 651–657, letterlijke `+`
tekst), `.mobile-add-btn` (regel 691–697, idem), `.chip-delete` (regel
643–648, letterlijke `×` tekst); `styles/globals.css` regel 169
(`.shift-act-btn`, `×`). Tekstglyphs hebben font-afhankelijke verticale
metrics die niet optisch uitlijnen op hetzelfde grid als echte SVG-iconen
(vandaar deels de "iconen zitten niet op een grid"-klacht — dit is niet
alleen een maatprobleem maar ook een *technique*-probleem: sommige
"iconen" in de app zijn helemaal geen iconen). **Fix**: vervang door echte
lucide-iconen via de registry — voeg `PlusIcon` (`Plus` uit lucide) toe aan
`Icons.tsx`, hergebruik het bestaande `CloseIcon` voor de ×-knoppen, beide
op **S (18px)** tier passend bij de kleine celchrome (28–36px hoge
knoppen) — geen nieuwe 4e maat nodig.

**F) Emoji-als-icoon breekt de actieve-state-styling** —
`TeamLayout.tsx` regel 162 (`<span className="support-icon">🎫</span>`) en
`AdminLayout.tsx` regel 29 (`<span className="sb-dave-icon">🎫</span>`)
gebruiken een emoji-glyph voor het Support-navitem, terwijl elk ander
navitem een lucide-SVG is. Concreet aantoonbaar gebrek: `globals.css` regel
408–411 (`.tn-link.active svg { stroke:#FFCF6B }`) kan per definitie niet
op een `<span>`-emoji worden toegepast — het Support-item krijgt dus nooit
dezelfde goud-kleur-highlight bij actieve status die alle andere navitems
wél krijgen. Zelfde probleem met `DocumentIcon` dat *tweemaal* hergebruikt
wordt voor twee verschillende navitems (Documenten én Declaraties,
`TeamLayout.tsx` regel 146 en 154) — geen inhoudelijke fout, maar wel een
gemiste kans op onderscheidbaarheid tussen twee veelgebruikte, verschillende
functies. Los van de kern-navigatiescope: `pages/admin/open-shifts.tsx`
gebruikt emoji voor actie-iconen door de hele pagina (📋 regel 273, 🔁 regel
276, ✏️ regel 566, 🗑 regel 575, ⚠️ regel 287/505, ✅/❌ in toastberichten) —
zelfde onderliggende probleem, buiten de nav maar wel op een van de drie
aangewezen inspectiepagina's. **Fix**: Support-icoon → `TicketCheck`
(reeds geïmporteerd in `MobileMoreNav.tsx`, toevoegen aan `Icons.tsx` als
`TicketIcon`), Declaraties-icoon → `Receipt`/`ReceiptText` (toevoegen als
`ReceiptIcon`, al gebruikt in `MobileMoreNav.tsx` regel 51) zodat
Documenten en Declaraties visueel te onderscheiden zijn. De
`open-shifts.tsx`-emoji's vallen buiten de kernscope van dit
navigatiedocument maar worden hier genoteerd omdat de pagina expliciet als
inspectiepunt was aangewezen.

---

## 5. Tokens & scope-bewaking

Geen nieuwe design tokens nodig buiten de twee al genoemde toevoegingen,
beide passend binnen het bestaande naamgevingspatroon in
`styles/globals.css`:
- `--bnav-h: 60px` (naast het al bestaande `--sidebar-w: 248px`, regel 56)
- Hergebruik van bestaande kleurtokens voor alle nieuwe UI: sidebar-actief
  = `rgba(200,136,42,.18)` / `#FFCF6B` (letterlijk overnemen uit
  `AdminLayout.tsx` regel 271–274, niet opnieuw uitvinden), locatie-accent =
  bestaande `--markt`/`--noot`.

Geen wijziging aan `--brand`, `--bg`, `--surface`, `--text*`-tokens. Geen
nieuwe iconbibliotheek naast lucide-react. Geen wijziging aan de
`can()`-capability-matrix of routing.

## Overdracht — aanbevolen implementatievolgorde

1. `components/layout/Sidebar.tsx` bouwen (presentatie-only), `AdminLayout`
   erop overzetten zonder gedragswijziging (regressietest: admin-nav moet
   pixel-voor-pixel identiek ogen aan vandaag).
2. `TeamLayout` op dezelfde `<Sidebar>` overzetten met de nieuwe
   3-secties-indeling (§1) — dit lost finding A op.
3. Icoonschaal-mapping doorvoeren (§3-tabel) — losse, mechanische stap,
   goed te combineren met stap 1–2 omdat de sidebar/bottom-nav-code toch
   wordt aangeraakt.
4. `<MoreSheet>` bouwen, beide bestaande sheets erop overzetten, motion
   toevoegen (§2 a–c).
5. `--bnav-h`-token invoeren, safe-area-berekening in beide layouts
   corrigeren (§2-e).
6. Grid-audit-fixes B–F, in aflopende prioriteit: C (functioneel gat) vóór
   B/D (visuele affordance) vóór E/F (icoon-cosmetica).
