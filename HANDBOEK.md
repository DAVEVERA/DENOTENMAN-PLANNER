# Handboek De Notenkar Planner

**Versie:** April 2026  
**Voor:** Eigenaar / beheerder en medewerkers van De Notenkar

---

## Inhoudsopgave

1. [Wat is de Planner?](#1-wat-is-de-planner)
2. [Rollen en toegang](#2-rollen-en-toegang)
3. [Inloggen en uitloggen](#3-inloggen-en-uitloggen)
4. [Deel A — Beheerder (admin/manager)](#deel-a--beheerder-adminmanager)
   - [A1. Rooster opbouwen](#a1-rooster-opbouwen)
   - [A2. Open diensten](#a2-open-diensten)
   - [A3. Medewerkers beheren](#a3-medewerkers-beheren)
   - [A4. Uren registratie](#a4-uren-registratie)
   - [A5. Exporteren](#a5-exporteren)
   - [A6. Verlofaanvragen](#a6-verlofaanvragen)
   - [A7. Instellingen](#a7-instellingen)
5. [Deel B — Medewerker](#deel-b--medewerker)
   - [B1. Mijn rooster](#b1-mijn-rooster)
   - [B2. Teamrooster](#b2-teamrooster)
   - [B3. Mijn uren](#b3-mijn-uren)
   - [B4. Verlof aanvragen](#b4-verlof-aanvragen)
6. [De app installeren op je telefoon](#6-de-app-installeren-op-je-telefoon)
7. [Meldingen (push notificaties)](#7-meldingen-push-notificaties)
8. [Icons aanpassen](#8-icons-aanpassen)
9. [Technische instellingen (SMTP / e-mail)](#9-technische-instellingen-smtp--e-mail)
10. [Veelgestelde vragen](#10-veelgestelde-vragen)

---

## 1. Wat is de Planner?

De Notenkar Planner is een privé webapplicatie voor het plannen van diensten, het bijhouden van uren en het beheren van verlofaanvragen voor beide locaties: **De Notenkar (Markt)** en **Het Nootmagazijn**.

De planner werkt op elk apparaat — computer, tablet én telefoon — en kan als app op je startscherm worden gezet (zie [hoofdstuk 6](#6-de-app-installeren-op-je-telefoon)).

**Wat kan de planner?**

- Wekelijks rooster per locatie opbouwen en aanpassen
- Open diensten uitzetten en medewerkers uitnodigen
- Medewerkers en hun gegevens bijhouden
- Uren registreren, bewerken en exporteren naar de boekhouder
- Verlofaanvragen ontvangen en goedkeuren of afwijzen
- Medewerkers inzage geven in hun eigen rooster en uren

---

## 2. Rollen en toegang

De planner kent drie rollen. Iedere gebruiker heeft één rol.

| Rol | Wie | Wat mag deze rol? |
|-----|-----|-------------------|
| **Admin** | Eigenaar / hoofdbeheerder | Alles — rooster, medewerkers, uren, export, instellingen |
| **Manager** | Leidinggevende | Rooster, uren, verlof — maar geen medewerkersbeheer of instellingen |
| **Medewerker** | Gewone medewerker | Eigen rooster zien, teamrooster zien, eigen uren inzien, verlof aanvragen |

> **Samengevat:** Medewerkers zien alleen wat van hen is. Beheerders (admin/manager) zien alles.

---

## 3. Inloggen en uitloggen

**Inloggen**

1. Ga naar de planner in je browser (of open de app op je telefoon).
2. Voer je **gebruikersnaam** en **wachtwoord** in.
3. Klik op **Inloggen**.

Na het inloggen ga je automatisch naar de juiste startpagina:
- **Admin/Manager** → Roosterbeheer (`/admin`)
- **Medewerker** → Persoonlijk rooster (`/me`)

**Uitloggen**

Klik rechtsboven op je naam of het uitlogicoon. Op de telefoon staat de uitlogknop rechtsboven in de navigatiebalk.

> Sessies blijven actief totdat je uitlogt of de browser sluit.

---

## Deel A — Beheerder (admin/manager)

Dit deel beschrijft alles wat de eigenaar en manager kunnen zien en doen.

De linker navigatie (desktop) of onderbalk (telefoon) geeft toegang tot alle onderdelen:
- **Rooster** — wekelijks rooster per locatie
- **Medewerkers** — alle medewerkers en hun gegevens
- **Uren** — urenregistratie en verwerking
- **Verlof** — verlofaanvragen van medewerkers
- **Export** — bestanden voor de boekhouder
- **Instellingen** — app-configuratie (alleen admin)

---

### A1. Rooster opbouwen

**Pagina:** `/admin` (hoofdpagina na inloggen als beheerder)

Dit is het hart van de planner. Hier bouw je het wekelijkse rooster op.

**Navigeren tussen weken**

- Gebruik de **pijl links / rechts** naast het weeknummer om een week voor- of achteruit te gaan.
- Klik op **Vandaag** om direct naar de huidige week te springen.
- Bovenaan kun je filteren op locatie: **Alle locaties**, **De Notenkar (Markt)** of **Het Nootmagazijn**.

**Het rooster lezen**

Het rooster toont een tabel met:
- **Rijen** = medewerkers
- **Kolommen** = dagen van de week (maandag t/m zondag)
- **Cellen** = diensten per medewerker per dag

Elke dienst verschijnt als een gekleurde chip. De kleur geeft het diensttype aan:
- Ochtend, Middag, Avond, Hele dag (werktijden)
- Verlof, Vakantie, Verzuim (afwezigheid)
- Overwerk, Extra (bijzondere diensten)

**Een dienst toevoegen**

1. Klik op het **+** knopje in een cel (verschijnt bij het bewegen over een cel; op telefoon altijd licht zichtbaar).
2. Er opent een modal (pop-up) met het formulier:
   - **Diensttype** (Ochtend, Middag, Avond, Hele dag, Verlof, enz.)
   - **Begintijd / Eindtijd** (niet verplicht bij "Hele dag" of afwezigheid)
   - **Notitie** (optioneel — intern gebruik)
   - **Buddy** (optioneel — collega die tegelijk werkt)
3. Klik **Opslaan**.

De dienst verschijnt direct in het rooster.

**Een dienst bewerken**

Klik op een bestaande dienst-chip. Het formulier opent opnieuw, nu ingevuld met de huidige gegevens. Pas aan en klik **Opslaan**.

**Een dienst verwijderen**

Open de dienst (klik op de chip) en klik op het **prullenbakicoon** of de **× knop** in de chip zelf.

**Bezettingsbalk**

Bovenaan elke dag zie je een kleine balk die de bezetting laat zien (hoeveel Ochtend / Middag / Avond diensten er staan). Dit helpt snel zien of een dag goed bemand is.

---

### A2. Open diensten

**Open dienst** = een dienst die nog niet aan een medewerker is toegewezen. Handig als je weet dat er iemand nodig is maar nog niet weet wie.

**Open dienst aanmaken**

In het rooster verschijnt een rij **"Open diensten"** onderaan. Klik op **+** in een cel van die rij, kies het diensttype en sla op. De dienst staat nu als "open" in het rooster.

**Medewerker uitnodigen voor open dienst**

1. Klik op een open dienst-chip.
2. Klik op **Uitnodigen** en selecteer een medewerker.
3. De medewerker ontvangt een pushmelding (als ingeschakeld) en ziet de uitnodiging in zijn/haar rooster.
4. De medewerker kan **Accepteren** of **Afwijzen**.
5. Na acceptatie wordt de dienst automatisch aan de medewerker gekoppeld.

---

### A3. Medewerkers beheren

**Pagina:** `/admin/employees`

Hier beheer je alle medewerkers van beide locaties.

**Overzicht**

De lijst toont alle actieve medewerkers met:
- Naam
- Locatie (Markt / Nootmagazijn / Beide)
- Contracturen per week
- Rol (Medewerker / Manager / Admin)

Gebruik het **locatiefilter** bovenaan om alleen medewerkers van één locatie te tonen. Vink **"Toon inactieve"** aan om ontslagen medewerkers te zien.

**Nieuwe medewerker toevoegen**

1. Klik op **+ Medewerker toevoegen**.
2. Vul in:
   - **Naam** (verplicht)
   - **E-mail** — dit wordt de inlognaam
   - **Telefoon** (optioneel)
   - **Contracturen** per week
   - **Uurloon** (optioneel, voor urenoverzichten)
   - **Locatie** — Markt, Nootmagazijn of Beide
   - **Rol** — Medewerker, Manager of Admin
3. Klik **Opslaan**.

> Het wachtwoord wordt apart ingesteld — de medewerker ontvangt een tijdelijk wachtwoord of de beheerder stelt dit in via het detailscherm.

**Medewerker bewerken**

Klik op de naam van een medewerker om naar het detailscherm te gaan (`/admin/employees/[id]`). Hier kun je:
- Alle gegevens aanpassen
- Het wachtwoord opnieuw instellen
- De medewerker **deactiveren** (knop "Deactiveren") — ze verdwijnen uit het actieve rooster maar hun historische data blijft bewaard
- De **recente diensten** van de medewerker bekijken (laatste 8 weken)

**Medewerker deactiveren vs. verwijderen**

Kies altijd voor **deactiveren**. Dan blijven uren en historische roosters intact. Echte verwijdering is niet beschikbaar om dataverlies te voorkomen.

---

### A4. Uren registratie

**Pagina:** `/admin/hours`

Hier registreer en beheer je alle gewerkte uren van alle medewerkers.

**Filters**

Bovenaan staan filters:
- **Van / Tot** — datumbereik (standaard: huidige maand)
- **Medewerker** — filter op één persoon
- **Locatie** — filter op Markt of Nootmagazijn
- **Status** — Onverwerkt / Verwerkt / Alle

Op de telefoon zijn de filters verborgen achter een **"Meer filters"** knop om ruimte te besparen.

Klik op **Ophalen** om de resultaten te vernieuwen.

**Uren bekijken**

- **Desktop:** een tabel met alle registraties
- **Telefoon:** kaartjes per registratie met dezelfde informatie

Per registratie zie je:
- Medewerker
- Datum
- Intijdstip en eindtijdstip
- Pauze (in minuten)
- Totaal gewerkte uren
- Overuren
- Locatie
- Status (verwerkt / onverwerkt)
- Eventuele notitie

**Nieuwe urenregistratie toevoegen**

1. Klik op **+ Registratie toevoegen**.
2. Vul in: medewerker, datum, in/uit-tijden, pauze, locatie.
3. Klik **Opslaan**.

**Registratie bewerken**

Klik op het **potloodicoon** naast een registratie. Het bewerkingsformulier opent inline (in de tabel of kaartje). Pas aan en klik **Opslaan**. Klik op **×** om te annuleren.

**Registratie verwijderen**

Klik op het **prullenbakicoon**. Er verschijnt een bevestigingsvraag.

**Uren als "verwerkt" markeren**

1. Vink de gewenste registraties aan (checkbox links).
2. Gebruik **Alles selecteren** om alle zichtbare registraties aan te vinken.
3. Klik op **Markeer als verwerkt**.

"Verwerkt" betekent dat de uren zijn doorgestuurd naar de boekhouder of zijn verwerkt in de salarisadministratie. Verwerkte uren zijn visueel anders weergegeven.

---

### A5. Exporteren

**Pagina:** `/admin/hours/export`

Hier exporteer je urenregistraties als bestand of stuur je ze direct naar de boekhouder.

**Stap 1 — Kies een periode**

Vul de **Van** en **Tot** datum in, of gebruik een snelkeuze rechts:
- **Deze maand**
- **Vorige maand**
- **Dit kwartaal**

**Stap 2 — Stel filters in (optioneel)**

- **Medewerker** — exporteer uren van één persoon
- **Locatie** — exporteer uren van één locatie
- **Status** — kies Onverwerkt, Verwerkt of Alle

**Stap 3 — Kies het formaat**

| Formaat | Gebruik |
|---------|---------|
| **CSV** | Opent in Excel of Google Sheets; universeel formaat |
| **Excel (.xlsx)** | Kant-en-klaar Excel-bestand met opmaak |
| **PDF** | Afdrukbaar rapport, inclusief totalen |
| **JSON** | Machineleesbaar; voor koppeling met externe systemen |

**Stap 4 — Verzenden of downloaden**

- **Downloaden:** klik **⬇ Downloaden** — het bestand wordt direct opgeslagen.
- **Sturen naar boekhouder:** vink **"Stuur naar boekhouder"** aan en klik **📤 Exporteren & verzenden**. Het bestand wordt per e-mail verstuurd naar het ingestelde boekhoudadres.

> Als er geen boekhoudadres is ingesteld, verschijnt een waarschuwing met een link naar de instellingenpagina.

---

### A6. Verlofaanvragen

**Pagina:** `/admin/leave`

Hier verwerk je verlofaanvragen van medewerkers.

**Overzicht**

De pagina toont een lijst van aanvragen. Gebruik de filterknoppen bovenaan:
- **In behandeling** — nieuwe, nog niet beoordeelde aanvragen (het rode cijfer geeft het aantal aan)
- **Goedgekeurd** — eerder goedgekeurde aanvragen
- **Afgewezen** — eerder afgewezen aanvragen
- **Alles** — alle aanvragen

Per aanvraag zie je:
- Naam van de medewerker
- Type verlof (Verlof / Vakantie / Verzuim)
- Datumperiode en aantal dagen
- Eventuele toelichting van de medewerker
- Indieningsdatum

**Aanvraag beoordelen**

1. Klik op **Goedkeuren** of **Afwijzen** naast de aanvraag.
2. De status wordt direct bijgewerkt.
3. De medewerker ziet de nieuwe status in zijn/haar eigen verlofpagina.

> Na beoordeling is de beslissing zichtbaar bij de aanvraag, inclusief de naam van de beoordelaar en de datum.

---

### A7. Instellingen

**Pagina:** `/admin/settings` (alleen beschikbaar voor admin-rol)

**Boekhouding**

- **E-mailadres boekhouder** — het adres waarnaar exportbestanden worden verstuurd
- **Naam boekhouder** — wordt gebruikt in de aanhef van de e-mail
- **Automatisch e-mailen bij export** — als dit aan staat, wordt bij elke export automatisch een e-mail verstuurd

**Locatienamen**

Pas hier de weergavenamen aan van de twee locaties. Deze namen verschijnen door de hele app.

**Push notificaties (PWA)**

Voor pushnotificaties zijn VAPID-sleutels nodig. Deze worden ingesteld via het `.env.local` bestand op de server — dit doet de technische beheerder. Zie [hoofdstuk 9](#9-technische-instellingen-smtp--e-mail) voor meer uitleg.

**E-mail (SMTP)**

SMTP-instellingen (de mailserver voor het versturen van e-mails) worden ook via `.env.local` ingesteld. De instellingenpagina laat de vereiste variabelen zien.

---

## Deel B — Medewerker

Dit deel beschrijft alles wat een medewerker ziet en kan doen na het inloggen.

Na inloggen komen medewerkers op hun **persoonlijk roosterpagina** (`/me`). Onderaan het scherm (op telefoon en tablet) of in de navigatie staan vier opties:
- **Rooster** — persoonlijk rooster
- **Team** — teamrooster van de locatie
- **Verlof** — verlofaanvragen indienen en bekijken
- **Uren** — eigen uren bekijken

---

### B1. Mijn rooster

**Pagina:** `/me`

Hier ziet de medewerker zijn of haar persoonlijke rooster.

**Weergave kiezen**

Bovenaan staan drie knoppen:
- **Week** — één week tegelijk, met alle diensten per dag
- **Maand** — vier weken overzicht
- **3 mnd** — dertien weken (kwartaaloverzicht)

**Navigeren**

Gebruik de **pijl links / rechts** om voor- of achteruit te bladeren. De knop **Vandaag** brengt je terug naar de huidige week.

**Wat zie je?**

Voor elke dag met een dienst zie je:
- Het **diensttype** (Ochtend, Middag, Avond, enz.)
- De **tijden** (begin en eind)
- Eventuele **buddy** (collega die tegelijk werkt)
- Eventuele **notitie**
- De **locatie**

Afwezigheidsdiensten (Verlof, Vakantie, Verzuim) worden in een aparte kleur getoond.

**Uitnodiging voor open dienst**

Als de beheerder een open dienst heeft uitgezet en jou uitgenodigd heeft, verschijnt dit in je rooster met twee knoppen: **Accepteren** en **Afwijzen**. Na je keuze verdwijnt de uitnodiging.

---

### B2. Teamrooster

**Pagina:** `/team/markt` of `/team/nootmagazijn`

Hier ziet de medewerker het volledige rooster van zijn/haar locatie voor de huidige week.

**Wat zie je?**

- Per dag een overzicht van alle ingeroosterde collega's
- Per dag een **bezettingsbalk** (hoeveel ochtend/middag/avond diensten)
- Je kunt een dag **uitklappen** (klik op de dag) om de details te zien: namen, tijden en diensttype

**Navigeren**

Gebruik de pijltjes om een week voor- of achteruit te gaan.

> Medewerkers kunnen het teamrooster alleen inzien, niet bewerken.

---

### B3. Mijn uren

**Pagina:** `/me/hours`

Hier ziet de medewerker zijn of haar eigen geregistreerde uren.

**Filters**

Stel de gewenste periode in (Van / Tot) en klik op **Ophalen**.

**Wat zie je?**

Een lijst van alle geregistreerde werkdagen met:
- Datum
- Intijdstip en eindtijdstip
- Pauze in minuten
- Totaal gewerkte uren (inclusief overuren)
- Of de registratie al is verwerkt

**Totalen bovenaan**

Boven de lijst staan drie samenvattingen:
- **Totaal uren** in de gekozen periode
- **Overuren**
- **Verwerkt** — hoeveel registraties zijn al doorgegeven aan de boekhouder

> Medewerkers kunnen hun uren alleen inzien, niet bewerken. Bewerken kan alleen de beheerder.

---

### B4. Verlof aanvragen

**Pagina:** `/me/leave`

Hier dient de medewerker verlof, vakantie of verzuim in, en ziet de status van eerdere aanvragen.

**Nieuwe aanvraag indienen**

1. Klik op **+ Nieuwe aanvraag**.
2. Kies het **type**:
   - **Verlof** — regulier verlof
   - **Vakantie** — vakantiedagen
   - **Verzuim/Ziek** — ziekteverzuim
3. Kies de **startdatum** en **einddatum**.
4. Voeg eventueel een **toelichting** toe.
5. Klik **Indienen**.

De beheerder ontvangt de aanvraag en beoordeelt deze. Zodra er een beslissing is, zie je dat direct in de lijst.

**Aanvragen bekijken**

Alle ingediende aanvragen staan in de lijst met hun status:
- **In behandeling** — oranje, nog niet beoordeeld
- **Goedgekeurd** — groen
- **Afgewezen** — rood

Per aanvraag zie je ook wanneer de beslissing is genomen.

---

## 6. De app installeren op je telefoon

De Notenkar Planner is een **Progressive Web App (PWA)**. Dat betekent dat je hem als een echte app op je startscherm kunt zetten, zonder de App Store of Play Store.

**iPhone / iPad (Safari)**

1. Open de planner in **Safari**.
2. Tik op het **deelicoon** (vierkantje met pijl omhoog).
3. Kies **"Zet op beginscherm"** (of "Add to Home Screen").
4. Geef de app een naam en tik op **Toevoegen**.

**Android (Chrome)**

1. Open de planner in **Chrome**.
2. Tik op de **drie puntjes** rechtsboven.
3. Kies **"Toevoegen aan startscherm"** of **"App installeren"**.
4. Bevestig.

De app opent voortaan zonder adresbalk, net als een gewone app.

---

## 7. Meldingen (push notificaties)

Als pushnotificaties zijn ingeschakeld, ontvang je een melding wanneer:
- Je bent uitgenodigd voor een open dienst
- De beheerder een bericht stuurt

**Meldingen inschakelen**

Wanneer je de planner voor het eerst opent in de browser, vraagt de browser of je meldingen wilt ontvangen. Klik op **Toestaan**.

> Als je per ongeluk hebt geweigerd, kun je dit aanpassen via de browserinstellingen (klik op het slotje of het informatie-icoon naast het webadres).

**Vereisten**

Pushnotificaties werken alleen als de beheerder VAPID-sleutels heeft ingesteld (zie [hoofdstuk 9](#9-technische-instellingen-smtp--e-mail)).

---

## 8. Icons aanpassen

Wil je de icons in de navigatie en op de knoppen vervangen door je eigen ontworpen icons? Dat kan eenvoudig.

**Waar staan de iconbestanden?**

Alle icons staan als SVG-bestanden in de map:

```
public/icons/
```

**Overzicht van alle icons en waar ze voorkomen**

| Bestandsnaam | Icoon | Verschijnt op |
|---|---|---|
| `logo.svg` | Logo | Linksboven in de navigatiebalk |
| `schedule.svg` | Rooster | Navigatie → Rooster (beheerder) |
| `employees.svg` | Medewerkers | Navigatie → Medewerkers |
| `leave.svg` | Verlof | Navigatie → Verlof (beheerder + medewerker) |
| `hours.svg` | Uren | Navigatie → Uren |
| `export.svg` | Export | Navigatie → Exporteren |
| `settings.svg` | Instellingen | Navigatie → Instellingen |
| `my-schedule.svg` | Mijn rooster | Navigatie medewerker → Rooster |
| `team-view.svg` | Teamrooster | Navigatie medewerker → Team |
| `close.svg` | Sluiten / × | Modals, annuleerknop |
| `prev.svg` | Pijl links | Week terug navigatie |
| `next.svg` | Pijl rechts | Week vooruit navigatie |

**Een icon vervangen**

1. Ontwerp je eigen icon als **SVG-bestand** (aanbevolen: 24×24 of vierkant).
2. Vervang het bestaande bestand in `public/icons/` met dezelfde bestandsnaam.
3. Herlaad de pagina — het nieuwe icon verschijnt automatisch overal.

> De icons erven automatisch de kleur van de omliggende tekst. Een actief navigatie-item is oranje (`--brand`), een inactief item is grijs. Zorg dat je SVG geen vaste `fill`-kleur heeft maar gebruikmaakt van de ouderkleur, of gebruik een effen pad zonder kleur.

---

## 9. Technische instellingen (SMTP / e-mail)

De volgende instellingen worden geconfigureerd via het bestand `.env.local` in de hoofdmap van de applicatie. Dit doet de technische beheerder (of de webhosting-provider).

**E-mail (voor het versturen van exportbestanden)**

```
SMTP_HOST=mail.jouwprovider.nl
SMTP_PORT=587
SMTP_USER=info@denotenkar.nl
SMTP_PASS=jouwwachtwoord
SMTP_FROM=info@denotenkar.nl
```

**Push notificaties (VAPID-sleutels)**

Genereer eenmalig sleutels met het commando:
```
npx web-push generate-vapid-keys
```

Voeg vervolgens toe aan `.env.local`:
```
VAPID_PUBLIC_KEY=<gegenereerde publieke sleutel>
VAPID_PRIVATE_KEY=<gegenereerde private sleutel>
VAPID_SUBJECT=mailto:info@denotenkar.nl
```

**Database (Supabase)**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-sleutel>
SUPABASE_SERVICE_ROLE_KEY=<service-role-sleutel>
```

**Sessie (beveiliging)**

```
SESSION_SECRET=<willekeurige lange string, minimaal 32 tekens>
```

---

## 10. Veelgestelde vragen

**Ik zie geen rooster als ik inlog als medewerker.**

Controleer of de medewerker een `employee_id` gekoppeld heeft aan zijn gebruikersaccount. Dit stel je in via `/admin/employees/[id]`.

**Een medewerker kan niet inloggen.**

Controleer het e-mailadres (gebruikersnaam) en reset het wachtwoord via de medewerkersdetailpagina.

**De export-e-mail wordt niet verstuurd.**

1. Controleer of het SMTP-adres correct is ingesteld in `.env.local`.
2. Controleer of het boekhoudadres is ingevuld onder Instellingen → Boekhouding.
3. Kijk in de serverlogboeken voor de foutmelding.

**Hoe voeg ik een nieuwe locatie toe?**

Op dit moment ondersteunt de planner twee vaste locaties: Markt en Nootmagazijn. De namen zijn aanpasbaar via Instellingen. Een derde locatie toevoegen vereist aanpassing van de broncode.

**Kan een medewerker zijn eigen diensten aanpassen?**

Nee. Medewerkers kunnen alleen hun rooster inzien. Alleen beheerders en managers kunnen diensten toevoegen, bewerken of verwijderen.

**Hoe verwijder ik een medewerker volledig?**

Dat kan niet via de app — medewerkers worden alleen gedeactiveerd zodat historische data bewaard blijft. Als volledige verwijdering nodig is, neem dan contact op met de technische beheerder.

**De planner laadt traag op de telefoon.**

Zorg dat de app als PWA geïnstalleerd is (zie [hoofdstuk 6](#6-de-app-installeren-op-je-telefoon)). Dit zorgt voor sneller laden en een betere ervaring.

---

*Handboek gegenereerd voor De Notenkar Planner — versie april 2026.*
