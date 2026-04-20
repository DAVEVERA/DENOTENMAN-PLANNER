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

create index if not exists planner20_shifts_week     on planner20_shifts (week_number, year);
create index if not exists planner20_shifts_employee on planner20_shifts (employee_id, week_number, year);
create index if not exists planner20_shifts_open     on planner20_shifts (is_open) where is_open = 1;

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
  created_by      text        not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists planner20_time_logs_date      on planner20_time_logs (log_date desc);
create index if not exists planner20_time_logs_employee  on planner20_time_logs (employee_id, log_date desc);
create index if not exists planner20_time_logs_processed on planner20_time_logs (is_processed, log_date desc);

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
  employee_id integer     not null references planner20_employees(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists planner20_push_subscriptions_employee on planner20_push_subscriptions (employee_id);

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

select setval('planner20_employees_id_seq', (select max(id) from planner20_employees));
