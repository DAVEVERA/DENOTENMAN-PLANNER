-- planner20_employees
create table if not exists planner20_employees (
  id                serial      primary key,
  name              text        not null,
  email             text,
  phone             text,
  contract_hours    numeric     not null default 24,
  is_active         smallint    not null default 1,
  user_level        text        not null default 'Medewerker',
  team_group        text,
  location          text        not null default 'markt',
  hourly_rate       numeric,
  last_meeting_date date,
  next_meeting_date date,
  invite_sent_at    timestamptz,
  invite_pending    boolean     not null default false
);
alter table planner20_employees add column if not exists location          text        not null default 'markt';
alter table planner20_employees add column if not exists hourly_rate       numeric;
alter table planner20_employees add column if not exists invite_sent_at    timestamptz;
alter table planner20_employees add column if not exists invite_pending    boolean     not null default false;

create index if not exists planner20_employees_active on planner20_employees (is_active, name);

-- planner20_shifts
create table if not exists planner20_shifts (
  id                  serial      primary key,
  employee_id         integer     references planner20_employees(id) on delete cascade,
  employee_name       text        not null,
  week_number         smallint    not null,
  year                smallint    not null,
  day_of_week         text        not null,
  shift_type          text        not null,
  start_time          time,
  end_time            time,
  full_day            smallint    not null default 0,
  buddy               text,
  note                text,
  open_note           text,
  open_note_author_employee_id integer references planner20_employees(id) on delete set null,
  opened_at           timestamptz,
  location            text        not null default 'markt',
  is_open             smallint    not null default 0,
  open_invite_emp_id  integer     references planner20_employees(id) on delete set null,
  open_invite_status  text,
  shift_category      text        not null default 'regular',
  created_by          text        not null default '',
  created_at          timestamptz not null default now()
);
alter table planner20_shifts add column if not exists location           text     not null default 'markt';
alter table planner20_shifts add column if not exists is_open            smallint not null default 0;
alter table planner20_shifts add column if not exists open_invite_emp_id integer  references planner20_employees(id) on delete set null;
alter table planner20_shifts add column if not exists open_invite_status text;
alter table planner20_shifts add column if not exists shift_category     text     not null default 'regular';
alter table planner20_shifts add column if not exists open_note          text;
alter table planner20_shifts add column if not exists open_note_author_employee_id integer references planner20_employees(id) on delete set null;
alter table planner20_shifts add column if not exists opened_at          timestamptz;

create index if not exists planner20_shifts_week     on planner20_shifts (week_number, year);
create index if not exists planner20_shifts_employee on planner20_shifts (employee_id, week_number, year);
create index if not exists planner20_shifts_open     on planner20_shifts (is_open) where is_open = 1;

-- planner20_open_shift_claims
create table if not exists planner20_open_shift_claims (
  id            serial      primary key,
  shift_id      integer     not null references planner20_shifts(id) on delete cascade,
  employee_id   integer     not null references planner20_employees(id) on delete cascade,
  employee_name text        not null,
  status        text        not null default 'pending',
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists planner20_open_shift_claims_active_unique
  on planner20_open_shift_claims (shift_id, employee_id)
  where status in ('pending', 'accepted');
create index if not exists planner20_open_shift_claims_shift
  on planner20_open_shift_claims (shift_id, status, created_at);
create index if not exists planner20_open_shift_claims_employee
  on planner20_open_shift_claims (employee_id, status, created_at desc);

-- Idempotente herinneringen voor diensten die lang openstaan
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

-- planner20_patterns
create table if not exists planner20_patterns (
  id               serial      primary key,
  employee_id      integer     not null references planner20_employees(id) on delete cascade,
  employee_name    text        not null,
  day_of_week      text        not null,
  shift_type       text        not null,
  start_time       time,
  end_time         time,
  confidence_score numeric     not null default 0,
  is_approved      smallint    not null default 0,
  is_active        smallint    not null default 1,
  approved_by      text,
  approved_at      timestamptz,
  constraint planner20_patterns_unique unique (employee_id, day_of_week, shift_type, start_time)
);

-- planner20_conflicts
create table if not exists planner20_conflicts (
  id            serial      primary key,
  week_number   smallint    not null,
  year          smallint    not null,
  conflict_type text        not null,
  employee_id   integer     references planner20_employees(id) on delete set null,
  day_of_week   text,
  description   text        not null,
  severity      text        not null default 'medium',
  is_resolved   smallint    not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists planner20_conflicts_week on planner20_conflicts (week_number, year, is_resolved);

-- planner20_meetings
create table if not exists planner20_meetings (
  id               serial      primary key,
  employee_id      integer     not null references planner20_employees(id) on delete cascade,
  scheduled_date   date        not null,
  scheduled_time   time        not null,
  duration_minutes integer     not null default 30,
  status           text        not null default 'scheduled',
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists planner20_meetings_date on planner20_meetings (scheduled_date, status);

-- planner20_time_logs
create table if not exists planner20_time_logs (
  id              serial      primary key,
  employee_id     integer     not null references planner20_employees(id) on delete cascade,
  employee_name   text        not null,
  log_date        date        not null,
  location        text        not null default 'markt',
  clock_in        time,
  clock_out       time,
  break_minutes   integer     not null default 0,
  overtime_hours  numeric     not null default 0,
  shift_id        integer     references planner20_shifts(id) on delete set null,
  note            text,
  is_processed    smallint    not null default 0,
  processed_at    timestamptz,
  submission_status text      not null default 'direct',
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_note     text,
  created_by      text        not null default '',
  created_at      timestamptz not null default now()
);
alter table planner20_time_logs add column if not exists submission_status text not null default 'direct';
alter table planner20_time_logs add column if not exists reviewed_by      text;
alter table planner20_time_logs add column if not exists reviewed_at      timestamptz;
alter table planner20_time_logs add column if not exists review_note      text;

create index if not exists planner20_time_logs_date      on planner20_time_logs (log_date desc);
create index if not exists planner20_time_logs_employee  on planner20_time_logs (employee_id, log_date desc);
create index if not exists planner20_time_logs_processed on planner20_time_logs (is_processed, log_date desc);
create index if not exists idx_time_logs_submission_status
  on planner20_time_logs (submission_status)
  where submission_status = 'pending';

-- planner20_leave_requests
create table if not exists planner20_leave_requests (
  id            serial      primary key,
  employee_id   integer     not null references planner20_employees(id) on delete cascade,
  employee_name text        not null,
  leave_type    text        not null,
  start_date    date        not null,
  end_date      date        not null,
  note          text,
  status        text        not null default 'pending',
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists planner20_leave_requests_employee on planner20_leave_requests (employee_id, created_at desc);
create index if not exists planner20_leave_requests_status   on planner20_leave_requests (status, start_date);

-- planner20_employee_profiles
-- voorkeur_planning is JSONB (VoorkeurPlanning object), avatar_url is server-generated (niet opgeslagen)
create table if not exists planner20_employee_profiles (
  id                serial      primary key,
  employee_id       integer     not null unique references planner20_employees(id) on delete cascade,
  voornaam          text,
  achternaam        text,
  adres             text,
  postcode          text,
  stad              text,
  ice_contact       text,
  geboortedatum     date,
  geboorteplaats    text,
  land_van_herkomst text        not null default 'Nederland',
  bijzonderheden    text,
  voorkeur_planning jsonb,
  avatar_path       text,
  updated_at        timestamptz not null default now()
);

-- planner20_employee_documents
create table if not exists planner20_employee_documents (
  id           serial      primary key,
  employee_id  integer     not null references planner20_employees(id) on delete cascade,
  doc_type     text        not null,
  filename     text        not null,
  storage_path text        not null,
  file_size    integer,
  mime_type    text,
  uploaded_by  text        not null default '',
  notes        text,
  uploaded_at  timestamptz not null default now()
);
create index if not exists planner20_employee_documents_employee on planner20_employee_documents (employee_id, uploaded_at desc);

-- planner20_push_subscriptions
create table if not exists planner20_push_subscriptions (
  id          serial      primary key,
  employee_id integer     references planner20_employees(id) on delete cascade,
  user_id     text,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
alter table planner20_push_subscriptions alter column employee_id drop not null;
alter table planner20_push_subscriptions add column if not exists user_id text;
create index if not exists planner20_push_subscriptions_employee on planner20_push_subscriptions (employee_id);
create index if not exists planner20_push_subscriptions_user on planner20_push_subscriptions (user_id);

-- Seed: medewerkers
insert into planner20_employees (id, name, email, contract_hours, is_active, user_level, location)
values
  (1,  'Fedor', null, 40, 1, 'Admin',      'both'),
  (2,  'Jens',  null, 24, 1, 'Medewerker', 'markt'),
  (3,  'Jip',   null, 24, 1, 'Medewerker', 'markt'),
  (4,  'John',  null, 24, 1, 'Medewerker', 'markt'),
  (5,  'Suus',  null, 24, 1, 'Medewerker', 'markt'),
  (6,  'Tess',  null, 24, 1, 'Medewerker', 'markt'),
  (7,  'Huub',  null, 24, 1, 'Medewerker', 'markt'),
  (8,  'Mayke', null, 24, 1, 'Medewerker', 'markt'),
  (9,  'Twan',  null, 24, 1, 'Medewerker', 'markt'),
  (10, 'Giel',  null, 24, 1, 'Medewerker', 'markt'),
  (11, 'Troy',  null, 24, 1, 'Medewerker', 'markt'),
  (12, 'Stijn', null, 24, 1, 'Medewerker', 'markt')
on conflict (id) do update set
  name           = excluded.name,
  contract_hours = excluded.contract_hours,
  is_active      = excluded.is_active,
  user_level     = excluded.user_level,
  location       = excluded.location;

select setval('planner20_employees_id_seq', 205);

-- planner20_users (vervangt config/users.json — werkt in serverless/Vercel)
create table if not exists planner20_users (
  username      text primary key,
  password_hash text not null default '',
  role          text not null default 'employee',
  employee_id   integer references planner20_employees(id) on delete set null,
  display_name  text not null default ''
);

-- Eenmalige wachtwoordherstel-links voor planner20_users.
-- Alleen de SHA-256 hash van de token wordt opgeslagen; de ruwe token staat alleen in de e-mail-link.
create table if not exists planner20_password_reset_tokens (
  id          bigserial   primary key,
  username    text        not null references planner20_users(username) on delete cascade,
  token_hash  text        not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists planner20_password_reset_tokens_active
  on planner20_password_reset_tokens (username, expires_at)
  where used_at is null;

-- Seed: admin account (wachtwoord: admin123)
insert into planner20_users (username, password_hash, role, employee_id, display_name)
values (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin',
  null,
  'Administrator'
)
on conflict (username) do nothing;
