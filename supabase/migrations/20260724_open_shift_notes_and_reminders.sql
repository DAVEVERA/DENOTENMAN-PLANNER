-- Privénotities en idempotente herinneringen voor open diensten.
-- Dataveiligheid: deze migratie is uitsluitend additief en verwijdert geen bestaande rijen of kolommen.

alter table planner20_shifts
  add column if not exists open_note text,
  add column if not exists open_note_author_employee_id integer references planner20_employees(id) on delete set null,
  add column if not exists opened_at timestamptz;

alter table planner20_push_subscriptions
  alter column employee_id drop not null,
  add column if not exists user_id text;

create index if not exists planner20_push_subscriptions_user
  on planner20_push_subscriptions (user_id);

update planner20_shifts
set opened_at = created_at
where is_open = 1 and opened_at is null;

create table if not exists planner20_open_shift_reminders (
  id               bigserial   primary key,
  shift_id         integer     not null references planner20_shifts(id) on delete cascade,
  reminder_stage   text        not null check (reminder_stage in ('one_and_half_weeks', 'two_weeks')),
  status           text        not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  claimed_at       timestamptz not null default now(),
  email_sent_at    timestamptz,
  push_sent_at     timestamptz,
  completed_at     timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  unique (shift_id, reminder_stage)
);

create index if not exists planner20_open_shift_reminders_status
  on planner20_open_shift_reminders (status, claimed_at);

create or replace function planner20_claim_open_shift_reminders()
returns table (event_id bigint, shift_id integer, reminder_stage text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  with candidates as (
    select
      s.id as shift_id,
      case
        when coalesce(s.opened_at, s.created_at) <= now() - interval '14 days'
          then 'two_weeks'
        else 'one_and_half_weeks'
      end as reminder_stage
    from planner20_shifts s
    where s.is_open = 1
      and coalesce(s.opened_at, s.created_at) <= now() - interval '10 days 12 hours'
  ),
  inserted as (
    insert into planner20_open_shift_reminders (shift_id, reminder_stage)
    select c.shift_id, c.reminder_stage
    from candidates c
    on conflict (shift_id, reminder_stage) do nothing
    returning planner20_open_shift_reminders.id, planner20_open_shift_reminders.shift_id, planner20_open_shift_reminders.reminder_stage
  ),
  reclaimed as (
    update planner20_open_shift_reminders r
    set status = 'processing', claimed_at = now(), last_error = null
    from candidates c
    where r.shift_id = c.shift_id
      and r.reminder_stage = c.reminder_stage
      and (
        r.status = 'failed'
        or (r.status = 'processing' and r.claimed_at < now() - interval '1 hour')
      )
    returning r.id, r.shift_id, r.reminder_stage
  )
  select i.id, i.shift_id, i.reminder_stage from inserted i
  union all
  select r.id, r.shift_id, r.reminder_stage from reclaimed r;
end;
$$;

revoke all on function planner20_claim_open_shift_reminders() from public;
grant execute on function planner20_claim_open_shift_reminders() to service_role;
