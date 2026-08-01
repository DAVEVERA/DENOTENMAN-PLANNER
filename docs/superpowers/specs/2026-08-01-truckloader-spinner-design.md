# TruckLoader vervangt Spinner — design

## Doel

`components/ui/Spinner.tsx` (roterende pinda-SVG) vervangen door een geanimeerde
"De Notenman"-pick-up-truck met pinda-lading, zoals aangeleverd in de upload
(`TruckLoader.tsx` + `demo-standalone.html` met drie PNG-assets als base64).

## Aanleiding

`Spinner` wordt op 28 bestanden / 60+ plekken gebruikt, vrijwel uitsluitend
inline naast tekst:

```tsx
{saving ? <Spinner /> : 'Opslaan'}
<div className="loading-row"><Spinner /> Laden…</div>
```

De aangeleverde `TruckLoader` is ontworpen als brede scène (height 80px,
width 100%, vaste donkere achtergrond `#050300`, vloer-gradient) — dat past
niet naast tekst in een knop. Er wordt geen aparte "grote" variant
geïntroduceerd; in plaats daarvan wordt de component zelf compact en
transparant gemaakt zodat hij overal drop-in past.

## Scope

- **Wel**: `components/ui/Spinner.tsx` intern herimplementeren met de
  truck-animatie. Drie PNG-assets toevoegen. Bestandsnaam, exportnaam en
  aanroep-signatuur (`<Spinner />` zonder verplichte props) blijven ongewijzigd.
- **Niet**: geen van de 28 call-site bestanden wijzigen. Geen aparte
  "full-page" variant. Geen wijziging aan andere componenten met een `size`
  prop (bv. `InviteIcon`).

## Assets

Bron: base64-payloads ingebed in de geüploade `demo-standalone.html`
(`<img src="data:image/png;base64,...">` voor puff, puff-drift, truck, pinda-cargo).

Doel: `components/ui/assets/truck.png`, `peanut.png`, `exhaust.png` —
gedecodeerd naar echte PNG-bestanden en geïmporteerd via Next.js static
image import (`import truckImg from './assets/truck.png'`), zoals in de
aangeleverde `TruckLoader.tsx`. De uitlaat-puff (`exhaust.png`) wordt
tweemaal gebruikt (`dn-tl-puff-base` en `dn-tl-puff-drift`), dus één bestand
volstaat voor beide.

## Component-API

```tsx
export default function Spinner({
  height = 22,
  duration = 4.2,
  className = '',
}: {
  height?: number
  duration?: number
  className?: string
}): JSX.Element
```

- `height` vervangt de oorspronkelijke `size` prop van de oude Spinner.
  Default `22` (in plaats van de `80` uit de demo) — compact genoeg om
  naast tekst in een knop of "Laden…"-rij te staan.
- `duration` en `className` blijven optioneel doorgeef-props, ongewijzigd
  t.o.v. de aangeleverde `TruckLoader`.
- Bestaande aanroepen zonder props (`<Spinner />`) blijven werken zonder
  wijziging. Aanroepen die eerder een numerieke `size` prop meegaven
  bestaan niet in deze codebase (geverifieerd via grep) — geen migratie
  nodig op call sites.

## Visuele aanpassingen t.o.v. de aangeleverde demo

1. **Transparante achtergrond**: `background: #050300` op `.dn-truckloader`
   wordt verwijderd (`transparent`), zodat de animatie op elke
   knop-/paginakleur natuurlijk oogt.
2. **Geen vloer-gradient**: `.dn-tl-floor` (het bruine "wegdek"-blok onderaan)
   wordt verwijderd — dat impliceerde de donkere achtergrond en heeft geen
   functie op een transparante ondergrond.
3. **Compacte default hoogte**: `height` default van 80 → 22px. De truck,
   pinda-cargo, wieldop-glans en uitlaat-puffs schalen mee via de bestaande
   percentage-gebaseerde CSS (aspect-ratio, `top`/`left` in `%`) — geen
   herberekening nodig.
4. Rijrichting (rechts→links, continue loop), vering-hobbel-animatie,
   wieldop-glans en uitlaat-puff-drift blijven ongewijzigd — dat is de kern
   van de visuele identiteit.
5. Accessibility blijft behouden: `role="status"`, `aria-label="Laden…"`,
   visueel verborgen `<span>` met "Laden…" tekst, en de bestaande
   `prefers-reduced-motion`-fallback (animaties uit, truck gecentreerd,
   puff-drift verborgen).

## Bestandsstructuur na wijziging

```
components/ui/
  Spinner.tsx          ← herimplementatie (was: pinda-SVG rotatie)
  assets/
    truck.png
    peanut.png
    exhaust.png
```

## Verificatie

- `npx tsc --noEmit` (of het project-equivalent) slaagt zonder nieuwe
  type-fouten.
- Visuele steekproef: minstens één inline-knopgebruik (bv.
  `pages/login.tsx`) en één "Laden…"-rij (bv. `pages/admin/index.tsx`)
  renderen zichtbaar de truck-animatie zonder layout-breuk (geen
  overflow, geen zwart blok).
- `prefers-reduced-motion: reduce` in browser-devtools simuleren en
  bevestigen dat de animatie stopt en de puff-drift verdwijnt.
