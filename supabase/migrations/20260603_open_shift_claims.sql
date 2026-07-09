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

