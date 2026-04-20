-- Planner 2.0 — Ontbrekende tabellen (stap 2)
-- Voer dit uit in Supabase SQL Editor na create_time_logs.sql

-- ─── Leave Requests (Verlofaanvragen) ─────────────────────────────────────────
create table if not exists planner20_leave_requests (
  id              serial primary key,
  employee_id     integer      not null references planner20_employees(id) on delete cascade,
  employee_name   text         not null,
  leave_type      text         not null,  -- vakantie | verlof | verzuim | overwerk
  start_date      date         not null,
  end_date        date         not null,
  note            text,
  status          text         not null default 'pending',  -- pending | approved | rejected
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz  not null default now()
);

create index if not exists planner20_leave_requests_employee
  on planner20_leave_requests (employee_id, created_at desc);

create index if not exists planner20_leave_requests_status
  on planner20_leave_requests (status, start_date);

-- ─── Employee Profiles ────────────────────────────────────────────────────────
create table if not exists planner20_employee_profiles (
  id              serial primary key,
  employee_id     integer      not null unique references planner20_employees(id) on delete cascade,
  bio             text,
  avatar_url      text,
  iban            text,
  address         text,
  city            text,
  zipcode         text,
  date_of_birth   date,
  emergency_name  text,
  emergency_phone text,
  notes           text,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

-- ─── Employee Documents ───────────────────────────────────────────────────────
create table if not exists planner20_employee_documents (
  id              serial primary key,
  employee_id     integer      not null references planner20_employees(id) on delete cascade,
  doc_type        text         not null,  -- contract | id | certificate | other
  title           text         not null,
  file_url        text         not null,
  file_size       integer,
  mime_type       text,
  expires_at      date,
  uploaded_by     text         not null default '',
  created_at      timestamptz  not null default now()
);

create index if not exists planner20_employee_documents_employee
  on planner20_employee_documents (employee_id, created_at desc);

-- ─── Push Subscriptions (Web Push Notifications) ──────────────────────────────
create table if not exists planner20_push_subscriptions (
  id              serial primary key,
  employee_id     integer      not null references planner20_employees(id) on delete cascade,
  endpoint        text         not null unique,
  p256dh          text         not null,
  auth            text         not null,
  created_at      timestamptz  not null default now()
);

create index if not exists planner20_push_subscriptions_employee
  on planner20_push_subscriptions (employee_id);
