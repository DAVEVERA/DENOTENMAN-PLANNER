# Bekijk-als-medewerker (impersonatie voor admins)

## Doel

Admins (role `admin`: Fedor, administrator) moeten de hele app kunnen ervaren
zoals een medewerker die ziet — inclusief de urenregistratie-goedkeuringsflow
(indienen → pending → beoordeling) — om gemelde problemen te kunnen
reproduceren. Dit moet zonder:
- verlies van hun eigen admin-sessie/rechten (één klik terug),
- enig risico dat testdata in echte rapportage, export of het weekrooster
  terechtkomt,
- nieuwe inlog-credentials te hoeven onthouden.

## Niet-doelen (v1)

- Impersoneren van een *echte* medewerker (bekeken data is altijd de vaste
  test-medewerker, nooit een bestaand medewerkersaccount).
- Automatische opschoning van testdata (kan later los worden toegevoegd).
- Impersonatie voor `manager`-rol (alleen `admin` voor nu; triviaal uit te
  breiden later via `can()`, geen hardcoded gebruikersnamen).

## Aanpak: sessie-rolwissel

Eén knop herschrijft tijdelijk de iron-session cookie: de echte
admin-identiteit wordt weggezet onder `impersonating_admin`, en de actieve
`session.user` wordt de vaste test-medewerker (`role: 'employee'`,
`employee_id` van de test-medewerker). Alle bestaande rol-/rechten-logica
(`can()`, `getServerSideProps`-redirects, de hours self-submission-tak in
`pages/api/hours/index.ts`) werkt hierdoor ongewijzigd — geen enkele
bestaande medewerkerspagina of -API hoeft aangepast te worden.

Afgewogen tegen twee alternatieven (zie brainstorm-gesprek): een losstaande
"preview-vlag" naast admin-rechten (grotere kans om af te wijken van de
echte medewerker-ervaring, moet overal los ingebouwd) en een apart
inlogaccount voor de test-medewerker (geen banner/terug-knop, extra
wachtwoord). Rolwissel is gekozen omdat het de minste nieuwe oppervlakte
heeft en per definitie 100% dezelfde code-paden gebruikt als een echte
medewerker.

## Datamodel

Nieuwe kolom, additieve migratie (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`,
zelfde patroon als `migrations/005_hour_submissions.sql`):

```sql
ALTER TABLE planner20_employees
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;
```

Eén seed-rij voor de vaste test-medewerker:

```sql
INSERT INTO planner20_employees
  (name, is_active, user_level, location, is_test_account)
VALUES
  ('Test Medewerker', 0, 'Medewerker', 'both', true)
ON CONFLICT DO NOTHING;
```

`is_active = 0` verstopt de test-medewerker automatisch uit alle bestaande
"actieve medewerkers"-selecties die dat filter al gebruiken (o.a. de
medewerker-dropdown in `pages/admin/hours/index.tsx`, shift-planning). Dat is
de eerste, brede beveiliging.

`is_test_account = true` is de tweede, expliciete beveiliging specifiek voor
de twee plekken die niet via een "actieve medewerkers"-lijst lopen:

- `getExportTimeLogs` / `getHoursSummary` (`lib/hours.ts`) — uitsluiten van
  de boekhouder-export en uren-samenvatting, ongeacht wat er tijdens het
  testen wordt ingediend of goedgekeurd.
- De weekrooster/planning-query in `lib/scheduler.ts` — uitsluiten van het
  normale roosteroverzicht.

## Sessie & API

`SessionUser` (types/index.ts) krijgt een optioneel veld:

```ts
impersonating_admin?: {
  user_id: string
  display_name: string
  role: 'admin'
}
```

Twee nieuwe endpoints in `lib/auth.ts` + `pages/api/admin/impersonate/`:

- `POST /api/admin/impersonate/start`
  - Vereist `session.user.role === 'admin'` en dat er nog niet wordt
    geïmpersoneerd (voorkomt geneste impersonatie).
  - Haalt de test-medewerker op (`is_test_account = true`).
  - Zet `session.user.impersonating_admin` = huidige identiteit
    (`user_id`, `display_name`, `role`).
  - Herschrijft `session.user` naar: `role: 'employee'`,
    `employee_id: <test-medewerker id>`, `user_id: 'test-medewerker'`,
    `display_name: 'Test Medewerker'`, `location: 'both'`.
  - `session.save()`.

- `POST /api/admin/impersonate/stop`
  - Vereist dat `session.user.impersonating_admin` bestaat.
  - Herstelt `session.user` uit `impersonating_admin`, verwijdert het veld.
  - `session.save()`.

Geen wijziging nodig aan `getSession()` zelf — dit is puur
sessie-payload-manipulatie, hetzelfde patroon als `attemptLogin`.

## UI

- `AdminLayout`: voor `role === 'admin'` een knop **"Bekijk als
  medewerker"** (bv. naast uitloggen) → `POST .../start` → redirect naar
  `/me`.
- `TeamLayout`: wanneer `user.impersonating_admin` aanwezig is, een
  persistente banner bovenaan:
  *"Je kijkt als Test Medewerker · ingelogd als {impersonating_admin.display_name}
  · [Terug naar admin]"*. Klik op de link → `POST .../stop` → redirect naar
  `/admin`.
- Geen wijziging nodig in hoe `user` als prop wordt doorgegeven — dat
  patroon (`getSession` → `props: { user: session.user }`) bestaat al op elke
  betrokken pagina, dus `impersonating_admin` komt gratis mee.

## Randgevallen

- **Eigen testinzending goedkeuren**: toegestaan, geen restrictie. De
  test-medewerker is een geïsoleerde fictieve identiteit, dus dit is precies
  de volledige flow end-to-end testen, geen belangenverstrengeling met
  echte data.
- **Sessie verloopt/tab dicht tijdens impersonatie**: geen los op te ruimen
  state — alles zit in dezelfde iron-session cookie. Ergste geval: opnieuw
  inloggen als admin, banner met "Terug naar admin" is altijd zichtbaar
  zolang de sessie actief is.
- **Geneste impersonatie**: `start` wordt geblokkeerd als
  `impersonating_admin` al gezet is.
- **Toekomstige uitbreiding naar `manager`-rol**: één regel
  (`can(user, '...')`-check), geen hardcoded gebruikersnamen nodig.

## Testplan

- Unit/handmatig: inloggen als `administrator` → "Bekijk als medewerker" →
  verifiëren dat adminmenu weg is en medewerkersmenu (TeamLayout) getoond
  wordt met banner.
- Uren indienen als test-medewerker → verifiëren `submission_status =
  'pending'` (niet `'direct'`) — dit was het hele punt: reproduceert de
  medewerker-indienflow inclusief goedkeuring.
- "Terug naar admin" → verifiëren adminrechten en originele identiteit
  hersteld zijn.
- Verifiëren dat de test-medewerker NIET verschijnt in: medewerker-dropdown
  op Urenregistratie, weekrooster, uren-export/samenvatting — ook na
  goedkeuren van een test-inzending.
- Build + typecheck (`npm run build`) zoals bij de vorige fix in deze repo.
