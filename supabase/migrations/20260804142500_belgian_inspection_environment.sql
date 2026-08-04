-- Additive, rerunnable security boundary for Belgian market inspections.
-- Existing employee, roster, account and document rows remain untouched.

alter table public.planner20_employee_documents
  add column if not exists archived_at timestamptz;

alter table public.planner20_employee_documents
  add column if not exists archived_by text;

alter table public.planner20_employee_documents
  add column if not exists inspection_released boolean not null default false;

alter table public.planner20_users
  add column if not exists archived_at timestamptz;

alter table public.planner20_users
  add column if not exists archived_by text;

alter table public.planner20_expense_claims
  add column if not exists archived_at timestamptz;

alter table public.planner20_expense_claims
  add column if not exists archived_by text;

alter table public.planner20_chat_messages
  add column if not exists archived_at timestamptz;

alter table public.planner20_chat_messages
  add column if not exists archived_by text;

create table if not exists public.planner20_inspection_document_state (
  inspector_id text not null,
  document_id bigint not null references public.planner20_employee_documents(id),
  consecutive_views integer not null default 0 check (consecutive_views between 0 and 3),
  last_view_at timestamptz,
  next_allowed_at timestamptz,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (inspector_id, document_id)
);

create table if not exists public.planner20_inspection_document_grants (
  id uuid primary key default gen_random_uuid(),
  inspector_id text not null,
  admin_user_id text,
  document_id bigint not null references public.planner20_employee_documents(id),
  service_number_hash text not null,
  service_number_suffix text not null,
  token_hash text not null unique,
  session_hash text not null,
  integrity_accepted_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists planner20_inspection_grants_actor_created
  on public.planner20_inspection_document_grants (inspector_id, created_at desc);

create table if not exists public.planner20_inspection_events (
  id bigserial primary key,
  inspector_id text not null,
  admin_user_id text,
  document_id bigint references public.planner20_employee_documents(id),
  action text not null,
  reason text,
  service_number_hash text,
  service_number_suffix text,
  integrity_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists planner20_inspection_events_actor_created
  on public.planner20_inspection_events (inspector_id, created_at desc);

create table if not exists public.planner20_inspection_document_release_events (
  id bigserial primary key,
  document_id bigint not null references public.planner20_employee_documents(id),
  released boolean not null,
  actor_user_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists planner20_inspection_release_events_document_created
  on public.planner20_inspection_document_release_events (document_id, created_at desc);

create table if not exists public.planner20_document_storage_reconciliation (
  id bigserial primary key,
  storage_path text not null unique,
  employee_id integer not null references public.planner20_employees(id),
  mime_type text not null,
  file_size bigint not null,
  reason text not null,
  recorded_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create table if not exists public.planner20_inspection_login_attempts (
  id bigserial primary key,
  attempt_key_hash text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists planner20_inspection_login_attempts_recent
  on public.planner20_inspection_login_attempts (attempt_key_hash, created_at desc);

alter table public.planner20_inspection_document_state enable row level security;
alter table public.planner20_inspection_document_grants enable row level security;
alter table public.planner20_inspection_events enable row level security;
alter table public.planner20_inspection_document_release_events enable row level security;
alter table public.planner20_document_storage_reconciliation enable row level security;
alter table public.planner20_inspection_login_attempts enable row level security;

revoke all on table public.planner20_inspection_document_state from public, anon, authenticated;
revoke all on table public.planner20_inspection_document_grants from public, anon, authenticated;
revoke all on table public.planner20_inspection_events from public, anon, authenticated;
revoke all on table public.planner20_inspection_document_release_events from public, anon, authenticated;
revoke all on table public.planner20_document_storage_reconciliation from public, anon, authenticated;
revoke all on table public.planner20_inspection_login_attempts from public, anon, authenticated;
revoke all on table public.planner20_inspection_document_state from service_role;
revoke all on table public.planner20_inspection_document_grants from service_role;
revoke all on table public.planner20_inspection_events from service_role;
revoke all on table public.planner20_inspection_document_release_events from service_role;
revoke all on table public.planner20_document_storage_reconciliation from service_role;
revoke all on table public.planner20_inspection_login_attempts from service_role;
grant select on table public.planner20_inspection_document_state to service_role;
grant select on table public.planner20_inspection_document_grants to service_role;
grant select, insert on table public.planner20_inspection_events to service_role;
grant select on table public.planner20_inspection_document_release_events to service_role;
grant select, insert, update on table public.planner20_document_storage_reconciliation to service_role;
grant select, insert on table public.planner20_inspection_login_attempts to service_role;
grant usage, select on sequence public.planner20_inspection_events_id_seq to service_role;
grant usage, select on sequence public.planner20_inspection_document_release_events_id_seq to service_role;
grant usage, select on sequence public.planner20_document_storage_reconciliation_id_seq to service_role;
grant usage, select on sequence public.planner20_inspection_login_attempts_id_seq to service_role;

create or replace function public.planner20_request_inspection_document_view(
  p_inspector_id text,
  p_admin_user_id text,
  p_document_id bigint,
  p_service_number_hash text,
  p_service_number_suffix text,
  p_token_hash text,
  p_session_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() at time zone 'Europe/Brussels')::date;
  v_day text;
  v_state public.planner20_inspection_document_state%rowtype;
  v_count integer;
  v_blocked_until timestamptz;
  v_grant_id uuid;
begin
  if p_inspector_id is null or length(p_inspector_id) > 160
     or p_service_number_hash is null or length(p_service_number_hash) <> 64
     or p_token_hash is null or length(p_token_hash) <> 64
     or p_session_hash is null or length(p_session_hash) <> 64 then
    return jsonb_build_object('status', 'denied');
  end if;

  if p_admin_user_id is null then
    if not exists (
      select 1 from public.planner20_users u
      where u.username = p_inspector_id and lower(u.role) = 'inspector' and u.archived_at is null
    ) then
      return jsonb_build_object('status', 'denied');
    end if;
  elsif p_inspector_id <> 'inspection-preview:' || p_admin_user_id
     or not exists (
       select 1 from public.planner20_users u
       where u.username = p_admin_user_id and lower(u.role) = 'admin' and u.archived_at is null
     ) then
    return jsonb_build_object('status', 'denied');
  end if;

  v_day := case extract(isodow from v_today)
    when 1 then 'maandag' when 2 then 'dinsdag' when 3 then 'woensdag'
    when 4 then 'donderdag' when 5 then 'vrijdag' when 6 then 'zaterdag'
    else 'zondag' end;

  if not exists (
    select 1
    from public.planner20_employee_documents d
    join public.planner20_employees e on e.id = d.employee_id and e.is_active = 1
    join public.planner20_shifts s on s.employee_id = e.id
    where d.id = p_document_id
      and d.archived_at is null
      and d.inspection_released = true
      and d.doc_type in ('legitimatie', 'arbeidsovereenkomst')
      and s.archived_at is null
      and s.is_open = 0
      and s.location in ('markt', 'both')
      and s.week_number = extract(week from v_today)::integer
      and s.year = extract(isoyear from v_today)::integer
      and lower(s.day_of_week) = v_day
      and s.shift_type not in ('Verlof', 'Vakantie', 'Verzuim')
  ) then
    insert into public.planner20_inspection_events (
      inspector_id, admin_user_id, document_id, action, reason,
      service_number_hash, service_number_suffix, integrity_accepted
    ) values (
      p_inspector_id, p_admin_user_id, p_document_id, 'view_denied', 'not_in_current_market_roster',
      p_service_number_hash, p_service_number_suffix, true
    );
    return jsonb_build_object('status', 'denied');
  end if;

  insert into public.planner20_inspection_document_state (inspector_id, document_id)
  values (p_inspector_id, p_document_id)
  on conflict (inspector_id, document_id) do nothing;

  select * into v_state
  from public.planner20_inspection_document_state
  where inspector_id = p_inspector_id and document_id = p_document_id
  for update;

  if v_state.blocked_until is not null and v_state.blocked_until > v_now then
    insert into public.planner20_inspection_events (
      inspector_id, admin_user_id, document_id, action, reason,
      service_number_hash, service_number_suffix, integrity_accepted
    ) values (
      p_inspector_id, p_admin_user_id, p_document_id, 'view_denied', 'three_hour_lock',
      p_service_number_hash, p_service_number_suffix, true
    );
    return jsonb_build_object('status', 'locked', 'blocked_until', v_state.blocked_until);
  end if;

  if v_state.blocked_until is not null and v_state.blocked_until <= v_now then
    v_state.consecutive_views := 0;
    v_state.blocked_until := null;
    v_state.next_allowed_at := null;
  end if;

  if v_state.next_allowed_at is not null and v_state.next_allowed_at > v_now then
    insert into public.planner20_inspection_events (
      inspector_id, admin_user_id, document_id, action, reason,
      service_number_hash, service_number_suffix, integrity_accepted
    ) values (
      p_inspector_id, p_admin_user_id, p_document_id, 'view_denied', 'ten_second_cooldown',
      p_service_number_hash, p_service_number_suffix, true
    );
    return jsonb_build_object('status', 'cooldown', 'next_allowed_at', v_state.next_allowed_at);
  end if;

  v_count := least(v_state.consecutive_views + 1, 3);
  -- De cooldown begint nadat de maximale kijktijd is verstreken: 5 + 10 sec.
  -- Ook de drie-uursblokkade begint pas na het sluiten van de derde inzage.
  v_blocked_until := case when v_count = 3 then v_now + interval '3 hours 5 seconds' else null end;

  update public.planner20_inspection_document_state
  set consecutive_views = v_count,
      last_view_at = v_now,
      next_allowed_at = v_now + interval '15 seconds',
      blocked_until = v_blocked_until,
      updated_at = v_now
  where inspector_id = p_inspector_id and document_id = p_document_id;

  insert into public.planner20_inspection_document_grants (
    inspector_id, admin_user_id, document_id, service_number_hash,
    service_number_suffix, token_hash, session_hash, integrity_accepted_at,
    expires_at
  ) values (
    p_inspector_id, p_admin_user_id, p_document_id, p_service_number_hash,
    p_service_number_suffix, p_token_hash, p_session_hash, v_now,
    v_now + interval '5 seconds'
  ) returning id into v_grant_id;

  insert into public.planner20_inspection_events (
    inspector_id, admin_user_id, document_id, action, reason,
    service_number_hash, service_number_suffix, integrity_accepted
  ) values (
    p_inspector_id, p_admin_user_id, p_document_id, 'view_granted', null,
    p_service_number_hash, p_service_number_suffix, true
  );

  return jsonb_build_object(
    'status', 'allowed',
    'grant_id', v_grant_id,
    'expires_at', v_now + interval '5 seconds',
    'next_allowed_at', v_now + interval '15 seconds',
    'view_count', v_count,
    'blocked_until', v_blocked_until
  );
end;
$function$;

create or replace function public.planner20_consume_inspection_document_grant(
  p_inspector_id text,
  p_admin_user_id text,
  p_token_hash text,
  p_session_hash text
) returns table (
  storage_path text,
  mime_type text,
  filename text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  with consumed as (
    update public.planner20_inspection_document_grants g
    set consumed_at = clock_timestamp()
    where g.inspector_id = p_inspector_id
      and g.admin_user_id is not distinct from p_admin_user_id
      and (
        (p_admin_user_id is null and exists (
          select 1 from public.planner20_users u
          where u.username = p_inspector_id and lower(u.role) = 'inspector' and u.archived_at is null
        ))
        or
        (p_admin_user_id is not null
          and p_inspector_id = 'inspection-preview:' || p_admin_user_id
          and exists (
            select 1 from public.planner20_users u
            where u.username = p_admin_user_id and lower(u.role) = 'admin' and u.archived_at is null
          ))
      )
      and g.token_hash = p_token_hash
      and g.session_hash = p_session_hash
      and g.consumed_at is null
      and g.expires_at > clock_timestamp()
    returning g.document_id, g.expires_at
  )
  select d.storage_path, d.mime_type, d.filename, c.expires_at
  from consumed c
  join public.planner20_employee_documents d on d.id = c.document_id
  where d.archived_at is null and d.inspection_released = true;
end;
$function$;

create or replace function public.planner20_archive_employee_document(
  p_document_id bigint,
  p_employee_id integer,
  p_actor text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changed integer;
begin
  update public.planner20_employee_documents
  set archived_at = coalesce(archived_at, clock_timestamp()),
      archived_by = coalesce(archived_by, p_actor)
  where id = p_document_id and employee_id = p_employee_id;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$function$;

create or replace function public.planner20_set_document_inspection_release(
  p_document_id bigint,
  p_employee_id integer,
  p_released boolean,
  p_actor text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changed integer;
begin
  update public.planner20_employee_documents
  set inspection_released = p_released
  where id = p_document_id
    and employee_id = p_employee_id
    and archived_at is null
    and doc_type in ('legitimatie', 'arbeidsovereenkomst')
    and inspection_released is distinct from p_released;
  get diagnostics v_changed = row_count;
  if v_changed > 0 then
    insert into public.planner20_inspection_document_release_events (
      document_id, released, actor_user_id
    ) values (p_document_id, p_released, p_actor);
  end if;
  return v_changed > 0 or exists (
    select 1 from public.planner20_employee_documents
    where id = p_document_id and employee_id = p_employee_id
      and archived_at is null
      and doc_type in ('legitimatie', 'arbeidsovereenkomst')
      and inspection_released = p_released
  );
end;
$function$;

create or replace function public.planner20_archive_user_account(
  p_username text,
  p_actor text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changed integer;
begin
  update public.planner20_users
  set archived_at = coalesce(archived_at, clock_timestamp()),
      archived_by = coalesce(archived_by, p_actor)
  where username = p_username;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$function$;

create or replace function public.planner20_archive_expense_claim(
  p_claim_id bigint,
  p_actor text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changed integer;
begin
  update public.planner20_expense_claims
  set archived_at = coalesce(archived_at, clock_timestamp()),
      archived_by = coalesce(archived_by, p_actor)
  where id = p_claim_id;
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$function$;

revoke all on function public.planner20_request_inspection_document_view(text, text, bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function public.planner20_consume_inspection_document_grant(text, text, text, text) from public, anon, authenticated;
revoke all on function public.planner20_archive_employee_document(bigint, integer, text) from public, anon, authenticated;
revoke all on function public.planner20_set_document_inspection_release(bigint, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.planner20_archive_user_account(text, text) from public, anon, authenticated;
revoke all on function public.planner20_archive_expense_claim(bigint, text) from public, anon, authenticated;
grant execute on function public.planner20_request_inspection_document_view(text, text, bigint, text, text, text, text) to service_role;
grant execute on function public.planner20_consume_inspection_document_grant(text, text, text, text) to service_role;
grant execute on function public.planner20_archive_employee_document(bigint, integer, text) to service_role;
grant execute on function public.planner20_set_document_inspection_release(bigint, integer, boolean, text) to service_role;
grant execute on function public.planner20_archive_user_account(text, text) to service_role;
grant execute on function public.planner20_archive_expense_claim(bigint, text) to service_role;
