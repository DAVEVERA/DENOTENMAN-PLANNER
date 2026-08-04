-- Dataveilige archivering voor diensten.
-- Bestaande rijen en waarden blijven ongewijzigd; alleen expliciet verwijderde
-- diensten krijgen archiefmetadata.

alter table public.planner20_shifts
  add column if not exists archived_at timestamptz;

alter table public.planner20_shifts
  add column if not exists archived_by text;

create index if not exists planner20_shifts_active_week
  on public.planner20_shifts (week_number, year)
  where archived_at is null;

create index if not exists planner20_shifts_active_employee
  on public.planner20_shifts (employee_id, week_number, year)
  where archived_at is null;

create index if not exists planner20_shifts_active_open
  on public.planner20_shifts (is_open)
  where archived_at is null and is_open = 1;

create or replace function public.planner20_guard_active_shift_exchange()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if new.status in ('pending', 'conflict')
     and (
       exists (
         select 1
         from public.planner20_shifts as source_shift
         where source_shift.id = new.source_shift_id
           and source_shift.archived_at is not null
       )
       or (
         new.target_shift_id is not null
         and exists (
           select 1
           from public.planner20_shifts as target_shift
           where target_shift.id = new.target_shift_id
             and target_shift.archived_at is not null
         )
       )
     ) then
    raise exception using
      errcode = 'P0001',
      message = 'archived_shift_not_exchangeable';
  end if;

  return new;
end
$function$;

do $active_shift_exchange_trigger$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    join pg_catalog.pg_class as relation_row
      on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where trigger_row.tgname = 'planner20_guard_active_shift_exchange_trigger'
      and trigger_row.tgisinternal = false
      and namespace_row.nspname = 'public'
      and relation_row.relname = 'planner20_shift_exchange_requests'
  ) then
    create trigger planner20_guard_active_shift_exchange_trigger
      before insert or update of source_shift_id, target_shift_id, status
      on public.planner20_shift_exchange_requests
      for each row
      execute function public.planner20_guard_active_shift_exchange();
  end if;
end
$active_shift_exchange_trigger$;

create or replace function public.planner20_archive_shift(
  p_shift_id integer,
  p_archived_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_shift public.planner20_shifts%rowtype;
  v_archived_at timestamptz := now();
begin
  if p_shift_id is null or p_archived_by is null or trim(p_archived_by) = '' then
    raise exception using errcode = '22023', message = 'invalid_shift_archive_input';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20420, 0);

  select shift_row.*
  into v_shift
  from public.planner20_shifts as shift_row
  where shift_row.id = p_shift_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'shift_id', p_shift_id);
  end if;

  if v_shift.archived_at is not null then
    return jsonb_build_object('status', 'already_archived', 'shift_id', p_shift_id);
  end if;

  update public.planner20_shift_exchange_requests
  set status = 'cancelled',
      conflict_code = coalesce(conflict_code, 'shift_archived'),
      updated_at = v_archived_at
  where status in ('pending', 'conflict')
    and (source_shift_id = p_shift_id or target_shift_id = p_shift_id);

  update public.planner20_open_shift_claims
  set status = 'declined',
      reviewed_by = p_archived_by,
      reviewed_at = v_archived_at
  where shift_id = p_shift_id
    and status = 'pending';

  update public.planner20_shifts
  set archived_at = v_archived_at,
      archived_by = p_archived_by
  where id = p_shift_id
    and archived_at is null;

  return jsonb_build_object('status', 'archived', 'shift_id', p_shift_id);
end
$function$;

revoke all on function public.planner20_guard_active_shift_exchange()
  from public, anon, authenticated, service_role;

revoke all on function public.planner20_archive_shift(integer, text)
  from public, anon, authenticated, service_role;

grant execute on function public.planner20_archive_shift(integer, text)
  to service_role;

