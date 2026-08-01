-- Medewerker-eerst urenaccordatie per geplande dienst.
-- Uitsluitend additief: bestaande rijen en bestaande kolomwaarden blijven onaangetast.

alter table planner20_time_logs
  add column if not exists planned_clock_in time,
  add column if not exists planned_clock_out time,
  add column if not exists planned_break_minutes integer,
  add column if not exists confirmation_mode text,
  add column if not exists submission_revision integer,
  add column if not exists submitted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner20_time_logs_confirmation_mode_check'
      and conrelid = 'planner20_time_logs'::regclass
  ) then
    alter table planner20_time_logs
      add constraint planner20_time_logs_confirmation_mode_check
      check (confirmation_mode is null or confirmation_mode in ('confirmed', 'adjusted'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner20_time_logs_submission_revision_check'
      and conrelid = 'planner20_time_logs'::regclass
  ) then
    alter table planner20_time_logs
      add constraint planner20_time_logs_submission_revision_check
      check (submission_revision is null or submission_revision > 0);
  end if;
end $$;

-- Alleen nieuwe shift-gebonden revisies vullen submission_revision. Historische
-- rijen blijven NULL en kunnen deze index daarom nooit laten mislukken.
create unique index if not exists planner20_time_logs_shift_revision_unique
  on planner20_time_logs (shift_id, submission_revision)
  where shift_id is not null and submission_revision is not null;

create index if not exists planner20_time_logs_shift_history
  on planner20_time_logs (shift_id, created_at desc)
  where shift_id is not null;
