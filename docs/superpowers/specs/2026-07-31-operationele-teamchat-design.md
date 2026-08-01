# Operationele teamchat en roosterregie

Datum: 2026-07-31  
Status: goedgekeurd  
Doel: een mobiele, productieklare samenwerkingslaag waarin medewerkers veilig over diensten overleggen en een gecontroleerde tweezijdige afspraak direct doorwerkt in het rooster.

## 1. Productdoel

De chat is geen losse messenger. Chat en planning vormen samen één operationele workflow:

- medewerkers lezen en schrijven in vaste teamkanalen en door beheer aangemaakte gesprekken;
- diensten kunnen als gestructureerde kaart worden getagd en gedeeld;
- medewerkers kunnen een dienst claimen, overnemen of tegen een andere dienst ruilen;
- een wijziging wordt pas uitgevoerd nadat de twee vereiste partijen expliciet akkoord zijn;
- de planning valideert de afspraak opnieuw en wijzigt daarna uitsluitend de bezetting;
- datum, week, dag, diensttype, begin- en eindtijd, pauze en locatie blijven altijd ongewijzigd;
- iedere stap blijft als append-only auditspoor beschikbaar.

De bestaande AI-supportchat (`/api/chat`, `planner20_chat_messages`) blijft een afzonderlijk product en wordt niet hergebruikt als medewerkerschat.

## 2. Vaste kanalen en beheerde gesprekken

Er zijn exact vier vaste, organisatiebrede kanalen. De namen en interpunctie worden letterlijk overgenomen:

1. `Nootities`
2. `Nootzakelijk`
3. `The Nootorious`
4. `NOOTSCHAP!!`

Alle actieve accounts kunnen deze kanalen lezen en erin schrijven. Medewerkers kunnen geen kanaal, privégesprek of groepsgesprek aanmaken en kunnen de ledenlijst niet wijzigen.

Het adminportaal krijgt Chatbeheer. Alleen:

- een gebruiker met de bestaande applicatierol `admin`; of
- een gebruiker die door een admin expliciet als chat-`owner` is aangewezen

kan een privégesprek of groepsgesprek aanmaken, leden beheren, een gesprek archiveren of opnieuw activeren. Archiveren verbergt een gesprek uit de actieve lijst maar verwijdert geen berichten, reacties, leden of auditgegevens. De vier vaste kanalen kunnen niet worden verwijderd of gearchiveerd.

De live database heeft momenteel twee admins en geen afzonderlijke owner-rol. Daarom wordt owner als additieve chatbeheerbevoegdheid gemodelleerd; bestaande authenticatierollen hoeven niet te worden gewijzigd.

## 3. Kernflows

### 3.1 Dienst taggen

De medewerker kiest `Dienst taggen` in de composer of opent Chat vanuit een roosterkaart. De chat slaat een gestructureerde koppeling op naar het onveranderlijke shift-ID. De kaart toont dag, datum, tijd, locatie, diensttype, huidige bezetting en actuele status. Vrije tekst bevat nooit de enige koppeling naar een dienst.

### 3.2 Dienst delen

Een dienstkaart kan naar een van de vier kanalen of naar een beheerd gesprek worden gedeeld. Delen verandert het rooster niet. De kaart krijgt operationele acties op basis van de actuele gebruiker en status.

### 3.3 Dienst claimen of overnemen

1. De kandidaat kiest `Ik kan deze overnemen`.
2. De server maakt idempotent een overnameverzoek met een snapshot en assignment-versie van de dienst.
3. De kandidaat geldt als eerste akkoord.
4. De huidige medewerker ontvangt in Chat en via push een verzoek om akkoord of afwijzing.
5. Bij een onbezette dienst geeft een admin of chat-owner het tweede akkoord namens de planning.
6. Na het tweede akkoord valideert de server opnieuw eigenaarschap, actieve accounts, verlof, overlap, roosterconflicten en de oorspronkelijke dienstversie.
7. Alleen wanneer alle controles slagen wordt de medewerker atomair vervangen en verschijnt een systeembevestiging in de chat.

### 3.4 Twee diensten ruilen

1. Medewerker A kiest een eigen toekomstige dienst en de collega met wie die wil ruilen.
2. Medewerker B kiest een eigen toekomstige dienst of wijst het verzoek af.
3. Beide medewerkers zien exact welke twee onveranderlijke diensten van bezetting wisselen.
4. Na beide expliciete akkoorden worden beide diensten in één databasetransactie vergrendeld en opnieuw gevalideerd.
5. De server wisselt uitsluitend `employee_id` en `employee_name`, verhoogt de interne assignment-versie en sluit bij een overname alleen de bijbehorende interne open-/uitnodigingsstatus af.
6. Als één snapshot, bezetting of guardrail niet meer klopt, verandert geen enkele dienst. Het verzoek krijgt status `conflict` met een begrijpelijke herstelactie.

### 3.5 Intelligente planningregie

De chat bevat een deterministische Planningwacht. Deze gebruikt gestructureerde diensttags, bestaande guardrails en expliciete acties; vrije tekst of een taalmodel mag nooit zelfstandig het rooster muteren.

De Planningwacht kan:

- Nederlandse intenties zoals ruilen, overnemen, delen en hulp vragen herkennen;
- een veilige actiekaart voorstellen en de relevante getagde dienst vooraf invullen;
- open diensten, wachtende reacties, conflicten en bijna verlopen verzoeken signaleren;
- bij onderbezetting of een oude open dienst het passende kanaal activeren met een systeemkaart;
- planningwijzigingen terugschrijven als systeembericht met correlatie-ID;
- medewerkers vanuit een systeemkaart rechtstreeks naar de juiste roosterweek brengen;
- verouderde acties blokkeren en de nieuwste roosterstatus ophalen.

Een herkenning is alleen een voorstel. Iedere mutatie vereist een knopactie, servervalidatie en de voorgeschreven twee akkoorden.

## 4. Berichten en interacties

Ondersteund:

- tekstberichten tot 2.000 tekens;
- antwoorden op één specifiek bericht;
- `@`-vermeldingen van medewerkers;
- emoji-picker en emoji-reacties;
- GIF-picker via een server-side providerproxy met veilige contentrating;
- bewerken van een eigen tekstbericht met append-only revisiehistorie en label `bewerkt`;
- ongelezen aantallen en per-gesprek leespositie;
- zoeken binnen toegankelijke gesprekken;
- optimistische verzending met `bezig`, `verzonden` en `opnieuw proberen`;
- systeemkaarten voor roosteracties en statusovergangen.

Niet ondersteund:

- door medewerkers aangemaakte gesprekken;
- permanent verwijderen van berichten of gesprekken;
- bestandsuploads;
- audio- of videoberichten;
- bellen of vergaderen;
- automatisch plannen op basis van alleen vrije tekst.

GIF-zoekresultaten worden niet rechtstreeks vanuit de browser opgehaald. De serverproxy verbergt de providerkey, dwingt een veilige rating af, accepteert alleen HTTPS-mediahosts van de gekozen provider en slaat alleen provider-ID, bron-URL en weergaveverhouding op. Er is lokaal nog geen GIF-providerkey geconfigureerd; de implementatie krijgt daarom een duidelijke providerconfiguratie en healthcheck voordat productie als volledig gereed kan gelden.

## 5. Mobile-first ervaring

### Mobiel

- Chat wordt een primaire actie in een compacte mobiele navigatie.
- De bestaande overvolle balk wordt teruggebracht tot vijf hoofdingangen; overige functies komen in een toegankelijke `Meer`-sheet.
- De chat start met kanaal- en gesprekkenlijst, zoekveld, ongelezen badges en planningstatus.
- Een gesprek opent schermvullend met duidelijke terugknop en behouden scrollpositie.
- De composer blijft boven toetsenbord en safe area staan en heeft bediening van minimaal 44 bij 44 pixels.
- Emoji, GIF, vermelding en diensttag openen compacte bottom sheets, geen geneste modals.
- Een roosteractie gebruikt een stap-voor-stap sheet: dienst, tegenpartij, controle, akkoord.
- Nieuwe berichten onderbreken lezen niet; een knop `Nieuwe berichten` brengt de gebruiker gecontroleerd naar beneden.
- Offline, trage verbinding, verlopen actie, dubbel akkoord en conflict krijgen afzonderlijke herstelbare staten.

### Tablet en desktop

- Vanaf tabletbreedte staat de gesprekkenlijst links en het actieve gesprek rechts.
- Op brede schermen kan optioneel een details- en planningpaneel openen zonder het berichtverloop te bedekken.
- Dezelfde componenten, rechten en statemachine blijven leidend; desktop is geen afzonderlijk product.

### Toegankelijkheid

- semantische navigatie, headings en berichtlog;
- zichtbare toetsenbordfocus en logische focusvolgorde;
- Enter verstuurt, Shift+Enter maakt een nieuwe regel;
- state changes via `aria-live` zonder ieder binnenkomend bericht opdringerig uit te spreken;
- kleur is nooit de enige statusdrager;
- reduced-motion ondersteuning;
- dynamische tekst en 320px reflow zonder horizontale pagina-overloop.

## 6. Technische architectuur

De app gebruikt custom iron-session-auth en de Supabase service-role uitsluitend op de server. Directe browserabonnementen op Supabase Realtime zouden zonder Supabase Auth/JWT geen betrouwbare lidmaatschapsautorisatie hebben. Daarom gebruikt de eerste productieversie:

- Next.js Pages Router API-routes;
- server-side sessie- en lidmaatschapscontrole op iedere aanvraag;
- incrementele cursor-sync met korte polling zolang het gesprek zichtbaar is;
- lagere frequentie bij inactiviteit en pauze bij een verborgen tab;
- onmiddellijke refresh bij focus, online-status en na een eigen mutatie;
- pushmeldingen via de bestaande web-push infrastructuur.

Dit is veilig binnen de huidige architectuur en degradeert voorspelbaar op Vercel. De API retourneert alleen nieuwe of gewijzigde records na de laatste cursor en zet `Cache-Control: private, no-store`.

Firebase wordt niet toegevoegd: de repository heeft geen Firebase-configuratie, actief Firebase-project of Firebase-auth, terwijl Supabase al de operationele bron is. Een tweede realtime datastore zou dubbele waarheid en extra synchronisatierisico creëren.

## 7. Additief datamodel

Nieuwe tabellen, allemaal met `CREATE TABLE IF NOT EXISTS`, RLS en zonder publieke policies:

- `planner20_team_conversations`
  - type `channel`, `direct` of `group`;
  - vaste slug voor de vier kanalen;
  - naam, omschrijving, status, eigenaar en timestamps.
- `planner20_team_conversation_members`
  - gesprek, `user_id`, optioneel `employee_id`, lidrol, notificatievoorkeur en timestamps;
  - unieke combinatie gesprek/gebruiker.
- `planner20_team_chat_managers`
  - expliciete ownerbevoegdheid naast de bestaande adminrol.
- `planner20_team_messages`
  - berichttype, tekst/GIF-data, afzender, reply-ID, client-idempotencykey en timestamps.
- `planner20_team_message_revisions`
  - append-only oude en nieuwe tekst bij iedere bewerking.
- `planner20_team_message_reactions`
  - unieke emoji per bericht/gebruiker.
- `planner20_team_message_shift_links`
  - gestructureerde koppeling tussen bericht en dienst met snapshotvelden.
- `planner20_team_read_positions`
  - laatste gelezen bericht en tijd per gesprek/gebruiker.
- `planner20_shift_exchange_requests`
  - claim/overname/ruil, betrokken diensten en medewerkers, snapshots, status en verloopdatum.
- `planner20_shift_exchange_approvals`
  - append-only akkoord of afwijzing per vereiste partij.
- `planner20_planning_chat_events`
  - append-only correlatie- en auditlog voor chat-naar-planning en planning-naar-chat.

Aan `planner20_shifts` wordt alleen `assignment_version integer not null default 0` toegevoegd met `ADD COLUMN IF NOT EXISTS`.

Foreign keys gebruiken `ON DELETE RESTRICT` of `SET NULL` waar historische leesbaarheid dat vereist. De migratie bevat geen `DELETE`, `TRUNCATE`, `DROP` of overschrijvende backfill. De vier kanalen worden met vaste sleutels en `ON CONFLICT DO NOTHING` ingevoerd.

## 8. Autorisatie en beveiliging

- Alle teamchattabellen hebben RLS ingeschakeld.
- `anon` en `authenticated` krijgen geen directe tabeltoegang; alleen server-side service-role code benadert de data.
- Iedere API-route vereist een geldige iron-session.
- Iedere read/write controleert gespreklidmaatschap of chatbeheerbevoegdheid.
- Alleen admin of chat-owner kan gesprekken en leden beheren.
- Alleen de afzender kan een tekstbericht bewerken; historie blijft bestaan.
- Berichtinhoud, zoektermen, GIF-URL's en IDs worden gevalideerd en begrensd.
- Mutaties gebruiken een client-idempotencykey en rate limiting.
- Pushmeldingen bevatten minimale tekst en geen gevoelige roostercontext op het vergrendelscherm.
- De atomaire overdrachtsfunctie is `SECURITY INVOKER`, heeft een vaste `search_path`, is ingetrokken voor `PUBLIC`, `anon` en `authenticated`, en wordt uitsluitend aan `service_role` toegekend.

## 9. Planningintegriteit

Voor iedere overdracht worden minimaal deze invarianten gecontroleerd:

- beide gesprekspartijen zijn nog actief en hebben het vereiste akkoord gegeven;
- de huidige shiftbezetting en assignment-versie zijn gelijk aan de snapshot;
- beide shift-ID's bestaan en zijn verschillend bij een ruil;
- betrokken diensten zijn nog toekomstig en niet al door een andere request afgerond;
- de nieuwe medewerker heeft geen overlappende dienst of goedgekeurd verlof;
- datum, week, jaar, dag, diensttype, tijden, pauze en locatie blijven byte-voor-byte gelijk;
- een request kan hoogstens één keer de status `completed` bereiken;
- een mislukking wijzigt nul diensten;
- iedere succesvolle wijziging heeft exact één audit-event en een systeembericht.

De live voorcontrole vond geen verweesde shift- of userrelaties en geen ongeldige locaties. Er bestaat wel één dubbele genormaliseerde medewerkernaam. Daarom worden autorisatie, leden, vermeldingen en overdrachten uitsluitend op IDs uitgevoerd; de UI toont locatie/context om gelijke namen te onderscheiden.

## 10. API-oppervlak

- `GET /api/team-chat/bootstrap`
- `GET|POST /api/team-chat/conversations`
- `GET|PATCH /api/team-chat/conversations/[id]`
- `POST|PATCH /api/team-chat/conversations/[id]/members`
- `GET|POST /api/team-chat/conversations/[id]/messages`
- `PATCH /api/team-chat/messages/[id]`
- `POST /api/team-chat/messages/[id]/reactions`
- `POST /api/team-chat/read`
- `GET /api/team-chat/search`
- `GET /api/team-chat/gifs`
- `POST /api/team-chat/shifts/share`
- `POST /api/team-chat/exchanges`
- `POST /api/team-chat/exchanges/[id]/respond`
- `GET /api/team-chat/planning-watch`
- `GET|POST|PATCH /api/admin/team-chat/*`

Foutresponses gebruiken één contract met code, gebruikersboodschap, herstelbaarheid en actuele serverstatus. Conflicten retourneren HTTP 409 en nooit een gedeeltelijk gewijzigde planning.

## 11. Beheerportaal

Chatbeheer biedt:

- overzicht van vaste kanalen en beheerde gesprekken;
- privé- of groepsgesprek aanmaken;
- leden zoeken en selecteren op stabiel account/medewerker-ID;
- één of meer owners aanwijzen;
- omschrijving en notificatiebeleid beheren;
- gesprek archiveren/reactiveren;
- auditstatus en mislukte planningkoppelingen inzien;
- GIF-providerconfiguratie testen zonder keys in de browser te tonen.

Er is nergens een verwijderactie voor chatdata.

## 12. Verificatie en acceptatie

### Geautomatiseerd

- TypeScript `tsc --noEmit`;
- Next lint;
- productiebuild en Vercel-buildcompatibiliteit;
- unitchecks voor validatie, intentieherkenning en statusovergangen;
- integratiechecks voor lidmaatschap, idempotency en 403/409-responses;
- SQL-integriteitschecks voor primaire sleutels, uniekheid, foreign keys, toegestane statussen en orphan records;
- vóór/na-query die bewijst dat een overdracht alleen bezettingsvelden en assignment-versie veranderde;
- migratiescan die destructieve SQL blokkeert.

### Browserflow

Minimaal te verifiëren op 320px, 375px, 768px en desktop:

1. medewerker opent elk vast kanaal;
2. medewerker verstuurt tekst, emoji, GIF en antwoord;
3. medewerker tagt en deelt een dienst;
4. tweede medewerker claimt of accepteert een ruil;
5. eerste medewerker geeft tweede akkoord;
6. beide chatclients tonen de systeembevestiging;
7. rooster toont direct de nieuwe bezetting met ongewijzigde tijd en locatie;
8. conflict- en dubbele-submitflow veranderen het rooster niet;
9. medewerker kan geen gesprek aanmaken;
10. admin/owner kan via beheer een gesprek en leden beheren zonder data te verwijderen.

De product-audit wordt op deze werkende flow uitgevoerd met actuele screenshots per stap. Daarna doen de mobile-first developer en quality-auditor een afzonderlijke eindcontrole op reflow, toetsenbord, focus, contrast, statuscommunicatie, performance en autorisatie.

## 13. Rollout

1. Code en migratie lokaal bouwen en statisch verifiëren.
2. Additieve migratie vooraf scannen op verboden SQL.
3. Bestaande tabel- en rijaantallen vastleggen.
4. Migratie eenmaal toepassen via Supabase zodra de projecttoegang dit toestaat.
5. Schema, RLS, functies, advisors en behoud van bestaande data verifiëren.
6. Chatflow met testaccounts uitvoeren.
7. Vercel-readiness en productieomgevingvariabelen controleren.
8. Alleen na expliciet deployverzoek publiceren.

## 14. Bekende externe randvoorwaarde

De Supabase appconnector kan documentatie lezen maar heeft in deze sessie geen projectdatabasepermissie. Read-only kwaliteitsmetingen via de reeds geconfigureerde serververbinding werken wel. Het toepassen van DDL gebeurt pas wanneer de connector of een andere veilige migratieroute aantoonbaar toegang heeft.

Voor doorzoekbare GIFs is een productiekey van een gekozen provider nodig. De key wordt uitsluitend server-side ingesteld; zonder zo'n key kan de implementatie wel emoji's en de volledige chat/roosterflow leveren, maar niet eerlijk als volledig productieklare GIF-zoekfunctie worden afgetekend.
