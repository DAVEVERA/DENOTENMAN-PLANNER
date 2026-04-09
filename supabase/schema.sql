-- Planner 2.0 — PostgreSQL schema for Supabase
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- All tables use the prefix configured in DB_PREFIX (default: planner20_)

-- ─── Employees ────────────────────────────────────────────────────────────────
create table if not exists planner20_employees (
  id                serial primary key,
  name              text        not null,
  email             text,
  phone             text,
  contract_hours    numeric     not null default 24,
  is_active         smallint    not null default 1,
  user_level        text        not null default 'Medewerker',
  team_group        text,
  last_meeting_date date,
  next_meeting_date date
);

-- ─── Shifts ───────────────────────────────────────────────────────────────────
create table if not exists planner20_shifts (
  id            serial primary key,
  employee_id   integer     not null references planner20_employees(id) on delete cascade,
  employee_name text        not null,
  week_number   smallint    not null,
  year          smallint    not null,
  day_of_week   text        not null,
  shift_type    text        not null,
  start_time    time,
  end_time      time,
  full_day      smallint    not null default 0,
  buddy         text,
  note          text,
  created_by    text        not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists planner20_shifts_week
  on planner20_shifts (week_number, year);

create index if not exists planner20_shifts_employee
  on planner20_shifts (employee_id, week_number, year);

-- ─── Patterns ─────────────────────────────────────────────────────────────────
create table if not exists planner20_patterns (
  id               serial primary key,
  employee_id      integer not null references planner20_employees(id) on delete cascade,
  employee_name    text    not null,
  day_of_week      text    not null,
  shift_type       text    not null,
  start_time       time,
  end_time         time,
  confidence_score numeric not null default 0,
  is_approved      smallint not null default 0,
  is_active        smallint not null default 1,
  approved_by      text,
  approved_at      timestamptz,
  -- Required for upsert in detectPatterns()
  constraint planner20_patterns_unique unique (employee_id, day_of_week, shift_type, start_time)
);

-- ─── Conflicts ────────────────────────────────────────────────────────────────
create table if not exists planner20_conflicts (
  id            serial primary key,
  week_number   smallint not null,
  year          smallint not null,
  conflict_type text     not null,
  employee_id   integer  references planner20_employees(id) on delete set null,
  day_of_week   text,
  description   text     not null,
  severity      text     not null default 'medium', -- low | medium | high | critical
  is_resolved   smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists planner20_conflicts_week
  on planner20_conflicts (week_number, year, is_resolved);

-- ─── Meetings ─────────────────────────────────────────────────────────────────
create table if not exists planner20_meetings (
  id                serial primary key,
  employee_id       integer not null references planner20_employees(id) on delete cascade,
  scheduled_date    date    not null,
  scheduled_time    time    not null,
  duration_minutes  integer not null default 30,
  status            text    not null default 'scheduled', -- scheduled | done | cancelled
  notes             text,
  created_at        timestamptz not null default now()
);
