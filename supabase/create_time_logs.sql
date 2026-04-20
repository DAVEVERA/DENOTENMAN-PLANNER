-- Planner 2.0 — Ontbrekende tabel: planner20_time_logs
-- Voer dit uit in Supabase SQL Editor

-- ─── Time Logs (Urenregistratie) ──────────────────────────────────────────────
create table if not exists planner20_time_logs (
  id              serial primary key,
  employee_id     integer      not null references planner20_employees(id) on delete cascade,
  employee_name   text         not null,
  log_date        date         not null,
  location        text         not null default 'markt',  -- markt | nootmagazijn
  clock_in        time,
  clock_out       time,
  break_minutes   integer      not null default 0,
  overtime_hours  numeric      not null default 0,
  shift_id        integer      references planner20_shifts(id) on delete set null,
  note            text,
  is_processed    smallint     not null default 0,
  processed_at    timestamptz,
  created_by      text         not null default '',
  created_at      timestamptz  not null default now()
);

-- Indexes voor snelle queries op datum en medewerker
create index if not exists planner20_time_logs_date
  on planner20_time_logs (log_date desc);

create index if not exists planner20_time_logs_employee
  on planner20_time_logs (employee_id, log_date desc);

create index if not exists planner20_time_logs_processed
  on planner20_time_logs (is_processed, log_date desc);
