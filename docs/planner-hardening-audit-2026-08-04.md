# Planner hardening audit — 2026-08-04

## Safety boundary and baseline

- Baseline commit: `a313455af5f0f7a25527b4db0fea2bc9913d06b6` on `master`, equal to `origin/master` before implementation.
- Recovery tag: `snapshot/pre-nondestructive-planner-hardening-20260804`.
- Verified external bundle: `Planner Backups/2026-08-04-pre-hardening/DENOTENMAN-PLANNER-pre-hardening-a313455.bundle`.
- Baseline checks: 135/135 existing tests passed; typecheck and lint passed. The baseline production build compiled but failed during page-data collection because the local production `SECRET_KEY` was absent. A second shared-cache attempt encountered an incomplete `.next` manifest.
- No migration, deployment, commit, push, database write, backfill, cleanup or production change is part of this work.

## Code inventory

### ISO-week and date sources

- The active hardcoded week limit existed in `lib/dateUtils.ts`, `pages/admin/index.tsx`, `pages/me/index.tsx`, `pages/team/[location].tsx` and `pages/admin/view/index.tsx`. The prompt mentioned five pages, but the current checkout contains four affected UI pages. `pages/admin/open-shifts.tsx` already accepts week 53.
- `lib/scheduler.ts` contained the reliable week-count implementation but also duplicated current-week helpers.
- `dateForDayInWeek` existed in `lib/shiftDate.ts` (UTC-safe) and `lib/guardrails.ts` (local-time based).
- The shared source after hardening is `lib/dateUtils.ts`; scheduler re-exports it and guardrails imports `lib/shiftDate.ts`.

### API routes and methods

All browser mutations are covered centrally by `middleware.ts`. Requests with browser metadata require the same origin. Session-bound routes additionally require the `x-csrf-token` header to match the `noten_csrf` cookie. Public login/recovery routes still require the same origin but do not require a pre-existing session token. Requests without browser metadata are classified as server-to-server and must retain their route-specific authentication, such as the cron bearer secret.

| Route | Methods |
| --- | --- |
| `/api/chat` | GET, POST, DELETE |
| `/api/session` | GET |
| `/api/settings` | GET, POST |
| `/api/support-ticket` | POST |
| `/api/admin/backup` | GET, POST, PUT |
| `/api/admin/chat-logs` | GET, DELETE |
| `/api/admin/dashboard-stats`, `/api/admin/insights` | GET |
| `/api/admin/planning-automation` | POST |
| `/api/admin/users` | GET, POST, DELETE |
| `/api/admin/employees/[empId]/documents` | GET, PATCH, DELETE |
| `/api/admin/employees/[empId]/invite` | POST |
| `/api/admin/employees/[empId]/profile` | GET |
| `/api/admin/inspection/impersonate` | POST |
| `/api/admin/team-chat/conversations` | GET, POST, PATCH |
| `/api/admin/team-chat/owners` | POST |
| `/api/auth/change-password`, `/api/auth/login`, `/api/auth/logout` | POST |
| `/api/auth/forgot-password`, `/api/auth/reset-password` | POST |
| `/api/auth/google-complete`, `/api/auth/[...nextauth]` | disabled, always 404 |
| `/api/auth/google-complete-redirect` | disabled, always redirects to `/login` |
| `/api/chat/workflows` | GET, POST, DELETE |
| `/api/cron/open-shift-reminders` | GET with bearer secret |
| `/api/employees` | GET, POST |
| `/api/employees/[id]` | GET, PUT, DELETE |
| `/api/expenses` | GET, POST |
| `/api/expenses/[id]` | GET, PATCH, DELETE |
| `/api/expenses/export` | POST |
| `/api/hours` | GET, POST |
| `/api/hours/[id]` | PUT, PATCH, DELETE |
| `/api/hours/batch` | PATCH |
| `/api/hours/export`, `/api/hours/shift` | POST |
| `/api/inspectie/login`, `/api/inspectie/overzicht`, `/api/inspectie/exit-preview` | POST |
| `/api/inspectie/documenten/inhoud`, `/api/inspectie/documenten/[id]` | POST |
| `/api/leave` | GET, POST |
| `/api/leave/[id]` | PUT |
| `/api/me/profile` | GET, PUT |
| `/api/me/documents` | GET, POST |
| `/api/me/documents/[id]` | GET, DELETE |
| `/api/notifications/subscribe` | GET, POST |
| `/api/shifts` | GET, POST |
| `/api/shifts/[id]` | GET, PUT, PATCH, DELETE |
| `/api/shifts/approve` | PATCH |
| `/api/shifts/claim` | POST, DELETE |
| `/api/shifts/invite` | POST, PATCH |
| `/api/shifts/offer` | POST, DELETE |
| `/api/shifts/open` | GET, POST, PUT, PATCH |
| `/api/team-chat/bootstrap`, `/api/team-chat/gifs`, `/api/team-chat/search` | GET |
| `/api/team-chat/messages` | GET, POST |
| `/api/team-chat/messages/[id]` | PATCH |
| `/api/team-chat/planning-watch` | GET, POST |
| `/api/team-chat/reactions`, `/api/team-chat/read` | POST |
| `/api/team-chat/exchanges`, `/api/team-chat/exchanges/[id]/respond` | POST |

### Authentication and request boundary

- `iron-session` stores an HTTP-only, `SameSite=Lax` session cookie. Login generates `session.csrf`.
- `pages/api/session.ts` now returns the token to authenticated same-origin JavaScript and synchronizes a readable CSRF cookie. No password, service key or other secret is returned.
- `lib/client-fetch.ts` installs one wrapper for existing same-origin API fetches. It caches the session token, adds the header only to mutations, refreshes once after a CSRF rejection and leaves external fetches untouched.
- `middleware.ts` rejects cross-origin browser mutations before route code executes. Login/password-recovery remain compatible without an existing session. Cron/server-to-server callers are not reclassified as browser clients.
- Existing route-level authorization and existing `hasSameOrigin` checks remain in place.

## Database and migrations

### Repository state

- `supabase/migrations` is the executable Supabase CLI history and contains 12 files.
- Root `migrations/` contains three legacy SQL files (`003_backup_log.sql`, `004_profiles_documents.sql`, `005_hour_submissions.sql`). No active CLI configuration pointing to this root folder was found. The folders were not merged, moved or changed.
- `supabase/migrations/20260722_dedupe_employee_locations.sql` contains historical `UPDATE` and `DELETE FROM planner20_employees` statements. It must never be replayed and was not used as a pattern.
- The configured project reference is `mhzmithddcdnouvlklev`. Supabase management/plugin calls for project, migration, advisor and SQL metadata returned `You do not have permission to perform this action`. A later local read-only REST verification confirmed that `SUPABASE_URL` points to `mhzmithddcdnouvlklev.supabase.co` and obtained exact counts through `HEAD` requests only. This confirms live project identity and the count snapshot below, but not RLS, grants, policies or remote migration history.

| Live table | First HEAD count | Repeated HEAD count |
| --- | ---: | ---: |
| `planner20_employees` | 18 | 18 |
| `planner20_shifts` | 492 | 492 |
| `planner20_time_logs` | 36 | 36 |
| `planner20_employee_documents` | 2 | 2 |
| `planner20_open_shift_claims` | 2 | 2 |
| `planner20_expense_claims` | 5 | 5 |
| `planner20_leave_requests` | 18 | 18 |

No row body was downloaded. Only `HEAD` requests were issued, and every repeated count matched. These post-implementation snapshots prove the verification itself did not alter counts; they are not a pre-implementation production snapshot and therefore are not presented as historical proof.

### RLS gate

Static source does not prove RLS policies for `planner20_employees`, `planner20_shifts`, `planner20_time_logs` or `planner20_employee_documents`. All application data access currently runs server-side through the service-role client in `lib/db.ts`; no service-role key is exposed to browser code. Supabase documents that exposed `public` tables should use RLS and that service-role access bypasses it.

No RLS migration was created because live grants, direct clients and policies could not be inventoried. Before any later RLS migration, run read-only queries for `pg_class.relrowsecurity`, `pg_policies`, `information_schema.role_table_grants`, all function ACLs and all consumers. Then test every server path against a branch or confirmed non-production database. Enabling RLS without that proof can silently block unknown clients.

Rollback without deleting data: leave any future additive policies and RLS changes unapplied until branch verification passes. Once production RLS is enabled, rollback must restore the previous grants/policy behavior, not drop tables, columns or rows.

### Additive employee-location design (not applied)

Proposed dormant structure:

```sql
create table if not exists public.planner20_employee_locations (
  employee_id bigint not null references public.planner20_employees(id) on delete restrict,
  location text not null,
  created_at timestamptz not null default now(),
  primary key (employee_id, location)
);

create index if not exists planner20_employee_locations_location_idx
  on public.planner20_employee_locations(location);
```

This does not remove or reinterpret the existing employee `location` column and performs no backfill. A later opt-in phase may dual-write new relationships only after owner approval. Reads must remain on the legacy column until parity is proven. Safe rollback is to stop dual-writing and leave the new table dormant; no rows need to be removed.

### Denormalized employee names (design only)

The five base tables are `planner20_shifts`, `planner20_open_shift_claims`, `planner20_expense_claims`, `planner20_time_logs` and `planner20_leave_requests`. Read/write paths include scheduler, leave, hours/export, expenses/export, open-shift claims, planning automation, inspection, Dave tools, backup import and API routes.

Phased design:

1. Keep every `employee_name` field and existing value unchanged.
2. Inventory which tables already have a trustworthy `employee_id`; add only nullable ID columns where absent.
3. Dual-write IDs for newly created records while retaining name snapshots.
4. Measure null/orphan rates read-only; do not backfill automatically.
5. Prefer ID joins only after parity tests, while keeping name fields as immutable historical display snapshots.

## Deploy and CI inventory

| Target | Build/start | Schema preflight | Cron | Risk |
| --- | --- | --- | --- | --- |
| Vercel | `npm run build`; managed Next start | automatic only when `VERCEL=1` and `VERCEL_ENV=production` | `vercel.json` schedules `/api/cron/open-shift-reminders` daily | lowest current schema-drift risk |
| Netlify | `npm run build`; Next plugin | set `PRODUCTION_SCHEMA_PREFLIGHT=1` in the production context | not configured in repo | can deploy against stale schema until flag and scheduled function are configured |
| Render | `npm install && npm run build`; `npm start` | set `PRODUCTION_SCHEMA_PREFLIGHT=1` on the production service | not configured in `render.yaml` | can deploy against stale schema; no reminder job |
| CNAME/custom domain | `www.notenman.nl`; no build process itself | inherited from actual host | inherited from actual host | DNS file does not prove which target is live |

`scripts/verify-production-schema.mjs` now supports the explicit platform-neutral flag while preserving Vercel behavior. No target, domain, cron or environment variable was activated. CI now runs the existing non-destructive validation job on pull requests to `master` as well as pushes, and includes both old and new tests. CI does not apply migrations or contact production.

## Styling/component inventory

- 38 files contain inline `<style jsx>`.
- Large stateful pages include `pages/admin/hours/index.tsx` (21 `useState` calls), `pages/admin/employees/[id].tsx` and `pages/admin/index.tsx` (18 each).
- `styles/globals.css` already defines the principal colors, spacing, radii, shadows, form controls and shift colors as tokens. Repeated page-local literal values should be mapped to those tokens incrementally, one component at a time, with screenshots at 320, 390, 768 and 1366 pixels before and after.
- No CSS, layout, markup order or component extraction was changed in this task.
- `components/styles_usage.txt` contains only an empty PowerShell table with truncated historical local paths. It has no runtime content and was deliberately retained.

## Other technical findings

- `claude-3-5-sonnet-20241022` is retired on Anthropic's API. The official deprecation history lists 28 October 2025 and recommends `claude-sonnet-4-6`. It was not replaced because model output/tool compatibility has not been regression-tested and the prompt requires explicit configuration before replacement.
- Login, forgot-password and chat rate limits are in-memory maps. On serverless they are per warm instance, disappear on restart and do not provide a global quota. A later shared design should use an explicitly funded store with atomic increment+expiry, hash the IP/user key, fail safely, and preserve separate limits per action. It was not activated because provider, region, retention and cost are unconfirmed.
- Mobile baseline retains local horizontal scrolling for the seven-day strip at 320px. Existing 22–40px action targets are an accessibility risk but were not restyled because this task forbids visual changes.

## Verification results

- `npm test`: 159/159 tests passed (135 existing tests and 24 new core regression tests).
- `npm run test:core`: 24/24 passed separately with `TZ=UTC` and `TZ=Europe/Amsterdam`.
- `npx tsc --noEmit`, `npm run lint` and `git diff --check`: passed.
- A clean isolated `next build` completed successfully after the session-bound CSRF change; the production schema preflight remained deliberately inactive because this was not a production deployment.
- Browser QA at 390x844 and 320x844 confirmed no document-level horizontal overflow, ISO navigation from week 52 to week 53 of 2026 and then week 1 of 2027, and a dynamic copy-week maximum of 53 for 2026.
- An authenticated local browser logout returned HTTP 200 with the global fetch wrapper adding `x-csrf-token`; the middleware validated that value against both the readable CSRF cookie and the value inside the sealed session. Browser console: zero errors and zero warnings.
- Targeted request-security tests additionally prove that token rotation rejects the stale token, the client performs at most one refresh retry without losing a `Request` body, and malformed sealed cookies do not throw inside Edge middleware but remain subject to route authorization.
- No migration, database write, production deploy, commit or push was performed. Two read-only live `HEAD` snapshots returned identical counts for all seven inventoried business tables. RLS, grants, policies and remote migration history remain unverified because metadata access was denied and service-role REST access bypasses RLS.

## Non-destructive verification protocol for future schema work

1. Confirm project ID and environment owner.
2. Export read-only schema metadata and row-count snapshots.
3. Reject SQL containing `DELETE`, `UPDATE`, `TRUNCATE`, `DROP`, destructive `ALTER`, backfills or conflict updates.
4. Apply only to a confirmed branch/test database.
5. Verify old tables, columns and row counts are unchanged; verify new objects separately.
6. Run API, auth, mobile and background-job regression checks.
7. Production application remains a separate owner-approved operation.
