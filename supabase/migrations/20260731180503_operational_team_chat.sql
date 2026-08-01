-- Operational team chat
-- Additive, rerunnable schema for server-side team chat and guarded shift exchanges.

alter table public.planner20_shifts
  add column if not exists assignment_version integer not null default 0;

do $assignment_version_constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner20_shifts_assignment_version_nonnegative'
      and conrelid = 'public.planner20_shifts'::regclass
  ) then
    alter table public.planner20_shifts
      add constraint planner20_shifts_assignment_version_nonnegative
      check (assignment_version >= 0) not valid;
  end if;
end
$assignment_version_constraint$;

create or replace function public.planner20_lock_planning_write()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $planning_write_lock$
begin
  perform pg_catalog.pg_advisory_xact_lock(20420, 0);
  return null;
end
$planning_write_lock$;

create or replace function public.planner20_guard_shift_assignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $shift_assignment_guard$
begin
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.employee_id is distinct from OLD.employee_id
       or NEW.employee_name is distinct from OLD.employee_name then
      NEW.assignment_version := OLD.assignment_version + 1;
    elsif NEW.assignment_version < OLD.assignment_version then
      raise exception 'assignment_version cannot decrease';
    end if;
  end if;

  return NEW;
end
$shift_assignment_guard$;

create or replace function public.planner20_validate_shift_assignment_statement()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $shift_assignment_statement_validator$
begin
  if exists (
    select 1
    from new_rows as changed_shift
    join public.planner20_shifts as existing_shift
      on existing_shift.employee_id = changed_shift.employee_id
     and existing_shift.id <> changed_shift.id
     and existing_shift.week_number = changed_shift.week_number
     and existing_shift.year = changed_shift.year
     and existing_shift.day_of_week = changed_shift.day_of_week
    where changed_shift.employee_id is not null
      and lower(trim(changed_shift.shift_type)) not in ('verlof', 'vakantie', 'verzuim')
      and lower(trim(existing_shift.shift_type)) not in ('verlof', 'vakantie', 'verzuim')
      and (
        existing_shift.full_day = 1
        or changed_shift.full_day = 1
        or existing_shift.start_time is null
        or existing_shift.end_time is null
        or changed_shift.start_time is null
        or changed_shift.end_time is null
        or (
          existing_shift.start_time < changed_shift.end_time
          and existing_shift.end_time > changed_shift.start_time
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'planner20_shift_overlap';
  end if;

  if exists (
    select 1
    from new_rows as changed_shift
    join public.planner20_leave_requests as leave_request
      on leave_request.employee_id = changed_shift.employee_id
     and leave_request.status = 'approved'
    where changed_shift.employee_id is not null
      and lower(trim(changed_shift.shift_type)) not in ('verlof', 'vakantie', 'verzuim')
      and case lower(changed_shift.day_of_week)
        when 'maandag' then 1
        when 'dinsdag' then 2
        when 'woensdag' then 3
        when 'donderdag' then 4
        when 'vrijdag' then 5
        when 'zaterdag' then 6
        when 'zondag' then 7
        else null
      end is not null
      and to_date(
        format(
          '%s-%s-%s',
          changed_shift.year,
          lpad(changed_shift.week_number::text, 2, '0'),
          case lower(changed_shift.day_of_week)
            when 'maandag' then 1
            when 'dinsdag' then 2
            when 'woensdag' then 3
            when 'donderdag' then 4
            when 'vrijdag' then 5
            when 'zaterdag' then 6
            when 'zondag' then 7
          end
        ),
        'IYYY-IW-ID'
      ) between leave_request.start_date and leave_request.end_date
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'planner20_shift_approved_leave';
  end if;

  return null;
end
$shift_assignment_statement_validator$;

do $shifts_statement_lock_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_lock_shifts_statement_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_shifts'
  ) then
    create trigger planner20_lock_shifts_statement_trigger
      before insert or update or delete on public.planner20_shifts
      for each statement
      execute function public.planner20_lock_planning_write();
  end if;
end
$shifts_statement_lock_trigger$;

do $leave_statement_lock_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_lock_leave_requests_statement_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_leave_requests'
  ) then
    create trigger planner20_lock_leave_requests_statement_trigger
      before insert or update or delete on public.planner20_leave_requests
      for each statement
      execute function public.planner20_lock_planning_write();
  end if;
end
$leave_statement_lock_trigger$;

do $shift_assignment_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_guard_shift_assignment_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_shifts'
  ) then
    create trigger planner20_guard_shift_assignment_trigger
      before insert or update or delete on public.planner20_shifts
      for each row
      execute function public.planner20_guard_shift_assignment();
  end if;
end
$shift_assignment_trigger$;

do $shift_assignment_insert_statement_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_validate_shift_assignment_insert_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_shifts'
  ) then
    create trigger planner20_validate_shift_assignment_insert_trigger
      after insert on public.planner20_shifts
      referencing new table as new_rows
      for each statement
      execute function public.planner20_validate_shift_assignment_statement();
  end if;
end
$shift_assignment_insert_statement_trigger$;

do $shift_assignment_update_statement_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_validate_shift_assignment_update_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_shifts'
  ) then
    create trigger planner20_validate_shift_assignment_update_trigger
      after update on public.planner20_shifts
      referencing new table as new_rows
      for each statement
      execute function public.planner20_validate_shift_assignment_statement();
  end if;
end
$shift_assignment_update_statement_trigger$;

revoke all on function public.planner20_lock_planning_write()
  from PUBLIC, anon, authenticated, service_role;
revoke all on function public.planner20_guard_shift_assignment()
  from PUBLIC, anon, authenticated, service_role;
revoke all on function public.planner20_validate_shift_assignment_statement()
  from PUBLIC, anon, authenticated, service_role;

create table if not exists public.planner20_team_conversations (
  id                 bigserial primary key,
  kind               text not null,
  slug               text,
  name               text not null,
  description        text not null default '',
  is_fixed           boolean not null default false,
  status             text not null default 'active',
  owner_user_id      text,
  created_by_user_id text,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint planner20_team_conversations_kind_check
    check (kind in ('channel', 'direct', 'group')),
  constraint planner20_team_conversations_status_check
    check (status in ('active', 'archived')),
  constraint planner20_team_conversations_slug_key unique (slug),
  constraint planner20_team_conversations_owner_fkey
    foreign key (owner_user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_team_conversations_created_by_fkey
    foreign key (created_by_user_id) references public.planner20_users(username) on delete restrict
);

create or replace function public.planner20_guard_team_conversation_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $team_conversation_identity_guard$
begin
  if TG_OP = 'DELETE' then
    if OLD.slug in ('nootities', 'nootzakelijk', 'the-nootorious', 'nootschap') then
      raise exception using
        errcode = 'P0001',
        message = 'planner20_fixed_channel_immutable';
    end if;

    return OLD;
  end if;

  if TG_OP = 'UPDATE' then
    if (
      OLD.slug = 'nootities'
      and (
        NEW.slug = 'nootities'
        and NEW.name = 'Nootities'
        and NEW.kind = 'channel'
        and NEW.is_fixed = true
        and NEW.status = 'active'
        and NEW.archived_at is null
      ) is not true
    ) or (
      OLD.slug = 'nootzakelijk'
      and (
        NEW.slug = 'nootzakelijk'
        and NEW.name = 'Nootzakelijk'
        and NEW.kind = 'channel'
        and NEW.is_fixed = true
        and NEW.status = 'active'
        and NEW.archived_at is null
      ) is not true
    ) or (
      OLD.slug = 'the-nootorious'
      and (
        NEW.slug = 'the-nootorious'
        and NEW.name = 'The Nootorious'
        and NEW.kind = 'channel'
        and NEW.is_fixed = true
        and NEW.status = 'active'
        and NEW.archived_at is null
      ) is not true
    ) or (
      OLD.slug = 'nootschap'
      and (
        NEW.slug = 'nootschap'
        and NEW.name = 'NOOTSCHAP!!'
        and NEW.kind = 'channel'
        and NEW.is_fixed = true
        and NEW.status = 'active'
        and NEW.archived_at is null
      ) is not true
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'planner20_fixed_channel_immutable';
    end if;
  end if;

  if NEW.kind = 'channel' then
    if (
      NEW.is_fixed = true
      and NEW.status = 'active'
      and NEW.archived_at is null
      and (
        (NEW.slug = 'nootities' and NEW.name = 'Nootities')
        or (NEW.slug = 'nootzakelijk' and NEW.name = 'Nootzakelijk')
        or (NEW.slug = 'the-nootorious' and NEW.name = 'The Nootorious')
        or (NEW.slug = 'nootschap' and NEW.name = 'NOOTSCHAP!!')
      )
    ) is not true then
      raise exception using
        errcode = 'P0001',
        message = 'planner20_invalid_conversation_identity';
    end if;
  elsif NEW.kind in ('direct', 'group') then
    if not (NEW.is_fixed = false and NEW.slug is null) then
      raise exception using
        errcode = 'P0001',
        message = 'planner20_invalid_conversation_identity';
    end if;
  else
    raise exception using
      errcode = 'P0001',
      message = 'planner20_invalid_conversation_identity';
  end if;

  return NEW;
end
$team_conversation_identity_guard$;

do $team_conversation_identity_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_guard_team_conversation_identity_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_team_conversations'
  ) then
    create trigger planner20_guard_team_conversation_identity_trigger
      before insert or update or delete on public.planner20_team_conversations
      for each row
      execute function public.planner20_guard_team_conversation_identity();
  end if;
end
$team_conversation_identity_trigger$;

revoke all on function public.planner20_guard_team_conversation_identity()
  from PUBLIC, anon, authenticated, service_role;

create table if not exists public.planner20_team_conversation_members (
  id                      bigserial primary key,
  conversation_id         bigint not null,
  user_id                 text not null,
  employee_id             integer,
  member_role             text not null default 'member',
  notification_preference text not null default 'all',
  inactive_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint planner20_team_conversation_members_role_check
    check (member_role in ('member', 'owner')),
  constraint planner20_team_conversation_members_notifications_check
    check (notification_preference in ('all', 'mentions', 'muted')),
  constraint planner20_team_conversation_members_unique unique (conversation_id, user_id),
  constraint planner20_team_conversation_members_conversation_fkey
    foreign key (conversation_id) references public.planner20_team_conversations(id) on delete restrict,
  constraint planner20_team_conversation_members_user_fkey
    foreign key (user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_team_conversation_members_employee_fkey
    foreign key (employee_id) references public.planner20_employees(id) on delete restrict
);

create table if not exists public.planner20_team_chat_managers (
  id                 bigserial primary key,
  user_id            text not null,
  granted_by_user_id text not null,
  inactive_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint planner20_team_chat_managers_user_key unique (user_id),
  constraint planner20_team_chat_managers_user_fkey
    foreign key (user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_team_chat_managers_granted_by_fkey
    foreign key (granted_by_user_id) references public.planner20_users(username) on delete restrict
);

create table if not exists public.planner20_team_messages (
  id                   bigserial primary key,
  conversation_id      bigint not null,
  message_type         text not null,
  body                 text,
  gif_provider         text,
  gif_provider_id      text,
  gif_url              text,
  gif_width            integer,
  gif_height           integer,
  sender_user_id       text,
  sender_employee_id   integer,
  sender_display_name  text not null,
  reply_to_message_id  bigint,
  client_nonce         uuid not null default gen_random_uuid(),
  system_event_key     uuid,
  edited_at            timestamptz,
  created_at           timestamptz not null default now(),
  constraint planner20_team_messages_type_check
    check (message_type in ('text', 'gif', 'shift', 'system')),
  constraint planner20_team_messages_body_length_check
    check (body is null or char_length(body) between 1 and 2000),
  constraint planner20_team_messages_gif_check
    check (
      message_type <> 'gif'
      or (
        gif_provider = 'giphy'
        and gif_provider_id is not null
        and gif_url ~ '^https://'
        and gif_width > 0
        and gif_height > 0
      )
    ),
  constraint planner20_team_messages_sender_nonce_key unique (sender_user_id, client_nonce),
  constraint planner20_team_messages_system_event_key unique (system_event_key),
  constraint planner20_team_messages_conversation_fkey
    foreign key (conversation_id) references public.planner20_team_conversations(id) on delete restrict,
  constraint planner20_team_messages_sender_user_fkey
    foreign key (sender_user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_team_messages_sender_employee_fkey
    foreign key (sender_employee_id) references public.planner20_employees(id) on delete restrict,
  constraint planner20_team_messages_reply_fkey
    foreign key (reply_to_message_id) references public.planner20_team_messages(id) on delete restrict
);

create table if not exists public.planner20_team_message_revisions (
  id             bigserial primary key,
  message_id     bigint not null,
  editor_user_id text not null,
  previous_body  text not null,
  new_body       text not null,
  created_at     timestamptz not null default now(),
  constraint planner20_team_message_revisions_previous_length_check
    check (char_length(previous_body) between 1 and 2000),
  constraint planner20_team_message_revisions_new_length_check
    check (char_length(new_body) between 1 and 2000),
  constraint planner20_team_message_revisions_message_fkey
    foreign key (message_id) references public.planner20_team_messages(id) on delete restrict,
  constraint planner20_team_message_revisions_editor_fkey
    foreign key (editor_user_id) references public.planner20_users(username) on delete restrict
);

create table if not exists public.planner20_team_message_reactions (
  id          bigserial primary key,
  message_id  bigint not null,
  user_id     text not null,
  emoji       text not null,
  inactive_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint planner20_team_message_reactions_emoji_check
    check (char_length(emoji) between 1 and 64),
  constraint planner20_team_message_reactions_unique unique (message_id, user_id, emoji),
  constraint planner20_team_message_reactions_message_fkey
    foreign key (message_id) references public.planner20_team_messages(id) on delete restrict,
  constraint planner20_team_message_reactions_user_fkey
    foreign key (user_id) references public.planner20_users(username) on delete restrict
);

create table if not exists public.planner20_team_message_shift_links (
  id                       bigserial primary key,
  message_id               bigint not null,
  shift_id                 integer not null,
  snapshot_employee_id     integer,
  snapshot_employee_name   text not null,
  snapshot_week_number     smallint not null,
  snapshot_year            smallint not null,
  snapshot_day_of_week     text not null,
  snapshot_shift_type      text not null,
  snapshot_start_time      time,
  snapshot_end_time        time,
  snapshot_full_day        smallint not null default 0,
  snapshot_break_minutes   integer not null default 0,
  snapshot_location        text not null,
  snapshot_assignment_version integer not null,
  created_at               timestamptz not null default now(),
  constraint planner20_team_message_shift_links_message_key unique (message_id),
  constraint planner20_team_message_shift_links_version_check
    check (snapshot_assignment_version >= 0),
  constraint planner20_team_message_shift_links_break_check
    check (snapshot_break_minutes >= 0),
  constraint planner20_team_message_shift_links_message_fkey
    foreign key (message_id) references public.planner20_team_messages(id) on delete restrict,
  constraint planner20_team_message_shift_links_shift_fkey
    foreign key (shift_id) references public.planner20_shifts(id) on delete restrict,
  constraint planner20_team_message_shift_links_employee_fkey
    foreign key (snapshot_employee_id) references public.planner20_employees(id) on delete restrict
);

create table if not exists public.planner20_team_read_positions (
  id                   bigserial primary key,
  conversation_id      bigint not null,
  user_id              text not null,
  last_read_message_id bigint,
  last_read_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint planner20_team_read_positions_unique unique (conversation_id, user_id),
  constraint planner20_team_read_positions_conversation_fkey
    foreign key (conversation_id) references public.planner20_team_conversations(id) on delete restrict,
  constraint planner20_team_read_positions_user_fkey
    foreign key (user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_team_read_positions_message_fkey
    foreign key (last_read_message_id) references public.planner20_team_messages(id) on delete restrict
);

do $team_messages_conversation_identity_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'planner20_team_messages_conversation_id_id_key'
      and conrelid = 'public.planner20_team_messages'::regclass
  ) then
    alter table public.planner20_team_messages
      add constraint planner20_team_messages_conversation_id_id_key
      unique (conversation_id, id);
  end if;
end
$team_messages_conversation_identity_constraint$;

do $team_read_positions_conversation_message_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'planner20_team_read_positions_conversation_message_fkey'
      and conrelid = 'public.planner20_team_read_positions'::regclass
  ) then
    alter table public.planner20_team_read_positions
      add constraint planner20_team_read_positions_conversation_message_fkey
      foreign key (conversation_id, last_read_message_id)
      references public.planner20_team_messages(conversation_id, id)
      on delete restrict
      not valid;
  end if;
end
$team_read_positions_conversation_message_constraint$;

create table if not exists public.planner20_shift_exchange_requests (
  id                        uuid primary key default gen_random_uuid(),
  conversation_id           bigint not null,
  client_nonce              uuid not null default gen_random_uuid(),
  kind                      text not null,
  status                    text not null default 'pending',
  source_shift_id           integer not null,
  target_shift_id           integer,
  initiator_user_id         text not null,
  initiator_employee_id     integer,
  counterparty_user_id      text not null,
  counterparty_employee_id  integer,
  source_employee_id        integer,
  target_employee_id        integer,
  source_assignment_version integer not null,
  target_assignment_version integer,
  source_shift_snapshot     jsonb not null,
  target_shift_snapshot     jsonb,
  conflict_code             text,
  expires_at                timestamptz not null,
  completed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint planner20_shift_exchange_requests_kind_check
    check (kind in ('takeover', 'swap')),
  constraint planner20_shift_exchange_requests_status_check
    check (status in ('pending', 'declined', 'completed', 'conflict', 'expired', 'cancelled')),
  constraint planner20_shift_exchange_requests_target_check
    check (
      (
        kind = 'takeover'
        and target_shift_id is null
        and target_employee_id is null
        and target_assignment_version is null
        and target_shift_snapshot is null
        and (
          (
            initiator_employee_id is not null
            and initiator_employee_id is distinct from source_employee_id
            and counterparty_employee_id is not distinct from source_employee_id
          )
          or
          (
            counterparty_employee_id is not null
            and counterparty_employee_id is distinct from source_employee_id
            and initiator_employee_id is not distinct from source_employee_id
          )
        )
      )
      or
      (
        kind = 'swap'
        and initiator_employee_id is not null
        and counterparty_employee_id is not null
        and source_employee_id is not null
        and target_shift_id is not null
        and target_employee_id is not null
        and source_employee_id <> target_employee_id
        and target_assignment_version is not null
        and target_shift_snapshot is not null
        and target_shift_id <> source_shift_id
        and (
          (initiator_employee_id = source_employee_id and counterparty_employee_id = target_employee_id)
          or
          (initiator_employee_id = target_employee_id and counterparty_employee_id = source_employee_id)
        )
      )
    ),
  constraint planner20_shift_exchange_requests_parties_check
    check (initiator_user_id <> counterparty_user_id),
  constraint planner20_shift_exchange_requests_versions_check
    check (source_assignment_version >= 0 and (target_assignment_version is null or target_assignment_version >= 0)),
  constraint planner20_shift_exchange_requests_initiator_nonce_key unique (initiator_user_id, client_nonce),
  constraint planner20_shift_exchange_requests_conversation_fkey
    foreign key (conversation_id) references public.planner20_team_conversations(id) on delete restrict,
  constraint planner20_shift_exchange_requests_source_shift_fkey
    foreign key (source_shift_id) references public.planner20_shifts(id) on delete restrict,
  constraint planner20_shift_exchange_requests_target_shift_fkey
    foreign key (target_shift_id) references public.planner20_shifts(id) on delete restrict,
  constraint planner20_shift_exchange_requests_initiator_user_fkey
    foreign key (initiator_user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_shift_exchange_requests_initiator_employee_fkey
    foreign key (initiator_employee_id) references public.planner20_employees(id) on delete restrict,
  constraint planner20_shift_exchange_requests_counterparty_user_fkey
    foreign key (counterparty_user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_shift_exchange_requests_counterparty_employee_fkey
    foreign key (counterparty_employee_id) references public.planner20_employees(id) on delete restrict,
  constraint planner20_shift_exchange_requests_source_employee_fkey
    foreign key (source_employee_id) references public.planner20_employees(id) on delete restrict,
  constraint planner20_shift_exchange_requests_target_employee_fkey
    foreign key (target_employee_id) references public.planner20_employees(id) on delete restrict
);

create table if not exists public.planner20_shift_exchange_approvals (
  id                bigserial primary key,
  request_id        uuid not null,
  actor_user_id     text not null,
  actor_employee_id integer,
  decision          text not null,
  created_at        timestamptz not null default now(),
  constraint planner20_shift_exchange_approvals_decision_check
    check (decision in ('accepted', 'declined')),
  constraint planner20_shift_exchange_approvals_actor_key unique (request_id, actor_user_id),
  constraint planner20_shift_exchange_approvals_request_fkey
    foreign key (request_id) references public.planner20_shift_exchange_requests(id) on delete restrict,
  constraint planner20_shift_exchange_approvals_actor_user_fkey
    foreign key (actor_user_id) references public.planner20_users(username) on delete restrict,
  constraint planner20_shift_exchange_approvals_actor_employee_fkey
    foreign key (actor_employee_id) references public.planner20_employees(id) on delete restrict
);

create table if not exists public.planner20_planning_chat_events (
  id             bigserial primary key,
  correlation_id uuid not null,
  conversation_id bigint not null,
  request_id     uuid,
  message_id     bigint,
  actor_user_id  text,
  event_type     text not null,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  constraint planner20_planning_chat_events_correlation_key unique (correlation_id, event_type),
  constraint planner20_planning_chat_events_conversation_fkey
    foreign key (conversation_id) references public.planner20_team_conversations(id) on delete restrict,
  constraint planner20_planning_chat_events_request_fkey
    foreign key (request_id) references public.planner20_shift_exchange_requests(id) on delete restrict,
  constraint planner20_planning_chat_events_message_fkey
    foreign key (message_id) references public.planner20_team_messages(id) on delete restrict,
  constraint planner20_planning_chat_events_actor_user_fkey
    foreign key (actor_user_id) references public.planner20_users(username) on delete restrict
);

create index if not exists planner20_team_conversations_owner_user_id_idx
  on public.planner20_team_conversations (owner_user_id);
create index if not exists planner20_team_conversations_created_by_user_id_idx
  on public.planner20_team_conversations (created_by_user_id);
create index if not exists planner20_team_conversations_active_idx
  on public.planner20_team_conversations (status, updated_at desc) where status = 'active';

create index if not exists planner20_team_conversation_members_conversation_id_idx
  on public.planner20_team_conversation_members (conversation_id);
create index if not exists planner20_team_conversation_members_user_id_idx
  on public.planner20_team_conversation_members (user_id);
create index if not exists planner20_team_conversation_members_employee_id_idx
  on public.planner20_team_conversation_members (employee_id);
create index if not exists planner20_team_conversation_members_active_idx
  on public.planner20_team_conversation_members (user_id, conversation_id) where inactive_at is null;

create index if not exists planner20_team_chat_managers_user_id_idx
  on public.planner20_team_chat_managers (user_id);
create index if not exists planner20_team_chat_managers_granted_by_user_id_idx
  on public.planner20_team_chat_managers (granted_by_user_id);
create index if not exists planner20_team_chat_managers_active_idx
  on public.planner20_team_chat_managers (user_id) where inactive_at is null;

create index if not exists planner20_team_messages_conversation_id_idx
  on public.planner20_team_messages (conversation_id);
create index if not exists planner20_team_messages_sender_user_id_idx
  on public.planner20_team_messages (sender_user_id);
create index if not exists planner20_team_messages_sender_employee_id_idx
  on public.planner20_team_messages (sender_employee_id);
create index if not exists planner20_team_messages_reply_to_message_id_idx
  on public.planner20_team_messages (reply_to_message_id);
create index if not exists planner20_team_messages_cursor_idx
  on public.planner20_team_messages (conversation_id, id desc);

create index if not exists planner20_team_message_revisions_message_id_idx
  on public.planner20_team_message_revisions (message_id);
create index if not exists planner20_team_message_revisions_editor_user_id_idx
  on public.planner20_team_message_revisions (editor_user_id);

create index if not exists planner20_team_message_reactions_message_id_idx
  on public.planner20_team_message_reactions (message_id);
create index if not exists planner20_team_message_reactions_user_id_idx
  on public.planner20_team_message_reactions (user_id);
create index if not exists planner20_team_message_reactions_active_idx
  on public.planner20_team_message_reactions (message_id, emoji) where inactive_at is null;

create index if not exists planner20_team_message_shift_links_message_id_idx
  on public.planner20_team_message_shift_links (message_id);
create index if not exists planner20_team_message_shift_links_shift_id_idx
  on public.planner20_team_message_shift_links (shift_id);
create index if not exists planner20_team_message_shift_links_snapshot_employee_id_idx
  on public.planner20_team_message_shift_links (snapshot_employee_id);

create index if not exists planner20_team_read_positions_conversation_id_idx
  on public.planner20_team_read_positions (conversation_id);
create index if not exists planner20_team_read_positions_user_id_idx
  on public.planner20_team_read_positions (user_id);
create index if not exists planner20_team_read_positions_last_read_message_id_idx
  on public.planner20_team_read_positions (last_read_message_id);
create index if not exists planner20_team_read_positions_conversation_message_idx
  on public.planner20_team_read_positions (conversation_id, last_read_message_id);

create index if not exists planner20_shift_exchange_requests_conversation_id_idx
  on public.planner20_shift_exchange_requests (conversation_id);
create index if not exists planner20_shift_exchange_requests_source_shift_id_idx
  on public.planner20_shift_exchange_requests (source_shift_id);
create index if not exists planner20_shift_exchange_requests_target_shift_id_idx
  on public.planner20_shift_exchange_requests (target_shift_id);
create index if not exists planner20_shift_exchange_requests_initiator_user_id_idx
  on public.planner20_shift_exchange_requests (initiator_user_id);
create index if not exists planner20_shift_exchange_requests_initiator_employee_id_idx
  on public.planner20_shift_exchange_requests (initiator_employee_id);
create index if not exists planner20_shift_exchange_requests_counterparty_user_id_idx
  on public.planner20_shift_exchange_requests (counterparty_user_id);
create index if not exists planner20_shift_exchange_requests_counterparty_employee_id_idx
  on public.planner20_shift_exchange_requests (counterparty_employee_id);
create index if not exists planner20_shift_exchange_requests_source_employee_id_idx
  on public.planner20_shift_exchange_requests (source_employee_id);
create index if not exists planner20_shift_exchange_requests_target_employee_id_idx
  on public.planner20_shift_exchange_requests (target_employee_id);
create index if not exists planner20_shift_exchange_requests_pending_idx
  on public.planner20_shift_exchange_requests (status, expires_at) where status = 'pending';

create index if not exists planner20_shift_exchange_approvals_request_id_idx
  on public.planner20_shift_exchange_approvals (request_id);
create index if not exists planner20_shift_exchange_approvals_actor_user_id_idx
  on public.planner20_shift_exchange_approvals (actor_user_id);
create index if not exists planner20_shift_exchange_approvals_actor_employee_id_idx
  on public.planner20_shift_exchange_approvals (actor_employee_id);
create index if not exists planner20_shift_exchange_approvals_accepted_idx
  on public.planner20_shift_exchange_approvals (request_id, actor_user_id) where decision = 'accepted';

create index if not exists planner20_planning_chat_events_conversation_id_idx
  on public.planner20_planning_chat_events (conversation_id);
create index if not exists planner20_planning_chat_events_request_id_idx
  on public.planner20_planning_chat_events (request_id);
create index if not exists planner20_planning_chat_events_message_id_idx
  on public.planner20_planning_chat_events (message_id);
create index if not exists planner20_planning_chat_events_actor_user_id_idx
  on public.planner20_planning_chat_events (actor_user_id);
create index if not exists planner20_planning_chat_events_cursor_idx
  on public.planner20_planning_chat_events (conversation_id, id desc);

alter table public.planner20_team_conversations enable row level security;
alter table public.planner20_team_conversation_members enable row level security;
alter table public.planner20_team_chat_managers enable row level security;
alter table public.planner20_team_messages enable row level security;
alter table public.planner20_team_message_revisions enable row level security;
alter table public.planner20_team_message_reactions enable row level security;
alter table public.planner20_team_message_shift_links enable row level security;
alter table public.planner20_team_read_positions enable row level security;
alter table public.planner20_shift_exchange_requests enable row level security;
alter table public.planner20_shift_exchange_approvals enable row level security;
alter table public.planner20_planning_chat_events enable row level security;

revoke all on table public.planner20_team_conversations from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_conversation_members from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_chat_managers from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_messages from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_message_revisions from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_message_reactions from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_message_shift_links from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_team_read_positions from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_shift_exchange_requests from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_shift_exchange_approvals from PUBLIC, anon, authenticated, service_role;
revoke all on table public.planner20_planning_chat_events from PUBLIC, anon, authenticated, service_role;

grant select, insert, update on table public.planner20_team_conversations to service_role;
grant select, insert, update on table public.planner20_team_conversation_members to service_role;
grant select, insert, update on table public.planner20_team_chat_managers to service_role;
grant select, insert, update on table public.planner20_team_messages to service_role;
grant select, insert on table public.planner20_team_message_revisions to service_role;
grant select, insert, update on table public.planner20_team_message_reactions to service_role;
grant select, insert on table public.planner20_team_message_shift_links to service_role;
grant select, insert, update on table public.planner20_team_read_positions to service_role;
grant select, insert, update on table public.planner20_shift_exchange_requests to service_role;
grant select, insert on table public.planner20_shift_exchange_approvals to service_role;
grant select, insert on table public.planner20_planning_chat_events to service_role;

revoke all on sequence public.planner20_team_conversations_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_conversation_members_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_chat_managers_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_messages_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_message_revisions_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_message_reactions_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_message_shift_links_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_team_read_positions_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_shift_exchange_approvals_id_seq from PUBLIC, anon, authenticated, service_role;
revoke all on sequence public.planner20_planning_chat_events_id_seq from PUBLIC, anon, authenticated, service_role;

grant usage, select on sequence public.planner20_team_conversations_id_seq to service_role;
grant usage, select on sequence public.planner20_team_conversation_members_id_seq to service_role;
grant usage, select on sequence public.planner20_team_chat_managers_id_seq to service_role;
grant usage, select on sequence public.planner20_team_messages_id_seq to service_role;
grant usage, select on sequence public.planner20_team_message_revisions_id_seq to service_role;
grant usage, select on sequence public.planner20_team_message_reactions_id_seq to service_role;
grant usage, select on sequence public.planner20_team_message_shift_links_id_seq to service_role;
grant usage, select on sequence public.planner20_team_read_positions_id_seq to service_role;
grant usage, select on sequence public.planner20_shift_exchange_approvals_id_seq to service_role;
grant usage, select on sequence public.planner20_planning_chat_events_id_seq to service_role;

insert into public.planner20_team_conversations (
  kind,
  slug,
  name,
  description,
  is_fixed,
  status
)
values
  ('channel', 'nootities', 'Nootities', 'Dagelijkse notities voor het hele team.', true, 'active'),
  ('channel', 'nootzakelijk', 'Nootzakelijk', 'Belangrijke operationele mededelingen.', true, 'active'),
  ('channel', 'the-nootorious', 'The Nootorious', 'Teamnieuws en gezamenlijke momenten.', true, 'active'),
  ('channel', 'nootschap', 'NOOTSCHAP!!', 'Directe hulpvragen en planningafstemming.', true, 'active')
on conflict (slug) do nothing;

insert into public.planner20_team_conversation_members (
  conversation_id,
  user_id,
  employee_id,
  member_role,
  notification_preference
)
select
  conversation.id,
  account.username,
  account.employee_id,
  'member',
  'all'
from public.planner20_team_conversations as conversation
cross join public.planner20_users as account
left join public.planner20_employees as employee
  on employee.id = account.employee_id
where conversation.is_fixed = true
  and conversation.slug in ('nootities', 'nootzakelijk', 'the-nootorious', 'nootschap')
  and (account.employee_id is null or employee.is_active = 1)
on conflict (conversation_id, user_id) do nothing;

insert into public.planner20_team_chat_managers (
  user_id,
  granted_by_user_id
)
select
  account.username,
  account.username
from public.planner20_users as account
where lower(account.role) = 'admin'
on conflict (user_id) do nothing;

do $fixed_channel_seed_assertion$
begin
  if exists (
    select 1
    from public.planner20_team_conversations
    where (
      (
        kind = 'channel'
        and is_fixed = true
        and status = 'active'
        and archived_at is null
        and (
          (slug = 'nootities' and name = 'Nootities')
          or (slug = 'nootzakelijk' and name = 'Nootzakelijk')
          or (slug = 'the-nootorious' and name = 'The Nootorious')
          or (slug = 'nootschap' and name = 'NOOTSCHAP!!')
        )
      )
      or (
        kind in ('direct', 'group')
        and is_fixed = false
        and slug is null
      )
    ) is not true
  ) or (
    select count(*)
    from public.planner20_team_conversations
    where kind = 'channel'
  ) <> 4 then
    raise exception 'fixed channel seed conflict: canonical channels must match exactly';
  end if;
end
$fixed_channel_seed_assertion$;

do $conversation_identity_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'planner20_team_conversations_identity_check'
      and conrelid = 'public.planner20_team_conversations'::regclass
  ) then
    alter table public.planner20_team_conversations
      add constraint planner20_team_conversations_identity_check
      check (
        (
          (
            kind = 'channel'
            and is_fixed = true
            and status = 'active'
            and archived_at is null
            and (
              (slug = 'nootities' and name = 'Nootities')
              or (slug = 'nootzakelijk' and name = 'Nootzakelijk')
              or (slug = 'the-nootorious' and name = 'The Nootorious')
              or (slug = 'nootschap' and name = 'NOOTSCHAP!!')
            )
          )
          or (
            kind in ('direct', 'group')
            and is_fixed = false
            and slug is null
          )
        ) is true
      );
  end if;
end
$conversation_identity_constraint$;

create or replace function public.planner20_create_team_message(
  p_user_id text,
  p_employee_id integer,
  p_conversation_id bigint,
  p_client_nonce uuid,
  p_body text,
  p_gif_provider text,
  p_gif_provider_id text,
  p_gif_url text,
  p_gif_width integer,
  p_gif_height integer,
  p_shift_id integer,
  p_reply_to_message_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $create_team_message$
declare
  v_account planner20_users%rowtype;
  v_employee planner20_employees%rowtype;
  v_message planner20_team_messages%rowtype;
  v_shift planner20_shifts%rowtype;
  v_shift_link planner20_team_message_shift_links%rowtype;
  v_content_count integer;
  v_has_gif boolean;
  v_message_type text;
  v_result_status text;
begin
  if p_user_id is null
     or btrim(p_user_id) = ''
     or p_conversation_id is null
     or p_conversation_id < 1
     or p_client_nonce is null
     or (p_employee_id is not null and p_employee_id < 1)
     or (p_shift_id is not null and p_shift_id < 1)
     or (p_reply_to_message_id is not null and p_reply_to_message_id < 1) then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'invalid_request',
      'message', null,
      'shift', null
    );
  end if;

  select account.*
  into v_account
  from planner20_users as account
  where account.username = p_user_id;

  if not found then
    return jsonb_build_object(
      'status', 'forbidden',
      'error_code', 'account_not_found',
      'message', null,
      'shift', null
    );
  end if;

  if v_account.employee_id is null then
    if lower(v_account.role) <> 'admin' or p_employee_id is not null then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_mismatch',
        'message', null,
        'shift', null
      );
    end if;
  else
    if v_account.employee_id is distinct from p_employee_id then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_mismatch',
        'message', null,
        'shift', null
      );
    end if;

    select employee.*
    into v_employee
    from planner20_employees as employee
    where employee.id = v_account.employee_id
      and employee.is_active = 1;

    if not found then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_inactive',
        'message', null,
        'shift', null
      );
    end if;
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    where conversation.id = p_conversation_id
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object(
      'status', 'not_found',
      'error_code', 'conversation_not_active',
      'message', null,
      'shift', null
    );
  end if;

  if not exists (
    select 1
    from planner20_team_conversation_members as membership
    where membership.conversation_id = p_conversation_id
      and membership.user_id = p_user_id
      and membership.employee_id is not distinct from p_employee_id
      and membership.inactive_at is null
  ) then
    return jsonb_build_object(
      'status', 'forbidden',
      'error_code', 'conversation_membership_required',
      'message', null,
      'shift', null
    );
  end if;

  select message.*
  into v_message
  from planner20_team_messages as message
  where message.sender_user_id = p_user_id
    and message.client_nonce = p_client_nonce;

  if found then
    if v_message.conversation_id is distinct from p_conversation_id then
      return jsonb_build_object(
        'status', 'conflict',
        'error_code', 'client_nonce_conversation_conflict',
        'message', null,
        'shift', null
      );
    end if;

    v_result_status := 'duplicate';
  else
    v_has_gif := num_nonnulls(
      p_gif_provider,
      p_gif_provider_id,
      p_gif_url,
      p_gif_width,
      p_gif_height
    ) > 0;
    v_content_count :=
      case when p_body is not null then 1 else 0 end
      + case when v_has_gif then 1 else 0 end
      + case when p_shift_id is not null then 1 else 0 end;

    if v_content_count <> 1 then
      return jsonb_build_object(
        'status', 'invalid',
        'error_code', 'invalid_content',
        'message', null,
        'shift', null
      );
    end if;

    if p_body is not null then
      if char_length(btrim(p_body)) < 1 or char_length(btrim(p_body)) > 2000 then
        return jsonb_build_object(
          'status', 'invalid',
          'error_code', 'invalid_content',
          'message', null,
          'shift', null
        );
      end if;

      v_message_type := 'text';
    elsif v_has_gif then
      if num_nonnulls(
        p_gif_provider,
        p_gif_provider_id,
        p_gif_url,
        p_gif_width,
        p_gif_height
      ) <> 5
         or p_gif_provider <> 'giphy'
         or btrim(p_gif_provider_id) = ''
         or p_gif_width <= 0
         or p_gif_height <= 0
         or p_gif_url !~* '^https://(media\.giphy\.com|media0\.giphy\.com)(:[0-9]+)?(/|$)' then
        return jsonb_build_object(
          'status', 'invalid',
          'error_code', 'invalid_giphy',
          'message', null,
          'shift', null
        );
      end if;

      v_message_type := 'gif';
    else
      v_message_type := 'shift';
    end if;

    if p_reply_to_message_id is not null
       and not exists (
         select 1
         from planner20_team_messages as reply_message
         where reply_message.id = p_reply_to_message_id
           and reply_message.conversation_id = p_conversation_id
       ) then
      return jsonb_build_object(
        'status', 'invalid',
        'error_code', 'reply_message_not_in_conversation',
        'message', null,
        'shift', null
      );
    end if;

    if v_message_type = 'shift' then
      select shift.*
      into v_shift
      from planner20_shifts as shift
      where shift.id = p_shift_id
      for share;

      if not found then
        return jsonb_build_object(
          'status', 'not_found',
          'error_code', 'shift_not_found',
          'message', null,
          'shift', null
        );
      end if;
    end if;

    begin
      insert into planner20_team_messages (
        conversation_id,
        message_type,
        body,
        gif_provider,
        gif_provider_id,
        gif_url,
        gif_width,
        gif_height,
        sender_user_id,
        sender_employee_id,
        sender_display_name,
        reply_to_message_id,
        client_nonce
      )
      values (
        p_conversation_id,
        v_message_type,
        case when v_message_type = 'text' then btrim(p_body) else null end,
        case when v_message_type = 'gif' then p_gif_provider else null end,
        case when v_message_type = 'gif' then btrim(p_gif_provider_id) else null end,
        case when v_message_type = 'gif' then p_gif_url else null end,
        case when v_message_type = 'gif' then p_gif_width else null end,
        case when v_message_type = 'gif' then p_gif_height else null end,
        p_user_id,
        p_employee_id,
        coalesce(nullif(btrim(v_account.display_name), ''), v_employee.name, v_account.username),
        p_reply_to_message_id,
        p_client_nonce
      )
      returning * into v_message;

      v_result_status := 'created';
    exception
      when unique_violation then
        select message.*
        into v_message
        from planner20_team_messages as message
        where message.sender_user_id = p_user_id
          and message.client_nonce = p_client_nonce;

        if not found then
          raise;
        end if;

        if v_message.conversation_id is distinct from p_conversation_id then
          return jsonb_build_object(
            'status', 'conflict',
            'error_code', 'client_nonce_conversation_conflict',
            'message', null,
            'shift', null
          );
        end if;

        v_result_status := 'duplicate';
    end;

    if v_result_status = 'created' and v_message_type = 'shift' then
      insert into planner20_team_message_shift_links (
        message_id,
        shift_id,
        snapshot_employee_id,
        snapshot_employee_name,
        snapshot_week_number,
        snapshot_year,
        snapshot_day_of_week,
        snapshot_shift_type,
        snapshot_start_time,
        snapshot_end_time,
        snapshot_full_day,
        snapshot_break_minutes,
        snapshot_location,
        snapshot_assignment_version
      )
      values (
        v_message.id,
        v_shift.id,
        v_shift.employee_id,
        v_shift.employee_name,
        v_shift.week_number,
        v_shift.year,
        v_shift.day_of_week,
        v_shift.shift_type,
        v_shift.start_time,
        v_shift.end_time,
        v_shift.full_day,
        coalesce((to_jsonb(v_shift) ->> 'break_minutes')::integer, 0),
        v_shift.location,
        v_shift.assignment_version
      );
    end if;
  end if;

  select shift_link.*
  into v_shift_link
  from planner20_team_message_shift_links as shift_link
  where shift_link.message_id = v_message.id;

  return jsonb_build_object(
    'status', v_result_status,
    'error_code', null,
    'message', jsonb_build_object(
      'id', v_message.id,
      'conversation_id', v_message.conversation_id,
      'message_type', v_message.message_type,
      'body', v_message.body,
      'gif', case
        when v_message.message_type = 'gif' then jsonb_build_object(
          'provider', v_message.gif_provider,
          'id', v_message.gif_provider_id,
          'url', v_message.gif_url,
          'width', v_message.gif_width,
          'height', v_message.gif_height
        )
        else null
      end,
      'sender_user_id', v_message.sender_user_id,
      'sender_employee_id', v_message.sender_employee_id,
      'sender_display_name', v_message.sender_display_name,
      'reply_to_message_id', v_message.reply_to_message_id,
      'client_nonce', v_message.client_nonce,
      'edited_at', v_message.edited_at,
      'created_at', v_message.created_at
    ),
    'shift', case
      when v_shift_link.id is null then null
      else jsonb_build_object(
        'shift_id', v_shift_link.shift_id,
        'employee_id', v_shift_link.snapshot_employee_id,
        'employee_name', v_shift_link.snapshot_employee_name,
        'week_number', v_shift_link.snapshot_week_number,
        'year', v_shift_link.snapshot_year,
        'day_of_week', v_shift_link.snapshot_day_of_week,
        'shift_type', v_shift_link.snapshot_shift_type,
        'start_time', v_shift_link.snapshot_start_time,
        'end_time', v_shift_link.snapshot_end_time,
        'full_day', v_shift_link.snapshot_full_day,
        'break_minutes', v_shift_link.snapshot_break_minutes,
        'location', v_shift_link.snapshot_location,
        'assignment_version', v_shift_link.snapshot_assignment_version
      )
    end
  );
end
$create_team_message$;

create or replace function public.planner20_ensure_fixed_channel_memberships(
  p_user_id text,
  p_employee_id integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $ensure_fixed_channel_memberships$
declare
  v_account planner20_users%rowtype;
  v_employee planner20_employees%rowtype;
  v_membership_count integer;
begin
  if p_user_id is null
     or btrim(p_user_id) = ''
     or (p_employee_id is not null and p_employee_id < 1) then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'invalid_actor',
      'membership_count', 0
    );
  end if;

  select account.*
  into v_account
  from planner20_users as account
  where account.username = p_user_id;

  if not found then
    return jsonb_build_object(
      'status', 'forbidden',
      'error_code', 'account_not_found',
      'membership_count', 0
    );
  end if;

  if v_account.employee_id is null then
    if lower(v_account.role) <> 'admin' or p_employee_id is not null then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_mismatch',
        'membership_count', 0
      );
    end if;
  else
    if v_account.employee_id is distinct from p_employee_id then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_mismatch',
        'membership_count', 0
      );
    end if;

    select employee.*
    into v_employee
    from planner20_employees as employee
    where employee.id = v_account.employee_id
      and employee.is_active = 1;

    if not found then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_inactive',
        'membership_count', 0
      );
    end if;
  end if;

  if (
    select count(*)
    from planner20_team_conversations as conversation
    where conversation.slug in ('nootities', 'nootzakelijk', 'the-nootorious', 'nootschap')
      and conversation.kind = 'channel'
      and conversation.is_fixed = true
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) <> 4 then
    return jsonb_build_object(
      'status', 'conflict',
      'error_code', 'fixed_channels_unavailable',
      'membership_count', 0
    );
  end if;

  with restored_memberships as (
    insert into planner20_team_conversation_members (
      conversation_id,
      user_id,
      employee_id,
      member_role,
      notification_preference
    )
    select
      conversation.id,
      p_user_id,
      p_employee_id,
      'member',
      'all'
    from planner20_team_conversations as conversation
    where conversation.slug in ('nootities', 'nootzakelijk', 'the-nootorious', 'nootschap')
      and conversation.kind = 'channel'
      and conversation.is_fixed = true
      and conversation.status = 'active'
      and conversation.archived_at is null
    on conflict (conversation_id, user_id) do update
    set employee_id = excluded.employee_id,
        inactive_at = null,
        updated_at = now()
    returning id
  )
  select count(*)::integer
  into v_membership_count
  from restored_memberships;

  return jsonb_build_object(
    'status', 'ok',
    'error_code', null,
    'membership_count', v_membership_count
  );
end
$ensure_fixed_channel_memberships$;

create or replace function public.planner20_team_chat_bootstrap_stats(
  p_user_id text,
  p_conversation_ids bigint[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $team_chat_bootstrap_stats$
declare
  v_account planner20_users%rowtype;
  v_stats jsonb;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'invalid_actor',
      'stats', '[]'::jsonb
    );
  end if;

  select account.*
  into v_account
    from planner20_users as account
    where account.username = p_user_id;

  if not found then
    return jsonb_build_object(
      'status', 'forbidden',
      'error_code', 'account_not_found',
      'stats', '[]'::jsonb
    );
  end if;

  if v_account.employee_id is null then
    if lower(v_account.role) <> 'admin' then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'employee_mismatch',
        'stats', '[]'::jsonb
      );
    end if;
  elsif not exists (
    select 1
    from planner20_employees as employee
    where employee.id = v_account.employee_id
      and employee.is_active = 1
  ) then
    return jsonb_build_object(
      'status', 'forbidden',
      'error_code', 'employee_inactive',
      'stats', '[]'::jsonb
    );
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_conversation_ids, array[]::bigint[])) as requested_id
    where requested_id is null or requested_id < 1
  ) then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'invalid_conversation_ids',
      'stats', '[]'::jsonb
    );
  end if;

  with requested as (
    select distinct requested_id as conversation_id
    from unnest(coalesce(p_conversation_ids, array[]::bigint[])) as requested_id
  ),
  accessible as (
    select conversation.id as conversation_id
    from requested
    join planner20_team_conversations as conversation
      on conversation.id = requested.conversation_id
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.inactive_at is null
    where conversation.status = 'active'
      and conversation.archived_at is null
  ),
  latest as (
    select distinct on (message.conversation_id)
      message.conversation_id,
      message.id as latest_message_id,
      message.created_at as latest_message_at
    from planner20_team_messages as message
    join accessible
      on accessible.conversation_id = message.conversation_id
    order by message.conversation_id, message.id desc
  ),
  read_cursors as (
    select
      accessible.conversation_id,
      read_position.last_read_message_id
    from accessible
    left join planner20_team_read_positions as read_position
      on read_position.conversation_id = accessible.conversation_id
     and read_position.user_id = p_user_id
  ),
  unread as (
    select
      read_cursors.conversation_id,
      count(unread_message.id)::bigint as unread_count
    from read_cursors
    left join planner20_team_messages as unread_message
      on unread_message.conversation_id = read_cursors.conversation_id
     and unread_message.id > coalesce(read_cursors.last_read_message_id, 0)
     and unread_message.sender_user_id is distinct from p_user_id
    group by read_cursors.conversation_id
  ),
  conversation_stats as (
    select
      accessible.conversation_id,
      latest.latest_message_id,
      latest.latest_message_at,
      coalesce(unread.unread_count, 0) as unread_count
    from accessible
    left join latest
      on latest.conversation_id = accessible.conversation_id
    left join unread
      on unread.conversation_id = accessible.conversation_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'conversation_id', conversation_stats.conversation_id,
        'latest_message_id', conversation_stats.latest_message_id,
        'latest_message_at', conversation_stats.latest_message_at,
        'unread_count', conversation_stats.unread_count
      )
      order by conversation_stats.conversation_id
    ),
    '[]'::jsonb
  )
  into v_stats
  from conversation_stats;

  return jsonb_build_object(
    'status', 'ok',
    'error_code', null,
    'stats', v_stats
  );
end
$team_chat_bootstrap_stats$;

revoke all on function public.planner20_create_team_message(
  text, integer, bigint, uuid, text, text, text, text, integer, integer, integer, bigint
) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_create_team_message(
  text, integer, bigint, uuid, text, text, text, text, integer, integer, integer, bigint
) to service_role;

revoke all on function public.planner20_ensure_fixed_channel_memberships(text, integer)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_ensure_fixed_channel_memberships(text, integer)
  to service_role;

revoke all on function public.planner20_team_chat_bootstrap_stats(text, bigint[])
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_team_chat_bootstrap_stats(text, bigint[])
  to service_role;

create or replace function public.planner20_edit_team_message(
  p_user_id text,
  p_employee_id integer,
  p_message_id bigint,
  p_body text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $edit_team_message$
declare
  v_message planner20_team_messages%rowtype;
  v_body text;
begin
  v_body := btrim(coalesce(p_body, ''));
  if p_user_id is null or btrim(p_user_id) = ''
     or p_message_id is null or p_message_id < 1
     or char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('status', 'invalid', 'error_code', 'invalid_content', 'message', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee on employee.id = account.employee_id
    where account.username = p_user_id
      and account.employee_id is not distinct from p_employee_id
      and (
        (account.employee_id is null and lower(account.role) = 'admin')
        or (account.employee_id is not null and employee.is_active = 1)
      )
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'employee_inactive', 'message', null);
  end if;

  select message.*
  into v_message
  from planner20_team_messages as message
  where message.id = p_message_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'error_code', 'message_not_found', 'message', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.employee_id is not distinct from p_employee_id
     and membership.inactive_at is null
    where conversation.id = v_message.conversation_id
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'conversation_membership_required', 'message', null);
  end if;

  if v_message.sender_user_id is distinct from p_user_id
     or v_message.message_type <> 'text'
     or v_message.body is null then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'message_not_editable', 'message', null);
  end if;

  if v_message.body = v_body then
    return jsonb_build_object(
      'status', 'unchanged',
      'error_code', null,
      'message', jsonb_build_object(
        'id', v_message.id,
        'conversation_id', v_message.conversation_id,
        'message_type', v_message.message_type,
        'body', v_message.body,
        'gif', null,
        'sender_user_id', v_message.sender_user_id,
        'sender_employee_id', v_message.sender_employee_id,
        'sender_display_name', v_message.sender_display_name,
        'reply_to_message_id', v_message.reply_to_message_id,
        'client_nonce', v_message.client_nonce,
        'edited_at', v_message.edited_at,
        'created_at', v_message.created_at
      )
    );
  end if;

  insert into planner20_team_message_revisions (
    message_id,
    editor_user_id,
    previous_body,
    new_body
  ) values (
    v_message.id,
    p_user_id,
    v_message.body,
    v_body
  );

  update planner20_team_messages
  set body = v_body,
      edited_at = now()
  where id = v_message.id
  returning * into v_message;

  return jsonb_build_object(
    'status', 'updated',
    'error_code', null,
    'message', jsonb_build_object(
      'id', v_message.id,
      'conversation_id', v_message.conversation_id,
      'message_type', v_message.message_type,
      'body', v_message.body,
      'gif', null,
      'sender_user_id', v_message.sender_user_id,
      'sender_employee_id', v_message.sender_employee_id,
      'sender_display_name', v_message.sender_display_name,
      'reply_to_message_id', v_message.reply_to_message_id,
      'client_nonce', v_message.client_nonce,
      'edited_at', v_message.edited_at,
      'created_at', v_message.created_at
    )
  );
end
$edit_team_message$;

create or replace function public.planner20_toggle_team_message_reaction(
  p_user_id text,
  p_employee_id integer,
  p_message_id bigint,
  p_emoji text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $toggle_team_message_reaction$
declare
  v_message planner20_team_messages%rowtype;
  v_reaction planner20_team_message_reactions%rowtype;
  v_count integer;
begin
  if p_user_id is null or btrim(p_user_id) = ''
     or p_message_id is null or p_message_id < 1
     or p_emoji is null or char_length(btrim(p_emoji)) < 1 or char_length(btrim(p_emoji)) > 64 then
    return jsonb_build_object('status', 'invalid', 'error_code', 'invalid_emoji', 'reaction', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee on employee.id = account.employee_id
    where account.username = p_user_id
      and account.employee_id is not distinct from p_employee_id
      and (
        (account.employee_id is null and lower(account.role) = 'admin')
        or (account.employee_id is not null and employee.is_active = 1)
      )
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'employee_inactive', 'reaction', null);
  end if;

  select message.*
  into v_message
  from planner20_team_messages as message
  where message.id = p_message_id;

  if not found then
    return jsonb_build_object('status', 'not_found', 'error_code', 'message_not_found', 'reaction', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.employee_id is not distinct from p_employee_id
     and membership.inactive_at is null
    where conversation.id = v_message.conversation_id
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'conversation_membership_required', 'reaction', null);
  end if;

  insert into planner20_team_message_reactions (
    message_id,
    user_id,
    emoji,
    inactive_at
  ) values (
    p_message_id,
    p_user_id,
    btrim(p_emoji),
    null
  )
  on conflict (message_id, user_id, emoji) do update
  set inactive_at = case
        when planner20_team_message_reactions.inactive_at is null then now()
        else null
      end,
      updated_at = now()
  returning * into v_reaction;

  select count(*)::integer
  into v_count
  from planner20_team_message_reactions
  where message_id = p_message_id
    and emoji = btrim(p_emoji)
    and inactive_at is null;

  return jsonb_build_object(
    'status', case when v_reaction.inactive_at is null then 'activated' else 'deactivated' end,
    'error_code', null,
    'reaction', jsonb_build_object(
      'message_id', v_reaction.message_id,
      'emoji', v_reaction.emoji,
      'active', v_reaction.inactive_at is null,
      'count', v_count
    )
  );
end
$toggle_team_message_reaction$;

create or replace function public.planner20_mark_team_conversation_read(
  p_user_id text,
  p_employee_id integer,
  p_conversation_id bigint,
  p_message_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $mark_team_conversation_read$
declare
  v_read planner20_team_read_positions%rowtype;
  v_advanced boolean;
begin
  if p_user_id is null or btrim(p_user_id) = ''
     or p_conversation_id is null or p_conversation_id < 1
     or p_message_id is null or p_message_id < 1 then
    return jsonb_build_object('status', 'invalid', 'error_code', 'invalid_request', 'read', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee on employee.id = account.employee_id
    where account.username = p_user_id
      and account.employee_id is not distinct from p_employee_id
      and (
        (account.employee_id is null and lower(account.role) = 'admin')
        or (account.employee_id is not null and employee.is_active = 1)
      )
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'employee_inactive', 'read', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.employee_id is not distinct from p_employee_id
     and membership.inactive_at is null
    where conversation.id = p_conversation_id
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'conversation_membership_required', 'read', null);
  end if;

  if not exists (
    select 1
    from planner20_team_messages as message
    where message.id = p_message_id
      and message.conversation_id = p_conversation_id
  ) then
    return jsonb_build_object('status', 'invalid', 'error_code', 'read_message_not_in_conversation', 'read', null);
  end if;

  insert into planner20_team_read_positions (
    conversation_id,
    user_id,
    last_read_message_id,
    last_read_at
  ) values (
    p_conversation_id,
    p_user_id,
    p_message_id,
    now()
  )
  on conflict (conversation_id, user_id) do update
  set last_read_message_id = greatest(
        coalesce(planner20_team_read_positions.last_read_message_id, 0),
        excluded.last_read_message_id
      ),
      last_read_at = now(),
      updated_at = now()
  where excluded.last_read_message_id > coalesce(planner20_team_read_positions.last_read_message_id, 0)
  returning * into v_read;

  v_advanced := found;
  if not v_advanced then
    select read_position.*
    into v_read
    from planner20_team_read_positions as read_position
    where read_position.conversation_id = p_conversation_id
      and read_position.user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'error_code', null,
    'read', jsonb_build_object(
      'conversation_id', v_read.conversation_id,
      'last_read_message_id', v_read.last_read_message_id,
      'advanced', v_advanced
    )
  );
end
$mark_team_conversation_read$;

revoke all on function public.planner20_edit_team_message(text, integer, bigint, text)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_edit_team_message(text, integer, bigint, text)
  to service_role;

revoke all on function public.planner20_toggle_team_message_reaction(text, integer, bigint, text)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_toggle_team_message_reaction(text, integer, bigint, text)
  to service_role;

revoke all on function public.planner20_mark_team_conversation_read(text, integer, bigint, bigint)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_mark_team_conversation_read(text, integer, bigint, bigint)
  to service_role;

create or replace function public.planner20_publish_planning_trigger(
  p_conversation_id bigint,
  p_user_id text,
  p_employee_id integer,
  p_event_key uuid,
  p_event_type text,
  p_body text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $publish_planning_trigger$
declare
  v_message_id bigint;
  v_published boolean := false;
begin
  if p_conversation_id is null
     or p_user_id is null
     or p_event_key is null
     or p_event_type is null
     or p_event_type !~ '^[a-z0-9_]{3,64}$'
     or p_body is null
     or char_length(trim(p_body)) not between 1 and 2000
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('status', 'invalid', 'error_code', 'invalid_planning_trigger', 'message_id', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee
      on employee.id = account.employee_id
    where account.username = p_user_id
      and account.employee_id is not distinct from p_employee_id
      and (account.employee_id is null or employee.is_active = 1)
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'active_account_required', 'message_id', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    where account.username = p_user_id
      and (
        account.role = 'admin'
        or exists (
          select 1
          from planner20_team_chat_managers as manager
          where manager.user_id = p_user_id
            and manager.inactive_at is null
        )
      )
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'team_chat_management_required', 'message_id', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.employee_id is not distinct from p_employee_id
     and membership.inactive_at is null
    where conversation.id = p_conversation_id
      and conversation.slug = 'nootschap'
      and conversation.is_fixed = true
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object('status', 'not_found', 'error_code', 'nootschap_channel_unavailable', 'message_id', null);
  end if;

  insert into planner20_team_messages (
    conversation_id,
    message_type,
    body,
    sender_display_name,
    client_nonce,
    system_event_key
  ) values (
    p_conversation_id,
    'system',
    trim(p_body),
    'Planningwacht',
    p_event_key,
    p_event_key
  )
  on conflict (system_event_key) do nothing
  returning id into v_message_id;

  v_published := found;
  if not v_published then
    select message.id
    into v_message_id
    from planner20_team_messages as message
    where message.system_event_key = p_event_key
      and message.conversation_id = p_conversation_id;
    if not found then
      return jsonb_build_object('status', 'invalid', 'error_code', 'planning_trigger_key_conflict', 'message_id', null);
    end if;
  end if;

  insert into planner20_planning_chat_events (
    correlation_id,
    conversation_id,
    message_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    p_event_key,
    p_conversation_id,
    v_message_id,
    p_user_id,
    p_event_type,
    p_payload
  )
  on conflict (correlation_id, event_type) do nothing;

  return jsonb_build_object(
    'status', case when v_published then 'published' else 'duplicate' end,
    'error_code', null,
    'message_id', v_message_id
  );
end
$publish_planning_trigger$;

revoke all on function public.planner20_publish_planning_trigger(bigint, text, integer, uuid, text, text, jsonb)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_publish_planning_trigger(bigint, text, integer, uuid, text, text, jsonb)
  to service_role;

create or replace function public.planner20_create_shift_exchange(
  p_conversation_id bigint,
  p_client_nonce uuid,
  p_kind text,
  p_source_shift_id integer,
  p_target_shift_id integer,
  p_user_id text,
  p_employee_id integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $create_shift_exchange$
declare
  v_request planner20_shift_exchange_requests%rowtype;
  v_source_shift planner20_shifts%rowtype;
  v_target_shift planner20_shifts%rowtype;
  v_counterparty_user_id text;
  v_counterparty_employee_id integer;
  v_counterparty_count integer;
  v_source_snapshot jsonb;
  v_target_snapshot jsonb;
  v_system_message_id bigint;
  v_created boolean := false;
  v_amsterdam_now timestamp without time zone;
  v_source_date date;
  v_target_date date;
  v_source_day integer;
  v_target_day integer;
begin
  if p_conversation_id is null
     or p_client_nonce is null
     or p_user_id is null
     or p_employee_id is null
     or p_source_shift_id is null
     or p_kind is null
     or p_kind not in ('takeover', 'swap')
     or (p_kind = 'takeover' and p_target_shift_id is not null)
     or (p_kind = 'swap' and (p_target_shift_id is null or p_target_shift_id = p_source_shift_id)) then
    return jsonb_build_object('status', 'invalid', 'error_code', 'invalid_exchange_input', 'request', null);
  end if;

  if not exists (
    select 1
    from planner20_users as account
    join planner20_employees as employee
      on employee.id = account.employee_id
     and employee.is_active = 1
    where account.username = p_user_id
      and account.employee_id = p_employee_id
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'active_employee_required', 'request', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversations as conversation
    join planner20_team_conversation_members as membership
      on membership.conversation_id = conversation.id
     and membership.user_id = p_user_id
     and membership.employee_id is not distinct from p_employee_id
     and membership.inactive_at is null
    where conversation.id = p_conversation_id
      and conversation.status = 'active'
      and conversation.archived_at is null
  ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'conversation_membership_required', 'request', null);
  end if;

  select request_row.*
  into v_request
  from planner20_shift_exchange_requests as request_row
  where request_row.initiator_user_id = p_user_id
    and request_row.client_nonce = p_client_nonce;

  if found then
    if v_request.conversation_id <> p_conversation_id
       or v_request.kind <> p_kind
       or v_request.source_shift_id <> p_source_shift_id
       or v_request.target_shift_id is distinct from p_target_shift_id
       or v_request.initiator_employee_id is distinct from p_employee_id then
      return jsonb_build_object('status', 'conflict', 'error_code', 'exchange_nonce_conflict', 'request', null);
    end if;
    return jsonb_build_object('status', 'duplicate', 'error_code', null, 'request', to_jsonb(v_request));
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20420, 0);

  perform shift_row.id
  from planner20_shifts as shift_row
  where shift_row.id = p_source_shift_id
     or shift_row.id = p_target_shift_id
  order by shift_row.id
  for update;

  select shift_row.*
  into v_source_shift
  from planner20_shifts as shift_row
  where shift_row.id = p_source_shift_id;

  if not found then
    return jsonb_build_object('status', 'not_found', 'error_code', 'source_shift_not_found', 'request', null);
  end if;
  if lower(trim(v_source_shift.shift_type)) in ('verlof', 'vakantie', 'verzuim') then
    return jsonb_build_object('status', 'conflict', 'error_code', 'source_shift_not_exchangeable', 'request', null);
  end if;

  v_amsterdam_now := timezone('Europe/Amsterdam', now());
  v_source_day := case lower(v_source_shift.day_of_week)
    when 'maandag' then 1 when 'dinsdag' then 2 when 'woensdag' then 3
    when 'donderdag' then 4 when 'vrijdag' then 5 when 'zaterdag' then 6 when 'zondag' then 7
    else null
  end;
  if v_source_day is null then
    return jsonb_build_object('status', 'conflict', 'error_code', 'invalid_source_day', 'request', null);
  end if;
  v_source_date := to_date(
    format('%s-%s-%s', v_source_shift.year, lpad(v_source_shift.week_number::text, 2, '0'), v_source_day),
    'IYYY-IW-ID'
  );
  if v_source_date < v_amsterdam_now::date
     or (
       v_source_date = v_amsterdam_now::date
       and (
         v_source_shift.start_time is null
         or v_source_shift.full_day = 1
         or v_source_date + v_source_shift.start_time <= v_amsterdam_now
       )
     ) then
    return jsonb_build_object('status', 'conflict', 'error_code', 'source_shift_not_future', 'request', null);
  end if;

  if p_kind = 'takeover' then
    if v_source_shift.employee_id is not distinct from p_employee_id then
      return jsonb_build_object(
        'status', 'invalid',
        'error_code', 'takeover_source_owned_by_initiator',
        'request', null
      );
    end if;
    v_counterparty_employee_id := v_source_shift.employee_id;
  else
    if v_source_shift.employee_id is distinct from p_employee_id then
      return jsonb_build_object(
        'status', 'forbidden',
        'error_code', 'swap_source_not_owned_by_initiator',
        'request', null
      );
    end if;

    select shift_row.*
    into v_target_shift
    from planner20_shifts as shift_row
    where shift_row.id = p_target_shift_id;

    if not found then
      return jsonb_build_object('status', 'not_found', 'error_code', 'target_shift_not_found', 'request', null);
    end if;
    if v_target_shift.employee_id is null or v_target_shift.employee_id = p_employee_id then
      return jsonb_build_object('status', 'conflict', 'error_code', 'invalid_swap_parties', 'request', null);
    end if;
    if lower(trim(v_target_shift.shift_type)) in ('verlof', 'vakantie', 'verzuim') then
      return jsonb_build_object('status', 'conflict', 'error_code', 'target_shift_not_exchangeable', 'request', null);
    end if;

    v_target_day := case lower(v_target_shift.day_of_week)
      when 'maandag' then 1 when 'dinsdag' then 2 when 'woensdag' then 3
      when 'donderdag' then 4 when 'vrijdag' then 5 when 'zaterdag' then 6 when 'zondag' then 7
      else null
    end;
    if v_target_day is null then
      return jsonb_build_object('status', 'conflict', 'error_code', 'invalid_target_day', 'request', null);
    end if;
    v_target_date := to_date(
      format('%s-%s-%s', v_target_shift.year, lpad(v_target_shift.week_number::text, 2, '0'), v_target_day),
      'IYYY-IW-ID'
    );
    if v_target_date < v_amsterdam_now::date
       or (
         v_target_date = v_amsterdam_now::date
         and (
           v_target_shift.start_time is null
           or v_target_shift.full_day = 1
           or v_target_date + v_target_shift.start_time <= v_amsterdam_now
         )
       ) then
      return jsonb_build_object('status', 'conflict', 'error_code', 'target_shift_not_future', 'request', null);
    end if;
    v_counterparty_employee_id := v_target_shift.employee_id;
  end if;

  if v_counterparty_employee_id is null then
    select count(*), min(account.username)
    into v_counterparty_count, v_counterparty_user_id
    from planner20_users as account
    where account.username <> p_user_id
      and account.employee_id is null
      and (
        account.role = 'admin'
        or exists (
          select 1
          from planner20_team_chat_managers as manager
          where manager.user_id = account.username
            and manager.inactive_at is null
        )
      );
  else
    select count(*), min(account.username)
    into v_counterparty_count, v_counterparty_user_id
    from planner20_users as account
    join planner20_employees as employee
      on employee.id = account.employee_id
     and employee.is_active = 1
    where account.employee_id = v_counterparty_employee_id
      and account.username <> p_user_id;
  end if;

  if v_counterparty_count = 0 or v_counterparty_user_id is null then
    return jsonb_build_object('status', 'conflict', 'error_code', 'counterparty_account_not_found', 'request', null);
  end if;
  if v_counterparty_count > 1 then
    return jsonb_build_object('status', 'conflict', 'error_code', 'counterparty_account_ambiguous', 'request', null);
  end if;

  if not exists (
    select 1
    from planner20_team_conversation_members as membership
    where membership.conversation_id = p_conversation_id
      and membership.user_id = v_counterparty_user_id
      and membership.employee_id is not distinct from v_counterparty_employee_id
      and membership.inactive_at is null
  ) then
    return jsonb_build_object('status', 'conflict', 'error_code', 'counterparty_membership_required', 'request', null);
  end if;

  v_source_snapshot := jsonb_build_object(
    'week_number', v_source_shift.week_number,
    'year', v_source_shift.year,
    'day_of_week', v_source_shift.day_of_week,
    'shift_type', v_source_shift.shift_type,
    'start_time', v_source_shift.start_time,
    'end_time', v_source_shift.end_time,
    'full_day', v_source_shift.full_day,
    'break_minutes', coalesce(to_jsonb(v_source_shift) -> 'break_minutes', '0'::jsonb),
    'location', v_source_shift.location
  );
  if p_kind = 'swap' then
    v_target_snapshot := jsonb_build_object(
      'week_number', v_target_shift.week_number,
      'year', v_target_shift.year,
      'day_of_week', v_target_shift.day_of_week,
      'shift_type', v_target_shift.shift_type,
      'start_time', v_target_shift.start_time,
      'end_time', v_target_shift.end_time,
      'full_day', v_target_shift.full_day,
      'break_minutes', coalesce(to_jsonb(v_target_shift) -> 'break_minutes', '0'::jsonb),
      'location', v_target_shift.location
    );
  end if;

  insert into planner20_shift_exchange_requests (
    conversation_id,
    client_nonce,
    kind,
    status,
    source_shift_id,
    target_shift_id,
    initiator_user_id,
    initiator_employee_id,
    counterparty_user_id,
    counterparty_employee_id,
    source_employee_id,
    target_employee_id,
    source_assignment_version,
    target_assignment_version,
    source_shift_snapshot,
    target_shift_snapshot,
    expires_at
  ) values (
    p_conversation_id,
    p_client_nonce,
    p_kind,
    'pending',
    p_source_shift_id,
    p_target_shift_id,
    p_user_id,
    p_employee_id,
    v_counterparty_user_id,
    v_counterparty_employee_id,
    v_source_shift.employee_id,
    case when p_kind = 'swap' then v_target_shift.employee_id else null end,
    v_source_shift.assignment_version,
    case when p_kind = 'swap' then v_target_shift.assignment_version else null end,
    v_source_snapshot,
    v_target_snapshot,
    now() + interval '48 hours'
  )
  on conflict (initiator_user_id, client_nonce) do nothing
  returning * into v_request;

  v_created := found;
  if not v_created then
    select request_row.*
    into v_request
    from planner20_shift_exchange_requests as request_row
    where request_row.initiator_user_id = p_user_id
      and request_row.client_nonce = p_client_nonce;
    if not found
       or v_request.conversation_id <> p_conversation_id
       or v_request.kind <> p_kind
       or v_request.source_shift_id <> p_source_shift_id
       or v_request.target_shift_id is distinct from p_target_shift_id
       or v_request.initiator_employee_id is distinct from p_employee_id then
      return jsonb_build_object('status', 'conflict', 'error_code', 'exchange_nonce_conflict', 'request', null);
    end if;
    return jsonb_build_object('status', 'duplicate', 'error_code', null, 'request', to_jsonb(v_request));
  end if;

  insert into planner20_shift_exchange_approvals (
    request_id,
    actor_user_id,
    actor_employee_id,
    decision
  ) values (
    v_request.id,
    p_user_id,
    p_employee_id,
    'accepted'
  )
  on conflict (request_id, actor_user_id) do nothing;

  insert into planner20_team_messages (
    conversation_id,
    message_type,
    body,
    sender_display_name,
    client_nonce,
    system_event_key
  ) values (
    p_conversation_id,
    'system',
    case when p_kind = 'takeover'
      then 'Er staat een dienstovername klaar voor akkoord.'
      else 'Er staat een dienstenruil klaar voor akkoord.'
    end,
    'Planningwacht',
    p_client_nonce,
    p_client_nonce
  )
  on conflict (system_event_key) do nothing
  returning id into v_system_message_id;

  if v_system_message_id is null then
    select message.id
    into v_system_message_id
    from planner20_team_messages as message
    where message.system_event_key = p_client_nonce;
  end if;

  insert into planner20_planning_chat_events (
    correlation_id,
    conversation_id,
    request_id,
    message_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    v_request.id,
    p_conversation_id,
    v_request.id,
    v_system_message_id,
    p_user_id,
    'shift_exchange_requested',
    jsonb_build_object(
      'kind', p_kind,
      'source_shift_id', p_source_shift_id,
      'target_shift_id', p_target_shift_id
    )
  )
  on conflict (correlation_id, event_type) do nothing;

  return jsonb_build_object('status', 'created', 'error_code', null, 'request', to_jsonb(v_request));
end
$create_shift_exchange$;

revoke all on function public.planner20_create_shift_exchange(bigint, uuid, text, integer, integer, text, integer)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.planner20_create_shift_exchange(bigint, uuid, text, integer, integer, text, integer)
  to service_role;

create or replace function public.planner20_respond_to_shift_exchange(
  p_request_id uuid,
  p_user_id text,
  p_employee_id integer,
  p_decision text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_request planner20_shift_exchange_requests%rowtype;
  v_source_shift planner20_shifts%rowtype;
  v_target_shift planner20_shifts%rowtype;
  v_expected_employee_id integer;
  v_new_source_employee_id integer;
  v_new_source_employee_name text;
  v_new_target_employee_id integer;
  v_new_target_employee_name text;
  v_recorded_decision text;
  v_approval_count integer;
  v_source_day_number integer;
  v_target_day_number integer;
  v_source_date date;
  v_target_date date;
  v_amsterdam_now timestamp without time zone;
  v_source_snapshot jsonb;
  v_target_snapshot jsonb;
  v_system_message_id bigint;
begin
  if p_request_id is null or p_user_id is null then
    return jsonb_build_object(
      'status', 'invalid',
      'completed', false,
      'source_shift_id', null,
      'target_shift_id', null,
      'error_code', 'invalid_actor_or_request'
    );
  end if;

  if p_decision is null or p_decision not in ('accepted', 'declined') then
    return jsonb_build_object(
      'status', 'invalid',
      'completed', false,
      'source_shift_id', null,
      'target_shift_id', null,
      'error_code', 'invalid_decision'
    );
  end if;

  select request_row.*
  into v_request
  from planner20_shift_exchange_requests as request_row
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'not_found',
      'completed', false,
      'source_shift_id', null,
      'target_shift_id', null,
      'error_code', 'request_not_found'
    );
  end if;

  if p_user_id = v_request.initiator_user_id then
    v_expected_employee_id := v_request.initiator_employee_id;
  elsif p_user_id = v_request.counterparty_user_id then
    v_expected_employee_id := v_request.counterparty_employee_id;
  else
    return jsonb_build_object(
      'status', v_request.status,
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'actor_not_a_party'
    );
  end if;

  if p_employee_id is distinct from v_expected_employee_id then
    return jsonb_build_object(
      'status', v_request.status,
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'actor_employee_mismatch'
    );
  end if;

  v_amsterdam_now := timezone('Europe/Amsterdam', now());

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'status', v_request.status,
      'completed', true,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', null
    );
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object(
      'status', v_request.status,
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'request_not_pending'
    );
  end if;

  if v_request.expires_at <= now() then
    update planner20_shift_exchange_requests
    set status = 'expired'
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'expired',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'request_expired'
    );
  end if;

  insert into planner20_shift_exchange_approvals (
    request_id,
    actor_user_id,
    actor_employee_id,
    decision
  )
  values (
    v_request.id,
    p_user_id,
    p_employee_id,
    p_decision
  )
  on conflict (request_id, actor_user_id) do nothing;

  select approval.decision
  into v_recorded_decision
  from planner20_shift_exchange_approvals as approval
  where approval.request_id = v_request.id
    and approval.actor_user_id = p_user_id;

  if v_recorded_decision is distinct from p_decision then
    return jsonb_build_object(
      'status', v_request.status,
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'decision_already_recorded'
    );
  end if;

  if p_decision = 'declined' then
    update planner20_shift_exchange_requests
    set status = 'declined'
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'declined',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', null
    );
  end if;

  select count(distinct actor_user_id)
  into v_approval_count
  from planner20_shift_exchange_approvals
  where request_id = v_request.id
    and decision = 'accepted'
    and actor_user_id in (v_request.initiator_user_id, v_request.counterparty_user_id);

  if v_approval_count < 2 then
    return jsonb_build_object(
      'status', 'pending',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', null
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20420, 0);

  perform shift_row.id
  from planner20_shifts as shift_row
  where shift_row.id = v_request.source_shift_id
     or shift_row.id = v_request.target_shift_id
  order by shift_row.id
  for update;

  if not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee on employee.id = account.employee_id
    where account.username = v_request.initiator_user_id
      and account.employee_id is not distinct from v_request.initiator_employee_id
      and (account.employee_id is null or employee.is_active = 1)
  ) or not exists (
    select 1
    from planner20_users as account
    left join planner20_employees as employee on employee.id = account.employee_id
    where account.username = v_request.counterparty_user_id
      and account.employee_id is not distinct from v_request.counterparty_employee_id
      and (account.employee_id is null or employee.is_active = 1)
  ) then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'inactive_party', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'inactive_party'
    );
  end if;

  if v_request.kind = 'takeover' then
    if v_request.initiator_employee_id is not null
       and v_request.initiator_employee_id is distinct from v_request.source_employee_id
       and v_request.counterparty_employee_id is not distinct from v_request.source_employee_id then
      v_new_source_employee_id := v_request.initiator_employee_id;
    elsif v_request.counterparty_employee_id is not null
       and v_request.counterparty_employee_id is distinct from v_request.source_employee_id
       and v_request.initiator_employee_id is not distinct from v_request.source_employee_id then
      v_new_source_employee_id := v_request.counterparty_employee_id;
    else
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'invalid_takeover_parties', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'invalid_takeover_parties'
      );
    end if;
  else
    if v_request.source_employee_id is null
       or v_request.target_employee_id is null
       or v_request.source_employee_id = v_request.target_employee_id
       or not (
         (
           v_request.initiator_employee_id = v_request.source_employee_id
           and v_request.counterparty_employee_id = v_request.target_employee_id
         )
         or
         (
           v_request.initiator_employee_id = v_request.target_employee_id
           and v_request.counterparty_employee_id = v_request.source_employee_id
         )
       ) then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'invalid_swap_parties', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'invalid_swap_parties'
      );
    end if;

    v_new_source_employee_id := v_request.target_employee_id;
    v_new_target_employee_id := v_request.source_employee_id;
  end if;

  select shift_row.*
  into v_source_shift
  from planner20_shifts as shift_row
  where shift_row.id = v_request.source_shift_id;

  if not found then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_shift_missing', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_shift_missing'
    );
  end if;

  if lower(trim(v_source_shift.shift_type)) in ('verlof', 'vakantie', 'verzuim') then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_shift_not_exchangeable', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_shift_not_exchangeable'
    );
  end if;

  if v_request.kind = 'swap' then
    select shift_row.*
    into v_target_shift
    from planner20_shifts as shift_row
    where shift_row.id = v_request.target_shift_id;

    if not found then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_shift_missing', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_shift_missing'
      );
    end if;

    if lower(trim(v_target_shift.shift_type)) in ('verlof', 'vakantie', 'verzuim') then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_shift_not_exchangeable', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_shift_not_exchangeable'
      );
    end if;
  end if;

  if v_source_shift.assignment_version <> v_request.source_assignment_version
     or v_source_shift.employee_id is distinct from v_request.source_employee_id then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_assignment_changed', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_assignment_changed'
    );
  end if;

  if v_request.kind = 'swap'
     and (
       v_target_shift.assignment_version <> v_request.target_assignment_version
       or v_target_shift.employee_id is distinct from v_request.target_employee_id
     ) then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'target_assignment_changed', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'target_assignment_changed'
    );
  end if;

  v_source_snapshot := jsonb_build_object(
    'week_number', v_source_shift.week_number,
    'year', v_source_shift.year,
    'day_of_week', v_source_shift.day_of_week,
    'shift_type', v_source_shift.shift_type,
    'start_time', v_source_shift.start_time,
    'end_time', v_source_shift.end_time,
    'full_day', v_source_shift.full_day,
    'break_minutes', coalesce(to_jsonb(v_source_shift) -> 'break_minutes', '0'::jsonb),
    'location', v_source_shift.location
  );

  if v_source_snapshot is distinct from v_request.source_shift_snapshot then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_snapshot_changed', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_snapshot_changed'
    );
  end if;

  if v_request.kind = 'swap' then
    v_target_snapshot := jsonb_build_object(
      'week_number', v_target_shift.week_number,
      'year', v_target_shift.year,
      'day_of_week', v_target_shift.day_of_week,
      'shift_type', v_target_shift.shift_type,
      'start_time', v_target_shift.start_time,
      'end_time', v_target_shift.end_time,
      'full_day', v_target_shift.full_day,
      'break_minutes', coalesce(to_jsonb(v_target_shift) -> 'break_minutes', '0'::jsonb),
      'location', v_target_shift.location
    );

    if v_target_snapshot is distinct from v_request.target_shift_snapshot then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_snapshot_changed', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_snapshot_changed'
      );
    end if;
  end if;

  select employee.name
  into v_new_source_employee_name
  from planner20_employees as employee
  where employee.id = v_new_source_employee_id
    and employee.is_active = 1;

  if not found then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_assignee_inactive', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_assignee_inactive'
    );
  end if;

  if v_request.kind = 'swap' then
    select employee.name
    into v_new_target_employee_name
    from planner20_employees as employee
    where employee.id = v_new_target_employee_id
      and employee.is_active = 1;

    if not found then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_assignee_inactive', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_assignee_inactive'
      );
    end if;
  end if;

  v_source_day_number := case lower(v_source_shift.day_of_week)
    when 'maandag' then 1
    when 'dinsdag' then 2
    when 'woensdag' then 3
    when 'donderdag' then 4
    when 'vrijdag' then 5
    when 'zaterdag' then 6
    when 'zondag' then 7
    else null
  end;

  if v_source_day_number is null then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'invalid_source_day', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'invalid_source_day'
    );
  end if;

  v_source_date := to_date(
    format('%s-%s-%s', v_source_shift.year, lpad(v_source_shift.week_number::text, 2, '0'), v_source_day_number),
    'IYYY-IW-ID'
  );

  -- A shift is future-only in Amsterdam; an untimed or full-day shift has started at midnight.
  if v_source_date < v_amsterdam_now::date
     or (
       v_source_date = v_amsterdam_now::date
       and (
         v_source_shift.start_time is null
         or v_source_shift.full_day = 1
         or v_source_date + v_source_shift.start_time <= v_amsterdam_now
       )
     ) then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_shift_not_future', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_shift_not_future'
    );
  end if;

  if exists (
    select 1
    from planner20_shifts as existing_shift
    where existing_shift.employee_id = v_new_source_employee_id
      and existing_shift.id <> v_source_shift.id
      and (v_request.target_shift_id is null or existing_shift.id <> v_request.target_shift_id)
      and existing_shift.year = v_source_shift.year
      and existing_shift.week_number = v_source_shift.week_number
      and existing_shift.day_of_week = v_source_shift.day_of_week
      and (
        existing_shift.full_day = 1
        or v_source_shift.full_day = 1
        or existing_shift.start_time is null
        or existing_shift.end_time is null
        or v_source_shift.start_time is null
        or v_source_shift.end_time is null
        or (
          existing_shift.start_time < v_source_shift.end_time
          and existing_shift.end_time > v_source_shift.start_time
        )
      )
  ) then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_overlap', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_overlap'
    );
  end if;

  if exists (
    select 1
    from planner20_leave_requests as leave_request
    where leave_request.employee_id = v_new_source_employee_id
      and leave_request.status = 'approved'
      and v_source_date between leave_request.start_date and leave_request.end_date
  ) then
    update planner20_shift_exchange_requests
    set status = 'conflict', conflict_code = 'source_approved_leave', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'status', 'conflict',
      'completed', false,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id,
      'error_code', 'source_approved_leave'
    );
  end if;

  if v_request.kind = 'swap' then
    v_target_day_number := case lower(v_target_shift.day_of_week)
      when 'maandag' then 1
      when 'dinsdag' then 2
      when 'woensdag' then 3
      when 'donderdag' then 4
      when 'vrijdag' then 5
      when 'zaterdag' then 6
      when 'zondag' then 7
      else null
    end;

    if v_target_day_number is null then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'invalid_target_day', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'invalid_target_day'
      );
    end if;

    v_target_date := to_date(
      format('%s-%s-%s', v_target_shift.year, lpad(v_target_shift.week_number::text, 2, '0'), v_target_day_number),
      'IYYY-IW-ID'
    );

    if v_target_date < v_amsterdam_now::date
       or (
         v_target_date = v_amsterdam_now::date
         and (
           v_target_shift.start_time is null
           or v_target_shift.full_day = 1
           or v_target_date + v_target_shift.start_time <= v_amsterdam_now
         )
       ) then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_shift_not_future', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_shift_not_future'
      );
    end if;

    if exists (
      select 1
      from planner20_shifts as existing_shift
      where existing_shift.employee_id = v_new_target_employee_id
        and existing_shift.id <> v_target_shift.id
        and existing_shift.id <> v_source_shift.id
        and existing_shift.year = v_target_shift.year
        and existing_shift.week_number = v_target_shift.week_number
        and existing_shift.day_of_week = v_target_shift.day_of_week
        and (
          existing_shift.full_day = 1
          or v_target_shift.full_day = 1
          or existing_shift.start_time is null
          or existing_shift.end_time is null
          or v_target_shift.start_time is null
          or v_target_shift.end_time is null
          or (
            existing_shift.start_time < v_target_shift.end_time
            and existing_shift.end_time > v_target_shift.start_time
          )
        )
    ) then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_overlap', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_overlap'
      );
    end if;

    if exists (
      select 1
      from planner20_leave_requests as leave_request
      where leave_request.employee_id = v_new_target_employee_id
        and leave_request.status = 'approved'
        and v_target_date between leave_request.start_date and leave_request.end_date
    ) then
      update planner20_shift_exchange_requests
      set status = 'conflict', conflict_code = 'target_approved_leave', updated_at = now()
      where id = v_request.id;

      return jsonb_build_object(
        'status', 'conflict',
        'completed', false,
        'source_shift_id', v_request.source_shift_id,
        'target_shift_id', v_request.target_shift_id,
        'error_code', 'target_approved_leave'
      );
    end if;
  end if;

  if v_request.kind = 'takeover' then
    update planner20_shifts
    set employee_id = v_new_source_employee_id,
        employee_name = v_new_source_employee_name,
        is_open = 0,
        open_invite_emp_id = null,
        open_invite_status = 'accepted',
        assignment_version = assignment_version + 1
    where id = v_source_shift.id;
  else
    update planner20_shifts
    set employee_id = case
          when id = v_source_shift.id then v_new_source_employee_id
          when id = v_target_shift.id then v_new_target_employee_id
        end,
        employee_name = case
          when id = v_source_shift.id then v_new_source_employee_name
          when id = v_target_shift.id then v_new_target_employee_name
        end,
        assignment_version = assignment_version + 1
    where id in (v_source_shift.id, v_target_shift.id);
  end if;

  update planner20_shift_exchange_requests
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = v_request.id;

  insert into planner20_team_messages (
    conversation_id,
    message_type,
    body,
    sender_display_name,
    client_nonce,
    system_event_key
  )
  values (
    v_request.conversation_id,
    'system',
    case
      when v_request.kind = 'takeover' then 'De dienstovername is bevestigd en in het rooster verwerkt.'
      else 'De dienstenruil is bevestigd en in het rooster verwerkt.'
    end,
    'Planningwacht',
    v_request.id,
    v_request.id
  )
  on conflict (system_event_key) do nothing
  returning id into v_system_message_id;

  if v_system_message_id is null then
    select message.id
    into v_system_message_id
    from planner20_team_messages as message
    where message.system_event_key = v_request.id;
  end if;

  insert into planner20_planning_chat_events (
    correlation_id,
    conversation_id,
    request_id,
    message_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_request.id,
    v_request.conversation_id,
    v_request.id,
    v_system_message_id,
    p_user_id,
    'shift_exchange_completed',
    jsonb_build_object(
      'kind', v_request.kind,
      'source_shift_id', v_request.source_shift_id,
      'target_shift_id', v_request.target_shift_id
    )
  )
  on conflict (correlation_id, event_type) do nothing;

  return jsonb_build_object(
    'status', 'completed',
    'completed', true,
    'source_shift_id', v_request.source_shift_id,
    'target_shift_id', v_request.target_shift_id,
    'error_code', null
  );
end
$function$;

revoke all on function public.planner20_respond_to_shift_exchange(uuid, text, integer, text) from public;
revoke execute on function public.planner20_respond_to_shift_exchange(uuid, text, integer, text) from anon, authenticated;
grant execute on function public.planner20_respond_to_shift_exchange(uuid, text, integer, text) to service_role;

create or replace function public.planner20_manage_team_conversation(
  p_actor_user_id text,
  p_conversation_id bigint,
  p_kind text,
  p_name text,
  p_member_user_ids text[],
  p_owner_user_ids text[],
  p_archived boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_actor_role text;
  v_conversation planner20_team_conversations%rowtype;
  v_conversation_id bigint;
  v_members text[];
  v_owners text[];
  v_member_count integer;
begin
  select role into v_actor_role
  from planner20_users
  where username = p_actor_user_id;

  if v_actor_role is null then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'ACTIVE_ACCOUNT_REQUIRED', 'conversation_id', null);
  end if;

  if p_conversation_id is not null then
    select * into v_conversation
    from planner20_team_conversations
    where id = p_conversation_id
    for update;

    if not found then
      return jsonb_build_object('status', 'not_found', 'error_code', 'CONVERSATION_NOT_FOUND', 'conversation_id', null);
    end if;
  end if;

  if v_actor_role <> 'admin'
     and not exists (
       select 1 from planner20_team_chat_managers
       where user_id = p_actor_user_id and inactive_at is null
     )
     and not (
       p_conversation_id is not null
       and exists (
         select 1 from planner20_team_conversation_members
         where conversation_id = p_conversation_id
           and user_id = p_actor_user_id
           and member_role = 'owner'
           and inactive_at is null
       )
     ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'TEAM_CHAT_MANAGEMENT_REQUIRED', 'conversation_id', null);
  end if;

  if p_conversation_id is null
     and v_actor_role <> 'admin'
     and not exists (
       select 1 from planner20_team_chat_managers
       where user_id = p_actor_user_id and inactive_at is null
     ) then
    return jsonb_build_object('status', 'forbidden', 'error_code', 'TEAM_CHAT_MANAGEMENT_REQUIRED', 'conversation_id', null);
  end if;

  if p_conversation_id is not null and v_conversation.is_fixed then
    return jsonb_build_object('status', 'invalid', 'error_code', 'FIXED_CHANNEL_IMMUTABLE', 'conversation_id', null);
  end if;

  if p_kind not in ('direct', 'group') or length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    return jsonb_build_object('status', 'invalid', 'error_code', 'INVALID_CONVERSATION_INPUT', 'conversation_id', null);
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into v_members
  from (
    select distinct trim(member_id) as value
    from unnest(coalesce(p_member_user_ids, '{}'::text[])) as member_id
    where trim(member_id) <> ''
  ) normalized_members;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into v_owners
  from (
    select distinct trim(owner_id) as value
    from unnest(coalesce(p_owner_user_ids, '{}'::text[])) as owner_id
    where trim(owner_id) <> ''
  ) normalized_owners;

  v_member_count := cardinality(v_members);
  if (p_kind = 'direct' and v_member_count <> 2)
     or (p_kind = 'group' and v_member_count < 2)
     or cardinality(v_owners) < 1
     or exists (select 1 from unnest(v_owners) owner_id where not owner_id = any(v_members)) then
    return jsonb_build_object('status', 'invalid', 'error_code', 'INVALID_CONVERSATION_MEMBERS', 'conversation_id', null);
  end if;

  if (select count(*) from planner20_users where username = any(v_members)) <> v_member_count then
    return jsonb_build_object('status', 'invalid', 'error_code', 'UNKNOWN_CONVERSATION_MEMBER', 'conversation_id', null);
  end if;

  if p_conversation_id is null then
    insert into planner20_team_conversations (
      kind, slug, name, description, is_fixed, status, owner_user_id,
      created_by_user_id, archived_at
    )
    values (
      p_kind, null, trim(p_name), '', false,
      case when p_archived then 'archived' else 'active' end,
      v_owners[1], p_actor_user_id,
      case when p_archived then now() else null end
    )
    returning id into v_conversation_id;
  else
    v_conversation_id := p_conversation_id;
    update planner20_team_conversations
    set kind = p_kind,
        name = trim(p_name),
        owner_user_id = v_owners[1],
        status = case when p_archived then 'archived' else 'active' end,
        archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
        updated_at = now()
    where id = v_conversation_id;
  end if;

  insert into planner20_team_conversation_members (
    conversation_id, user_id, employee_id, member_role, inactive_at
  )
  select
    v_conversation_id,
    account.username,
    account.employee_id,
    case when account.username = any(v_owners) then 'owner' else 'member' end,
    null
  from planner20_users account
  where account.username = any(v_members)
  on conflict (conversation_id, user_id) do update
  set employee_id = excluded.employee_id,
      member_role = excluded.member_role,
      inactive_at = null,
      updated_at = now();

  update planner20_team_conversation_members
  set inactive_at = coalesce(inactive_at, now()),
      updated_at = now()
  where conversation_id = v_conversation_id
    and not (user_id = any(v_members));

  return jsonb_build_object(
    'status', case when p_conversation_id is null then 'created' else 'updated' end,
    'error_code', null,
    'conversation_id', v_conversation_id
  );
end
$function$;

revoke all on function public.planner20_manage_team_conversation(text, bigint, text, text, text[], text[], boolean) from public;
revoke execute on function public.planner20_manage_team_conversation(text, bigint, text, text, text[], text[], boolean) from anon, authenticated;
grant execute on function public.planner20_manage_team_conversation(text, bigint, text, text, text[], text[], boolean) to service_role;
