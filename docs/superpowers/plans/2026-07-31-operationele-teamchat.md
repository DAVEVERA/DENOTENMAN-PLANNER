# Operationele Teamchat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een productieklare, mobile-first teamchat met vier vaste kanalen en gecontroleerde tweezijdige dienstoverdracht die alleen de roosterbezetting atomair wijzigt.

**Architecture:** De browser praat uitsluitend met nieuwe Next.js Pages Router API-routes onder `/api/team-chat`; alle Supabase-toegang blijft server-side achter de bestaande iron-session. Berichten synchroniseren incrementeel met cursors en adaptieve polling. Een additieve Postgres-migratie bewaart chatdata append-only en rondt een claim of ruil af via een vergrendelde `SECURITY INVOKER`-functie die alle roosterinvarianten opnieuw controleert.

**Tech Stack:** Next.js 14 Pages Router, React 18, TypeScript 5, CSS Modules, Supabase Postgres, iron-session, web-push, lucide-react, Node test runner via `tsx@4.23.1`.

## Global Constraints

- Bestaande productiegegevens mogen nooit worden verwijderd; geen `DELETE`, `TRUNCATE`, `DROP`, database-reset of destructieve schemawijziging.
- Migraties zijn additief en herhaalbaar met `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` en uitsluitend ontbrekende backfills.
- Exacte vaste kanalen: `Nootities`, `Nootzakelijk`, `The Nootorious`, `NOOTSCHAP!!`.
- Medewerkers maken geen kanaal, privégesprek of groepsgesprek aan; alleen bestaande admins of expliciete chat-owners beheren gesprekken via het adminportaal.
- Geen permanent verwijderen van berichten of gesprekken; archiveren en revisiehistorie behouden data.
- Geen bestandsuploads, audio, video of bellen.
- Vrije tekst of intentieherkenning mag nooit zelfstandig het rooster wijzigen.
- Claim/overname/ruil vereist twee expliciete akkoorden en een laatste servervalidatie.
- Alleen bezettingsvelden en `assignment_version` mogen door de overdracht wijzigen; datum, week, dag, diensttype, begin/eindtijd, pauze en locatie blijven gelijk.
- Identiteit en autorisatie gebruiken `user_id`/`employee_id`, nooit een naam als sleutel.
- Alle nieuwe publieke-schema tabellen krijgen RLS; `anon` en `authenticated` krijgen geen directe toegang.
- De Supabase service-role key blijft server-only en verschijnt nooit in clientcode, logs of responses.
- Firebase wordt niet geïnitialiseerd of als tweede databron toegevoegd.
- Bestaande onafgemaakte urenwijzigingen in de dirty worktree blijven intact.
- Werk zonder git-commits; de gebruiker heeft implementatie goedgekeurd maar geen commits gevraagd.
- Elke gedragswijziging volgt RED → GREEN → REFACTOR; configuratie en zuivere SQL krijgen statische validatie plus integratiechecks.

---

## File Map

### Nieuw domein en tests

- `types/team-chat.ts` — gedeelde chat-, bericht-, roosteractie- en API-contracten.
- `lib/team-chat/constants.ts` — vaste kanaaldefinities, limieten, statussen en pollingwaarden.
- `lib/team-chat/validation.ts` — body-, ID-, emoji-, GIF- en exchangevalidatie.
- `lib/team-chat/permissions.ts` — admin/owner/lid/autorisatiebeslissingen.
- `lib/team-chat/repository.ts` — alle server-side chatqueries en append-only writes.
- `lib/team-chat/exchanges.ts` — requestcreatie, guardrails en RPC-responsafhandeling.
- `lib/team-chat/planning-watch.ts` — deterministische Nederlandse intenties en roostertriggers.
- `lib/team-chat/gifs.ts` — server-side GIPHY-provideradapter en URL-allowlist.
- `tests/team-chat/domain.test.ts` — pure validatie, intenties en autorisatie.
- `tests/team-chat/exchanges.test.ts` — overdrachtsinput, invarianten en conflictgedrag.
- `tests/team-chat/migration.test.ts` — destructieve-SQL-scan, exacte kanaalseeds en vereiste RLS/functiecontracten.

### Nieuwe API-routes

- `pages/api/team-chat/bootstrap.ts`
- `pages/api/team-chat/messages.ts`
- `pages/api/team-chat/messages/[id].ts`
- `pages/api/team-chat/reactions.ts`
- `pages/api/team-chat/read.ts`
- `pages/api/team-chat/search.ts`
- `pages/api/team-chat/gifs.ts`
- `pages/api/team-chat/exchanges/index.ts`
- `pages/api/team-chat/exchanges/[id]/respond.ts`
- `pages/api/team-chat/planning-watch.ts`
- `pages/api/admin/team-chat/conversations.ts`
- `pages/api/admin/team-chat/owners.ts`

### Nieuwe UI

- `pages/me/chat.tsx` — SSR-authenticated chatroute.
- `pages/admin/team-chat.tsx` — SSR-authenticated beheerroute.
- `components/team-chat/ChatWorkspace.tsx` — schermcompositie en selectie.
- `components/team-chat/useTeamChat.ts` — cursor-sync, optimistic state, retries en visibility lifecycle.
- `components/team-chat/ConversationList.tsx` — kanalen/gesprekken, zoeken en ongelezen badges.
- `components/team-chat/MessageTimeline.tsx` — gegroepeerde berichten, replies en systeemkaarten.
- `components/team-chat/ChatComposer.tsx` — tekst, emoji, GIF, mention en diensttag.
- `components/team-chat/ShiftMessageCard.tsx` — onveranderlijke shiftweergave en contextuele acties.
- `components/team-chat/ExchangeSheet.tsx` — claim/overname/ruil en tweezijdige status.
- `components/team-chat/PlanningWatchPanel.tsx` — slimme voorstellen en waarschuwingen.
- `components/team-chat/AdminChatManager.tsx` — beheerde gesprekken, leden en owners.
- `components/team-chat/TeamChat.module.css` — mobile-first layout en responsive states.
- `components/layout/MobileMoreNav.tsx` — gedeelde vijf-item navigatie met toegankelijke Meer-sheet.

### Bestaande bestanden

- `components/layout/TeamLayout.tsx` — Chat als primaire desktop/mobile bestemming.
- `components/layout/AdminLayout.tsx` — Chatbeheer en compacte mobiele adminnavigatie.
- `components/ui/Icons.tsx` — chat-, emoji-, GIF-, mention- en diensticonen uit lucide-react.
- `types/index.ts` — exporteer teamchattypes zonder bestaande urentypes te wijzigen.
- `package.json`, `package-lock.json` — `test:chat` en gepinde `tsx@4.23.1`.
- `supabase/schema.sql` — additieve canonieke teamchatschema-sectie.
- `supabase/migrations/<cli-generated>_operational_team_chat.sql` — uitvoerbare migratie.
- `vercel.json` — alleen indien bestaande configuratie veilig kan worden uitgebreid met Planningwacht-cron; geen deploywijziging zonder expliciet deployverzoek.

---

### Task 1: Testharnas en domeincontracten

**Files:**
- Create: `types/team-chat.ts`
- Create: `lib/team-chat/constants.ts`
- Create: `lib/team-chat/validation.ts`
- Create: `lib/team-chat/permissions.ts`
- Create: `tests/team-chat/domain.test.ts`
- Modify: `types/index.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces:

```ts
export type TeamConversationKind = 'channel' | 'direct' | 'group'
export type TeamMessageType = 'text' | 'gif' | 'shift' | 'system'
export type ShiftExchangeKind = 'takeover' | 'swap'
export type ShiftExchangeStatus = 'pending' | 'declined' | 'completed' | 'conflict' | 'expired' | 'cancelled'

export interface TeamConversationSummary {
  id: number
  kind: TeamConversationKind
  slug: string | null
  name: string
  description: string
  fixed: boolean
  member_count: number
  unread_count: number
  last_message_at: string | null
  archived_at: string | null
}

export interface CreateMessageInput {
  conversation_id: number
  client_nonce: string
  body?: string
  reply_to_id?: number
  shift_id?: number
  gif?: { provider: 'giphy'; id: string; url: string; width: number; height: number }
}

export function validateCreateMessage(input: unknown): CreateMessageInput
export function validateExchangeInput(input: unknown): CreateExchangeInput
export function detectPlanningIntent(body: string): PlanningIntent[]
export function canManageTeamChat(user: SessionUser, isExplicitOwner: boolean): boolean
```

- [ ] **Step 1: Installeer het gepinde testharnas**

Run: `npm.cmd install --save-dev --save-exact tsx@4.23.1`

Voeg script toe:

```json
"test:chat": "tsx --test tests/team-chat/*.test.ts"
```

- [ ] **Step 2: Schrijf falende contracttests**

Test minimaal:

```ts
test('accepts the four exact fixed channel names', () => {
  assert.deepEqual(FIXED_TEAM_CHANNELS.map(item => item.name), [
    'Nootities', 'Nootzakelijk', 'The Nootorious', 'NOOTSCHAP!!',
  ])
})

test('rejects a message without text gif or shift', () => {
  assert.throws(() => validateCreateMessage({ conversation_id: 1, client_nonce: crypto.randomUUID() }))
})

test('employees cannot manage conversations', () => {
  assert.equal(canManageTeamChat(employeeSession, false), false)
})

test('explicit owners can manage conversations', () => {
  assert.equal(canManageTeamChat(employeeSession, true), true)
})
```

- [ ] **Step 3: Verifieer RED**

Run: `npm.cmd run test:chat`

Expected: FAIL omdat constants, validators en permissions nog ontbreken.

- [ ] **Step 4: Implementeer minimale types, constants en validators**

Gebruik exact:

```ts
export const TEAM_CHAT_MAX_MESSAGE_LENGTH = 2_000
export const TEAM_CHAT_PAGE_SIZE = 50
export const TEAM_CHAT_ACTIVE_POLL_MS = 2_000
export const TEAM_CHAT_IDLE_POLL_MS = 15_000
```

Valideer positieve gehele IDs, UUID-clientnonce, maximaal één contenttype per bericht, alleen HTTPS-GIF URLs en emoji van maximaal 16 Unicode-codepoints.

- [ ] **Step 5: Verifieer GREEN en regressies**

Run: `npm.cmd run test:chat`

Expected: alle Task 1-tests PASS.

Run: `npx.cmd tsc --noEmit`

Expected: exit 0 zonder nieuwe diagnostics.

- [ ] **Step 6: Review zonder commit**

Run: `git diff -- package.json package-lock.json types/index.ts types/team-chat.ts lib/team-chat tests/team-chat`

Controleer dat bestaande urenwijzigingen in `types/index.ts` behouden zijn.

---

### Task 2: Additieve databasebasis en migratieguard

**Files:**
- Create: `tests/team-chat/migration.test.ts`
- Create: `supabase/migrations/<cli-generated>_operational_team_chat.sql`
- Modify: `supabase/schema.sql`

**Interfaces:**

- Produces tabellen met prefix `planner20_team_`, `planner20_shift_exchange_*`, `planner20_planning_chat_events`.
- Produces RPC:

```sql
planner20_respond_to_shift_exchange(
  p_request_id uuid,
  p_user_id text,
  p_employee_id integer,
  p_decision text
) returns jsonb
```

- [ ] **Step 1: Ontdek de Supabase CLI en maak de migratie via de CLI**

Run: `npx.cmd supabase --help`

Run: `npx.cmd supabase migration new operational_team_chat`

Gebruik uitsluitend het door de CLI aangemaakte pad.

- [ ] **Step 2: Schrijf falende migratiecontracttests**

Lees de migratie als tekst en assert:

```ts
assert.doesNotMatch(sql, /\b(delete\s+from|truncate|drop\s+(table|column|schema)|alter\s+table[^;]+drop)\b/i)
assert.match(sql, /Nootities/)
assert.match(sql, /Nootzakelijk/)
assert.match(sql, /The Nootorious/)
assert.match(sql, /NOOTSCHAP!!/)
assert.match(sql, /enable row level security/gi)
assert.match(sql, /revoke all on function planner20_respond_to_shift_exchange/i)
assert.match(sql, /grant execute on function planner20_respond_to_shift_exchange[^;]+service_role/i)
```

- [ ] **Step 3: Verifieer RED**

Run: `npm.cmd run test:chat`

Expected: migratiecontract faalt omdat tabellen/RPC/seeds ontbreken.

- [ ] **Step 4: Schrijf additieve DDL**

Maak de tabellen uit de File Map met:

```sql
create table if not exists ...;
create index if not exists ...;
alter table ... enable row level security;
revoke all on table ... from anon, authenticated;
grant select, insert, update on table ... to service_role;
```

Gebruik `ON DELETE RESTRICT` voor berichten, reacties, shiftlinks, approvals en audit-events. Seed kanalen en bestaande leden/managers alleen met `ON CONFLICT DO NOTHING`.

Voeg veilig toe:

```sql
alter table planner20_shifts
  add column if not exists assignment_version integer not null default 0;
```

- [ ] **Step 5: Implementeer de vergrendelde overdrachts-RPC**

De functie:

```sql
create or replace function planner20_respond_to_shift_exchange(...)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
```

moet request en betrokken shifts `FOR UPDATE` lezen, de actor tegen `initiator_user_id`/`counterparty_user_id` valideren, approval idempotent invoegen, bij afwijzing alleen status wijzigen, en pas bij twee akkoorden beide assignments in één transactie bijwerken. Controleer assignment-version, huidige employee-ID, overlap en goedgekeurd verlof. Retourneer `{status, completed, source_shift_id, target_shift_id, error_code}`.

- [ ] **Step 6: Spiegel de definitieve DDL additief in `supabase/schema.sql`**

Append een afgebakende `-- Operational team chat` sectie; wijzig of verwijder bestaande uren- of roostersecties niet.

- [ ] **Step 7: Verifieer GREEN en destructieve scan**

Run: `npm.cmd run test:chat`

Run:

```powershell
rg -n -i "delete\s+from|truncate|drop\s+(table|column|schema)|alter\s+table.*drop" supabase/migrations/*operational_team_chat.sql
```

Expected: geen verboden statements; tests PASS.

---

### Task 3: Server-side repository, membership en bootstrap

**Files:**
- Create: `lib/team-chat/repository.ts`
- Create: `pages/api/team-chat/bootstrap.ts`
- Extend: `tests/team-chat/domain.test.ts`

**Interfaces:**

```ts
export async function isTeamChatOwner(userId: string): Promise<boolean>
export async function requireConversationMember(conversationId: number, userId: string): Promise<TeamConversationMember>
export async function ensureFixedChannelMemberships(user: SessionUser): Promise<void>
export async function getChatBootstrap(user: SessionUser): Promise<TeamChatBootstrap>
export async function listMessages(input: { conversationId: number; userId: string; afterId?: number; beforeId?: number }): Promise<TeamMessage[]>
export async function createMessage(user: SessionUser, input: CreateMessageInput): Promise<TeamMessage>
```

- [ ] **Step 1: Schrijf falende repositorycontracttests met geïnjecteerde query-adapter**

Bewijs dat membership vóór message reads wordt gecontroleerd, fixed-channel inserts `ON CONFLICT`-equivalent idempotent zijn en een duplicate `client_nonce` hetzelfde bericht teruggeeft.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer repository met één Supabase-boundary**

Alle queries gebruiken `getSupabase()` en `T()`. Sla `sender_display_name` als snapshot op, maar gebruik alleen IDs voor rechten. Bootstrap levert gebruiker, gesprekken, ledenmetadata, ongelezen aantallen, actuele planningwatch-samenvatting en servercursor.

- [ ] **Step 4: Implementeer authenticated bootstrap-route**

Contract:

```ts
if (!session.user) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
res.setHeader('Cache-Control', 'private, no-store')
return res.json({ success: true, data: await getChatBootstrap(session.user) })
```

- [ ] **Step 5: Verifieer tests en typecheck**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

---

### Task 4: Berichten, reactions, read state, search en GIF-provider

**Files:**
- Create: `lib/team-chat/gifs.ts`
- Create: `pages/api/team-chat/messages.ts`
- Create: `pages/api/team-chat/messages/[id].ts`
- Create: `pages/api/team-chat/reactions.ts`
- Create: `pages/api/team-chat/read.ts`
- Create: `pages/api/team-chat/search.ts`
- Create: `pages/api/team-chat/gifs.ts`
- Extend: `tests/team-chat/domain.test.ts`

**Interfaces:**

```ts
export async function searchGifs(query: string): Promise<GifResult[]>
export function isAllowedGifUrl(url: string): boolean
```

- [ ] **Step 1: Schrijf falende tests voor cursor, editrevisie, reaction-idempotency en GIF-hosts**

Test dat `media.giphy.com` en `media0.giphy.com` HTTPS worden geaccepteerd, andere hosts en HTTP worden geweigerd; editing bewaart een revision; dezelfde emoji van dezelfde gebruiker toggelt naar `inactive_at` in plaats van een rij te verwijderen.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer message APIs**

GET ondersteunt `conversation_id`, `after_id`, `before_id`, limiet 50. POST accepteert exact één contenttype. PATCH schrijft eerst de vorige body naar revisions en werkt daarna body/`edited_at` bij. Geen route accepteert DELETE.

- [ ] **Step 4: Implementeer reactions, read state en search**

Search gebruikt getrimde query van 2–80 tekens, alleen gesprekken waarvan de gebruiker lid is, maximaal 50 resultaten en escapet PostgREST wildcardtekens. Read state mag alleen vooruit bewegen.

- [ ] **Step 5: Implementeer GIPHY-proxy**

Gebruik alleen `process.env.GIPHY_API_KEY`, `rating=pg`, `lang=nl`, limiet 24 en een 503 `GIF_PROVIDER_UNCONFIGURED` zonder key. Retourneer nooit de key of de ruwe providerresponse.

- [ ] **Step 6: Verifieer**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

---

### Task 5: Claim-, overname- en ruilorkestratie

**Files:**
- Create: `lib/team-chat/exchanges.ts`
- Create: `pages/api/team-chat/exchanges/index.ts`
- Create: `pages/api/team-chat/exchanges/[id]/respond.ts`
- Create: `tests/team-chat/exchanges.test.ts`

**Interfaces:**

```ts
export async function createShiftExchange(user: SessionUser, input: CreateExchangeInput): Promise<ShiftExchangeRequest>
export async function respondToShiftExchange(user: SessionUser, requestId: string, decision: 'accepted' | 'declined'): Promise<ExchangeResponse>
```

- [ ] **Step 1: Schrijf falende exchange-tests**

Test takeover zonder eigen employee-ID, takeover van eigen dienst, swap zonder target, swap met dezelfde shift, niet-eigen source, afwezige counterparty, verlopen request, duplicate submit en RPC-conflict.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer requestcreatie**

Lees shifts en medewerkers vers, maak snapshots van alle onveranderlijke velden, resolve counterpart op user-ID, voer bestaande `validateShiftAssignment` guardrails uit en maak request + initiator approval + planning event + system message idempotent aan.

- [ ] **Step 4: Implementeer responseflow via RPC**

Controleer sessiepartij en conversation membership, roep `planner20_respond_to_shift_exchange` aan en map RPC-codes naar 200/409/403. Bij `completed` stuur push naar beide partijen en schrijf één correlated systeembericht. Pushfouten mogen de afgeronde transactie niet terugdraaien maar worden als audit-event vastgelegd.

- [ ] **Step 5: Verifieer GREEN en typecheck**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

---

### Task 6: Planningwacht en planning-naar-chat triggers

**Files:**
- Create: `lib/team-chat/planning-watch.ts`
- Create: `pages/api/team-chat/planning-watch.ts`
- Extend: `tests/team-chat/domain.test.ts`

**Interfaces:**

```ts
export type PlanningIntent =
  | { kind: 'share_shift'; shiftId: number | null; confidence: number }
  | { kind: 'takeover_shift'; shiftId: number | null; confidence: number }
  | { kind: 'swap_shift'; shiftId: number | null; confidence: number }
  | { kind: 'request_help'; shiftId: number | null; confidence: number }

export async function getPlanningWatch(user: SessionUser): Promise<PlanningWatchItem[]>
```

- [ ] **Step 1: Schrijf falende intentie- en trigger-tests**

Voorbeelden: `Wie kan #dienst-123 overnemen?`, `Ik wil dienst 123 ruilen`, `kan iemand helpen` en gewone tekst zonder intentie. Een shift-ID mag alleen uit een expliciete diensttag of gestructureerd `shift_id` komen.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer deterministische interpreter**

Normaliseer Nederlands, herken werkwoordfamilies en geef alleen voorstellen terug. Geen function call in deze module mag `planner20_shifts` muteren.

- [ ] **Step 4: Implementeer Planningwacht-feed**

Combineer toegankelijke open diensten, pending exchanges, verlopen/conflict requests en bestaande `lib/insights.ts`/`lib/guardrails.ts` signalen. Geef actionable cards met route, shift-ID en veilige CTA terug.

- [ ] **Step 5: Verifieer**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

---

### Task 7: Mobile-first chatworkspace

**Files:**
- Create: `pages/me/chat.tsx`
- Create: `components/team-chat/useTeamChat.ts`
- Create: `components/team-chat/ChatWorkspace.tsx`
- Create: `components/team-chat/ConversationList.tsx`
- Create: `components/team-chat/MessageTimeline.tsx`
- Create: `components/team-chat/ChatComposer.tsx`
- Create: `components/team-chat/ShiftMessageCard.tsx`
- Create: `components/team-chat/ExchangeSheet.tsx`
- Create: `components/team-chat/PlanningWatchPanel.tsx`
- Create: `components/team-chat/TeamChat.module.css`

**Interfaces:**

```ts
export interface UseTeamChatResult {
  bootstrap: TeamChatBootstrap | null
  activeConversationId: number | null
  messages: TeamMessage[]
  connectionState: 'loading' | 'online' | 'offline' | 'error'
  sendMessage(input: CreateMessageInput): Promise<void>
  retryMessage(clientNonce: string): Promise<void>
  selectConversation(id: number): void
  markRead(messageId: number): Promise<void>
}
```

- [ ] **Step 1: Maak eerst componentgedrag controleerbaar**

Voeg pure reducer-tests toe voor optimistic message lifecycle, deduplicatie op `client_nonce`, cursor merge en niet-automatisch scrollen wanneer de gebruiker omhoog heeft gescrold.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer hook en sync lifecycle**

Poll iedere 2.000 ms wanneer zichtbaar/actief, 15.000 ms bij idle, stop bij hidden/offline, refresh onmiddellijk bij focus/online en abort stale requests. Merge op message-ID en nonce.

- [ ] **Step 4: Bouw de mobiele compositie**

320–767px: lijstscherm of volledig gespreksscherm; sticky header; composer boven toetsenbord/safe area; bottom sheets voor emoji/GIF/diensttag; `Nieuwe berichten` knop. Minimaal 44px targets.

- [ ] **Step 5: Bouw tablet/desktop compositie**

Vanaf 768px twee kolommen; vanaf 1180px optioneel Planningwacht-paneel. Geen horizontale paginascroll.

- [ ] **Step 6: Bouw message- en shiftacties**

Groepeer afzender/tijd, toon edited/reply/reactions, system cards en shift snapshots. ExchangeSheet toont altijd de immutable velden en beide partijen vóór akkoord.

- [ ] **Step 7: Verifieer tests, typecheck en lint**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

Run: `npm.cmd run lint`

---

### Task 8: Navigatie en roosterweving

**Files:**
- Create: `components/layout/MobileMoreNav.tsx`
- Modify: `components/layout/TeamLayout.tsx`
- Modify: `components/layout/AdminLayout.tsx`
- Modify: `components/ui/Icons.tsx`
- Modify: `pages/me/index.tsx`
- Modify: `pages/me/open-shifts.tsx`
- Modify: `pages/team/[location].tsx`

**Interfaces:**

```ts
export interface MobileNavItem {
  href?: string
  label: string
  icon: React.ReactNode
  active: boolean
  onSelect?: () => void
}
```

- [ ] **Step 1: Schrijf reducer/focus tests voor Meer-sheet**

Test openen, Escape sluiten, focus terug naar trigger en maximaal vijf primaire items.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer vijf-item mobiele navigatie**

Team: `Rooster`, `Mijn rooster`, `Chat`, `Open diensten`, `Meer`. Admin: `Dashboard`, `Rooster`, `Medewerkers`, `Chatbeheer`, `Meer`. Secondary links blijven bereikbaar via sheet.

- [ ] **Step 4: Voeg chatentry aan roosters toe**

Iedere shiftkaart krijgt een toegankelijke `Bespreek`-actie die `/me/chat?shift=<id>` opent. Bestaande urenkaart-click blijft dominant voor afgeronde diensten; de chatactie stopt event propagation en overschrijft de urenflow niet.

- [ ] **Step 5: Verifieer typecheck/lint en diff van dirty files**

Run: `npx.cmd tsc --noEmit`

Run: `npm.cmd run lint`

Run: `git diff -- pages/me/index.tsx pages/me/open-shifts.tsx components/layout/TeamLayout.tsx components/layout/AdminLayout.tsx`

Controleer expliciet dat urenmodal, push en bestaande open-dienstlogica behouden zijn.

---

### Task 9: Admin Chatbeheer

**Files:**
- Create: `pages/admin/team-chat.tsx`
- Create: `components/team-chat/AdminChatManager.tsx`
- Create: `pages/api/admin/team-chat/conversations.ts`
- Create: `pages/api/admin/team-chat/owners.ts`
- Extend: `tests/team-chat/domain.test.ts`

**Interfaces:**

```ts
export interface ManagedConversationInput {
  id?: number
  kind: 'direct' | 'group'
  name: string
  member_user_ids: string[]
  owner_user_ids: string[]
  archived: boolean
}
```

- [ ] **Step 1: Schrijf falende autorisatie- en validatietests**

Test employee 403, owner toegestaan, fixed kanaal niet archiveerbaar, direct exact twee leden, group minimaal twee leden en archiveren zonder data-delete.

- [ ] **Step 2: Verifieer RED**

Run: `npm.cmd run test:chat`

- [ ] **Step 3: Implementeer admin APIs**

Gebruik `canManageTeamChat`; create/update leden met upserts en `inactive_at` voor verwijderde membership, nooit DELETE. Owner grants zijn append-only/soft inactive.

- [ ] **Step 4: Bouw mobiel beheerportaal**

Gebruik zoekbare member picker op `user_id`/`employee_id`, disambigueer gelijke namen met locatie, toon vaste kanalen read-only en bied create/archive/reactivate voor direct/group.

- [ ] **Step 5: Verifieer**

Run: `npm.cmd run test:chat`

Run: `npx.cmd tsc --noEmit`

Run: `npm.cmd run lint`

---

### Task 10: Migratie, data-quality bewijs en volledige productaudit

**Files:**
- Modify: `.codex/ralph-loop.local.md`
- Modify: `TODO.md`
- Create: `.codex/audits/team-chat-2026-07-31/*`

**Interfaces:**

- Consumes alle eerdere taken.
- Produces migratiebewijs, browser screenshots, auditnotities en finale verificatieresultaten.

- [ ] **Step 1: Volledige lokale verificatie**

Run in volgorde:

```powershell
npm.cmd run test:chat
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Iedere command moet exit 0 geven voordat de volgende status als geslaagd wordt gemarkeerd.

- [ ] **Step 2: Leg pre-migratiebewijzen vast**

Query alleen aggregaten: row counts van bestaande kern-tabellen, user-role counts, orphan user/employee/shift FKs, duplicate normalized employee names en maximaal bestaande shift assignment-versies.

- [ ] **Step 3: Pas migratie toe via veilige route**

Gebruik de Supabase app `apply_migration` wanneer projectpermissie beschikbaar is. Als de connector opnieuw permission denied geeft, gebruik geen omweg die rechten omzeilt; rapporteer de blocker en laat live DDL unapplied.

- [ ] **Step 4: Verifieer schema en databehoud**

Controleer nieuwe tabellen, RLS, grants, exacte vier seeds, RPC execute-grant, geen orphan records en exact gelijke pre/post counts voor alle bestaande tabellen. Run security/performance advisors.

- [ ] **Step 5: Test de echte flow met twee sessies**

Verifieer tekst, emoji, reply, GIF/configstate, shift tag/share, takeover, beide akkoorden, roosterrefresh, duplicate response en conflictrollback. Bewijs met voor/na-query dat alleen `employee_id`, `employee_name`, interne open-status en `assignment_version` veranderden.

- [ ] **Step 6: Capture product-audit screenshots**

Bewaar en inspecteer actuele screenshots voor minstens:

```text
01-mobile-inbox-320.png
02-mobile-channel-375.png
03-shift-tag-sheet-375.png
04-exchange-review-375.png
05-exchange-completed-375.png
06-admin-chat-manager-768.png
07-desktop-chat-1440.png
```

Noteer per stap UX-sterktes, problemen, accessibility-risico's en bewijsbeperkingen.

- [ ] **Step 7: Laat mobile-first-developer en quality-auditor reviewen**

Mobile review: 320/375/768, safe areas, keyboard, touch targets, scroll en reflow. Quality review: auth, API contracts, SQL-integriteit, performance, a11y, cross-browser safety en specdekking. Los alle Critical/Important bevindingen op en herhaal gerichte checks.

- [ ] **Step 8: Vercel-readiness zonder ongeautoriseerde deploy**

Controleer link/config, productie-envnamen (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GIPHY_API_KEY`, VAPID/cron secrets) en buildcompatibiliteit. Publiceer niets zonder expliciet deployverzoek.

- [ ] **Step 9: Werk Ralph-ledger af**

Markeer alleen complete criteria met vers bewijs. `ALL_TASKS_COMPLETE: true` mag uitsluitend wanneer code, migratie, echte tweesessieflow en audits aantoonbaar slagen; anders blijft de exacte externe blocker open.

---

## Self-Review Result

- Spec coverage: alle veertien ontwerpsecties zijn gekoppeld aan Tasks 1–10.
- Placeholder scan: geen `TBD`, `TODO`, `implement later` of onbenoemde error-handlingstappen.
- Type consistency: conversation/message/exchange types en function signatures zijn één keer gedefinieerd en worden door latere taken hergebruikt.
- Scope: Firebase, uploads, audio/video, calls en medewerker-created chats zijn expliciet uitgesloten.
- Safety: migratie, live apply, row-count bewijs en transactionele roosterinvarianten zijn afzonderlijke gates.
- Git: voorbeeld-commitstappen uit de generieke skill zijn bewust vervangen door diffreviews omdat de gebruiker geen commits heeft gevraagd en de worktree bestaande wijzigingen bevat.
