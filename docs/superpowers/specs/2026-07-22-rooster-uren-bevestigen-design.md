# Uren bevestigen/aanpassen direct in het rooster

## Doel

Medewerkers moeten hun gewerkte uren voor een dienst kunnen bevestigen of
corrigeren direct vanuit "Mijn rooster", in plaats van via het losstaande
"Mijn uren"-formulier. Alle ingediende uren blijven, zoals nu, ter
goedkeuring naar de eigenaar van DeNotenman (rol `admin`) gaan — er komt
geen automatische goedkeuring bij, ook niet wanneer de medewerker de
geplande tijden ongewijzigd bevestigt.

## Niet-doelen (v1)

- Geen wijziging aan het bestaande goedkeuringsproces (pending →
  approved/rejected) of wie mag goedkeuren.
- "Mijn uren" (het losse handmatige formulier) blijft ongewijzigd bestaan,
  voor uren zonder gekoppelde dienst.
- Geen bulk-indienen van meerdere diensten tegelijk (v1 is per dienst).
- Toekomstige diensten en verlof/vakantie/verzuim-type diensten krijgen
  geen wijziging — het bestaande "aanbieden aan collega"-gedrag op
  toekomstige diensten blijft ongewijzigd.

## Aanpak

Voor elke dienst van het type "werk" (Ochtend/Middag/Avond/Hele dag/
Overwerk/Extra) die vandaag of in het verleden ligt, toont "Mijn rooster"
een klein potlood- en vinkje-icoon in plaats van het bestaande
"aanbieden"-gedrag:

- **Vinkje** (zonder wijziging): dient direct de geplande tijden van de
  dienst in als gewerkte uren.
- **Potlood**: opent een compacte inline editor (begintijd, eindtijd,
  pauze, notitie — géén locatieveld, die staat al vast via de dienst),
  voorgevuld met de geplande tijden. "Opslaan" sluit de editor en toont de
  aangepaste tijden ter plekke — er wordt niets naar de server gestuurd.
  Het vinkje dient vervolgens in wat op dat moment getoond wordt
  (aangepast of ongewijzigd).
- **Zodra ingediend**: badge toont status (In behandeling / Goedgekeurd /
  Afgewezen), potlood/vinkje verdwijnen. Bij "Afgewezen" komen
  potlood/vinkje terug zodat de medewerker kan corrigeren en opnieuw
  indienen.

## Datamodel

Geen schemawijzigingen. `planner20_time_logs.shift_id` (bestaande,
nullable FK) wordt nu ook gevuld bij medewerker-zelf-indieningen (was
altijd `null` voor deze flow, alleen gebruikt bij admin directe invoer).
`submission_status` blijft altijd `'pending'` bij indienen door de
medewerker — ook bij een ongewijzigde bevestiging — conform de eis dat
alle uren door de eigenaar beoordeeld moeten worden.

## Backend

- `lib/hours.ts`: `submitEmployeeHours()` krijgt een optioneel
  `shift_id: number | null` argument, doorgegeven aan de insert (was
  hardcoded `null`).
- `pages/api/hours/index.ts` (POST, zelf-indienen-tak): accepteert
  optioneel `shift_id` in de body. Indien aanwezig, wordt de dienst
  opgehaald via het bestaande `getShift(id)` en gecontroleerd dat
  `shift.employee_id` overeenkomt met de ingelogde medewerker
  (`session.user.employee_id`) — nooit vertrouwen op een door de client
  aangeleverde eigenaarsclaim. Bij mismatch: 403.

## Frontend

`pages/me/index.tsx` ("Mijn rooster"):

- Haalt naast de diensten ook `/api/hours?employee_id=…&from=…&to=…` op
  voor dezelfde periode (bestaand endpoint, al gebruikt door "Mijn uren"),
  en indexeert het resultaat op `shift_id` zodat elke dienst weet of er al
  een indiening bestaat en wat de status is.
- Per dienst (huidige `.slot-shift`-blok):
  - Toekomstige diensten: ongewijzigd (aanbieden-klik blijft werken zoals
    nu).
  - Vandaag/verleden, type "werk", nog geen indiening: potlood +
    vinkje-icoon.
  - Vandaag/verleden, type "werk", al ingediend: statusbadge
    (kleuren/labels hergebruikt uit `Mijn uren`'s `STATUS_LABEL`/
    `STATUS_CLASS`).
  - Verlof/Vakantie/Verzuim: ongewijzigd, geen iconen.
- Potlood-editor: kleine inline vorm (tijd/tijd/pauze/notitie), geen
  aparte modal — moet ook prettig werken op mobiel (bestaande responsive
  breakpoints van het rooster blijven leidend).
- Vinkje: POST naar `/api/hours` met `shift_id`, `log_date`, `location`,
  `clock_in`, `clock_out`, `break_minutes`, `note` — dezelfde velden als
  het bestaande "Mijn uren"-formulier, nu aangevuld met `shift_id`.
  `log_date` en `location` komen altijd van de dienst zelf (de kalenderdag
  van dat rooster-vakje, resp. `shift.location`), niet van een invoerveld.

## Testen

- Handmatig doorlopen: vinkje zonder wijziging → pending-status
  verschijnt; potlood → wijzigen → opslaan → vinkje → juiste (gewijzigde)
  tijden in de ingediende rij; afgewezen dienst → potlood/vinkje terug,
  opnieuw indienen werkt.
- API: POST met `shift_id` die niet bij de ingelogde medewerker hoort →
  403.
- Regressie: toekomstige diensten en verlof-type diensten tonen nog
  steeds het oude gedrag.
