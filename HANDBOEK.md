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
   - [A8. Team Chat Beheer](#a8-team-chat-beheer)
5. [Deel B — Medewerker](#deel-b--medewerker)
   - [B1. Mijn rooster](#b1-mijn-rooster)
   - [B2. Teamrooster](#b2-teamrooster)
   - [B3. Diensten ruilen of overnemen (Team Chat)](#b3-diensten-ruilen-of-overnemen-team-chat)
   - [B4. Mijn uren](#b4-mijn-uren)
   - [B5. Verlof aanvragen](#b5-verlof-aanvragen)
6. [Team Chat & Roosterregie](#6-team-chat--roosterregie)
   - [6.1 Wat is de Team Chat?](#61-wat-is-de-team-chat)
   - [6.2 De chat gebruiken (voor medewerkers)](#62-de-chat-gebruiken-voor-medewerkers)
   - [6.3 Chatbeheer (voor admins)](#63-chatbeheer-voor-admins)
7. [De app installeren op je telefoon](#7-de-app-installeren-op-je-telefoon)
8. [Meldingen (push notificaties)](#8-meldingen-push-notificaties)
9. [Icons aanpassen](#9-icons-aanpassen)
10. [Technische instellingen (SMTP / e-mail)](#10-technische-instellingen-smtp--e-mail)
11. [Veelgestelde vragen](#11-veelgestelde-vragen)

---

## 1. Wat is de Planner?

De Notenkar Planner is een privé webapplicatie voor het plannen van diensten, het bijhouden van uren en het beheren van verlofaanvragen voor beide locaties: **De Notenkar (Markt)** en **Het Nootmagazijn**.

De planner werkt op elk apparaat — computer, tablet én telefoon — en kan als app op je startscherm worden gezet (zie [hoofdstuk 6](#6-de-app-installeren-op-je-telefoon)).

**Wat kan de planner?**

- Wekelijks rooster per locatie opbouwen en aanpassen
- Open diensten uitzetten en medewerkers uitnodigen
- Medewerkers en hun gegevens bijhouden
- Uren registreren, bewerken en exporteren naar de boekhouder
- Diensten ruilen of overnemen via een geïntegreerde team chat
- Verlofaanvragen ontvangen en goedkeuren of afwijzen
- Medewerkers inzage geven in hun eigen rooster en uren

---

## 2. Rollen en toegang

De planner kent drie rollen. Iedere gebruiker heeft één rol.

| Rol            | Wie                       | Wat mag deze rol?                                                         |
| -------------- | ------------------------- | ------------------------------------------------------------------------- |
| **Admin**      | Eigenaar / hoofdbeheerder | Alles — rooster, medewerkers, uren, export, instellingen                  |
| **Manager**    | Leidinggevende            | Rooster, uren, verlof — maar geen medewerkersbeheer of instellingen       |
| **Medewerker** | Gewone medewerker         | Eigen rooster zien, teamrooster zien, eigen uren inzien, verlof aanvragen |

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
- **Chat** — teamcommunicatie en diensten ruilen
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

> **Let op:** Als een medewerker op beide locaties werkt, kies dan bij **Locatie** voor **"Beide"**. Maak geen twee aparte profielen aan voor dezelfde persoon. Dit voorkomt dubbele gegevens en verwarring in het rooster en de urenregistratie.

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

**Registratie beoordelen of bewerken**

- Door een medewerker ingediende uren staan bovenaan bij **Openstaande urenregistraties**. Open **Beoordelen** en kies **Goedkeuren** of **Afwijzen**. Een reden is verplicht bij afwijzen.
- Een manager of admin wijzigt ingediende medewerkersuren niet zelf. Na afwijzing past de medewerker de uren via het eigen rooster aan en dient een nieuwe revisie in.
- Alleen rechtstreeks door beheer ingevoerde registraties kunnen inline worden bewerkt.

**Registratie archiveren**

Rechtstreeks door beheer ingevoerde registraties kunnen worden gearchiveerd. De rij en auditinformatie blijven daarbij volledig in de database bewaard.

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

| Formaat           | Gebruik                                              |
| ----------------- | ---------------------------------------------------- |
| **CSV**           | Opent in Excel of Google Sheets; universeel formaat  |
| **Excel (.xlsx)** | Kant-en-klaar Excel-bestand met opmaak               |
| **PDF**           | Afdrukbaar rapport, inclusief totalen                |
| **JSON**          | Machineleesbaar; voor koppeling met externe systemen |

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

### A8. Team Chat Beheer

**Pagina:** `/admin/team-chat`

Als beheerder (admin-rol) heb je extra mogelijkheden in de team chat om de communicatie in goede banen te leiden.

**Gesprekken beheren**

Naast de vier vaste kanalen (`Nootities`, `Nootzakelijk`, etc.) kun je als admin:

- **Privé- en groepsgesprekken aanmaken**: Start een gesprek met één of meerdere medewerkers voor specifieke onderwerpen.
- **Leden beheren**: Voeg medewerkers toe aan of verwijder ze uit gesprekken die jij hebt aangemaakt.
- **Gesprekken archiveren**: Verberg een gesprek uit de actieve lijst als het niet meer relevant is. De inhoud wordt bewaard maar is niet meer zichtbaar voor de leden.

**Dienstovernames goedkeuren**

Wanneer een medewerker een "Open dienst" claimt via de chat, moet jij als admin of manager deze claim goedkeuren voordat de dienst wordt toegewezen.

**De 'Planningwacht'**

De chat bevat een slimme assistent, de 'Planningwacht'. Deze kan helpen door automatisch te signaleren wanneer diensten al lang openstaan of door te waarschuwen bij mogelijke roosterconflicten. De Planningwacht doet alleen voorstellen; jij als beheerder neemt altijd de uiteindelijke beslissing.

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
- **Chat** — diensten ruilen en overleggen
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

### B3. Diensten ruilen of overnemen (Team Chat)

**Pagina:** `/me/chat` (via de nieuwe 'Chat' knop in de navigatie)

De planner heeft een ingebouwde team chat. Deze is niet alleen om te praten, maar is direct gekoppeld aan het rooster. Via de chat kun je veilig en officieel een dienst overdragen aan een collega of een dienst ruilen.

**De vier vaste kanalen**

De chat heeft vier kanalen voor het hele bedrijf waar iedereen kan meelezen en -praten:

- `Nootities`: Voor algemene mededelingen en leuke weetjes.
- `Nootzakelijk`: Voor belangrijke, werkgerelateerde zaken.
- `The Nootorious`: Voor informele gesprekken en teamspirit.
- `NOOTSCHAP!!`: Voor urgente berichten die iedereen direct moet zien.

Daarnaast kan een beheerder specifieke groepsgesprekken aanmaken. Je kunt zelf geen gesprekken starten.

**Een dienst aanbieden of ruilen**

De belangrijkste functie van de chat is het regelen van je diensten.

1.  **Dienst delen in de chat**:
    Ga naar **Mijn rooster** (`/me`) en zoek de dienst die je wilt ruilen of afstaan. Via een nieuwe knop bij de dienst kun je deze 'delen' in een chatkanaal of een direct gesprek. De dienst verschijnt dan als een interactieve kaart.

2.  **Een dienst laten overnemen**:
    Als je een dienst hebt gedeeld, kunnen collega's via de kaart reageren met **"Ik kan deze overnemen"**. Jij ontvangt dan een verzoek. Pas als jij dit verzoek **accepteert**, wordt de dienst officieel overgedragen in het rooster. De planner controleert automatisch of de overname geen roosterconflicten veroorzaakt.

3.  **Een open dienst claimen**:
    Wanneer een beheerder een "Open dienst" in de chat deelt, kun jij deze claimen. Een beheerder moet jouw claim goedkeuren. Na goedkeuring staat de dienst op jouw naam.

4.  **Een dienst ruilen met een collega**:
    Deel jouw dienst in een gesprek met de collega met wie je wilt ruilen. Via de kaart kun je een ruil voorstellen. Je collega krijgt een verzoek en kan een van zijn/haar diensten selecteren om tegen te ruilen. Pas als jullie **beiden akkoord** gaan, wordt de ruil definitief en past de planner het rooster automatisch aan.

Alle wijzigingen worden bevestigd met een systeembericht in de chat. De tijden, locatie en het type dienst veranderen nooit; alleen de persoon die de dienst werkt. Dit zorgt ervoor dat alles eerlijk en duidelijk verloopt.

---

### B4. Mijn uren

**Pagina:** `/me/hours`

Op deze pagina zie je een overzicht van al je ingediende en verwerkte uren. Het indienen van uren voor een **geplande dienst** doe je echter direct vanuit je rooster. Losse uren (zonder dienst) kun je wel hier toevoegen.

**Uren van een geplande dienst indienen (via 'Mijn rooster')**

De makkelijkste manier om je uren door te geven is direct na je werkdag:

1. Ga naar **Mijn rooster** (`/me`) en klik op de dienst die je hebt gewerkt.
2. Na de geplande eindtijd van de dienst verschijnt de optie **Uren controleren**.
3. Als de geplande tijden kloppen, kies je **Ja, deze uren kloppen**.
4. Als je langer of korter hebt gewerkt, kies je **Nee, uren aanpassen** en vul je de juiste tijden in.
5. Controleer de samenvatting en klik op **Indienen**.
6. Je urenregistratie krijgt de status **In behandeling** en wordt door een beheerder beoordeeld.
7. Bij afwijzing zie je de reden en kun je de uren **Corrigeren** en opnieuw indienen. De historie blijft bewaard.

**Overzicht van al je uren**

De pagina `/me/hours` toont een complete lijst van je registraties. Hier kun je met de filters een periode selecteren.

**Wat zie je?**

Een lijst van alle geregistreerde werkdagen met:

- Datum
- In- en uitkloktijd
- Pauze in minuten
- Totaal gewerkte uren (inclusief overuren)
- Status (In behandeling, Goedgekeurd, Afgewezen, Verwerkt)

**Totalen bovenaan**

Boven de lijst zie je een samenvatting voor de gekozen periode:

- **Totaal uren** in de gekozen periode
- **Overuren**
- **Verwerkt**: Het aantal registraties dat al is doorgegeven aan de boekhouder.

> **Belangrijk:** Gebruik de `/me/hours` pagina vooral voor het overzicht en het toevoegen van losse, niet-geroosterde uren. Het bevestigen of corrigeren van je geplande diensten doe je altijd via **Mijn rooster** (`/me`).

---

### B5. Verlof aanvragen

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

## 6. Team Chat & Roosterregie

De planner bevat een geïntegreerde team chat die is ontworpen voor operationele communicatie en het veilig regelen van diensten.

### 6.1 Wat is de Team Chat?

De Team Chat is een samenwerkingsplatform voor alle medewerkers. Het hoofddoel is niet alleen informeel overleg, maar vooral het **veilig en gecontroleerd overnemen en ruilen van diensten**. Een wijziging in het rooster wordt pas definitief nadat alle betrokken partijen expliciet akkoord zijn gegaan.

### 6.2 De chat gebruiken (voor medewerkers)

Als medewerker gebruik je de chat om te overleggen met collega's en om je rooster flexibel te beheren. De volledige uitleg vind je in hoofdstuk B3.

**Kernfuncties:**

- **Vaste kanalen**: Communiceer in de vier vaste teamkanalen.
- **Diensten delen**: Deel een dienst vanuit je rooster als een interactieve kaart in de chat.
- **Diensten overnemen**: Reageer op een gedeelde dienst van een collega om deze over te nemen.
- **Diensten ruilen**: Stel een ruil voor met een collega.

Alle roosterwijzigingen via de chat worden automatisch verwerkt na tweezijdig akkoord.

### 6.3 Chatbeheer (voor admins)

Beheerders (admins en managers) hebben extra rechten om de chat te beheren, zoals het aanmaken van privégesprekken en het goedkeuren van claims op open diensten. Zie hoofdstuk A8 voor details.

---

## 7. De app installeren op je telefoon

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

## 8. Meldingen (push notificaties)

Als pushnotificaties zijn ingeschakeld, ontvang je een melding wanneer:

- Je bent uitgenodigd voor een open dienst
- Je een verzoek ontvangt om een dienst over te nemen of te ruilen
- De beheerder een bericht stuurt

**Meldingen inschakelen**

Wanneer je de planner voor het eerst opent in de browser, vraagt de browser of je meldingen wilt ontvangen. Klik op **Toestaan**.

> Als je per ongeluk hebt geweigerd, kun je dit aanpassen via de browserinstellingen (klik op het slotje of het informatie-icoon naast het webadres).

**Vereisten**

Pushnotificaties werken alleen als de beheerder VAPID-sleutels heeft ingesteld (zie hoofdstuk 10).

---

## 9. Icons aanpassen

Wil je de icons in de navigatie en op de knoppen vervangen door je eigen ontworpen icons? Dat kan eenvoudig.

**Waar staan de iconbestanden?**

Alle icons staan als SVG-bestanden in de map:

```
public/icons/
```

**Overzicht van alle icons en waar ze voorkomen**

| Bestandsnaam      | Icoon        | Verschijnt op                               |
| ----------------- | ------------ | ------------------------------------------- |
| `logo.svg`        | Logo         | Linksboven in de navigatiebalk              |
| `schedule.svg`    | Rooster      | Navigatie → Rooster (beheerder)             |
| `employees.svg`   | Medewerkers  | Navigatie → Medewerkers                     |
| `leave.svg`       | Verlof       | Navigatie → Verlof (beheerder + medewerker) |
| `hours.svg`       | Uren         | Navigatie → Uren                            |
| `export.svg`      | Export       | Navigatie → Exporteren                      |
| `settings.svg`    | Instellingen | Navigatie → Instellingen                    |
| `my-schedule.svg` | Mijn rooster | Navigatie medewerker → Rooster              |
| `team-view.svg`   | Teamrooster  | Navigatie medewerker → Team                 |
| `chat.svg`        | Team Chat    | Navigatie → Chat                            |
| `close.svg`       | Sluiten / ×  | Modals, annuleerknop                        |
| `prev.svg`        | Pijl links   | Week terug navigatie                        |
| `next.svg`        | Pijl rechts  | Week vooruit navigatie                      |

**Een icon vervangen**

1. Ontwerp je eigen icon als **SVG-bestand** (aanbevolen: 24×24 of vierkant).
2. Vervang het bestaande bestand in `public/icons/` met dezelfde bestandsnaam.
3. Herlaad de pagina — het nieuwe icon verschijnt automatisch overal.

> De icons erven automatisch de kleur van de omliggende tekst. Een actief navigatie-item is oranje (`--brand`), een inactief item is grijs. Zorg dat je SVG geen vaste `fill`-kleur heeft maar gebruikmaakt van de ouderkleur, of gebruik een effen pad zonder kleur.

---

## 10. Technische instellingen (SMTP / e-mail)

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

Iedere gebruiker schakelt push daarna eenmalig in via de knop **Pushmeldingen inschakelen** op de pagina Open diensten. Dit werkt ook voor een adminaccount zonder gekoppelde medewerker.

**Automatische herinneringen voor open diensten**

De Vercel-cronjob controleert dagelijks om 08:00 UTC of diensten langer dan 1,5 week of 2 weken openstaan. Stel in Vercel een lange, willekeurige waarde in:

```
CRON_SECRET=<lange willekeurige geheime waarde>
```

Voer ook de bijbehorende Supabase-migratie uit:

```
supabase/migrations/20260724_open_shift_notes_and_reminders.sql
supabase/migrations/20260725093000_employee_shift_hour_approval.sql
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

## 11. Veelgestelde vragen

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

Nee, niet direct. Medewerkers kunnen hun rooster inzien en via de Team Chat een verzoek indienen om een dienst te ruilen of over te laten nemen. Alleen beheerders en managers kunnen diensten handmatig toevoegen, bewerken of verwijderen.

**Hoe verwijder ik een medewerker volledig?**

Dat kan niet via de app — medewerkers worden alleen gedeactiveerd zodat historische data bewaard blijft. Als volledige verwijdering nodig is, neem dan contact op met de technische beheerder.

**De planner laadt traag op de telefoon.**

Zorg dat de app als PWA geïnstalleerd is (zie hoofdstuk 7). Dit zorgt voor sneller laden en een betere ervaring.

---

_Handboek gegenereerd voor De Notenkar Planner — versie april 2026._
