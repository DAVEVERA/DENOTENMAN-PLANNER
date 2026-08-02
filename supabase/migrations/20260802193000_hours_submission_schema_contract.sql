-- Read-only release gate for the employee shift-hours write contract.
-- Additive only: no existing table, row or column value is changed.

create or replace function public.planner20_verify_hours_submission_schema(target_table text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with contract as (
    select
      (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and (
            (column_name in ('planned_clock_in', 'planned_clock_out') and data_type = 'time without time zone')
            or (column_name in ('planned_break_minutes', 'submission_revision') and data_type = 'integer')
            or (column_name = 'confirmation_mode' and data_type = 'text')
            or (column_name = 'submitted_at' and data_type = 'timestamp with time zone')
          )
      )::integer as required_columns,
      (
        select count(*)
        from pg_catalog.pg_constraint constraint_record
        join pg_catalog.pg_class table_record on table_record.oid = constraint_record.conrelid
        join pg_catalog.pg_namespace schema_record on schema_record.oid = table_record.relnamespace
        where schema_record.nspname = 'public'
          and table_record.relname = target_table
          and constraint_record.conname in (
            'planner20_time_logs_confirmation_mode_check',
            'planner20_time_logs_submission_revision_check'
          )
      )::integer as required_constraints,
      (
        select count(*)
        from pg_catalog.pg_indexes
        where schemaname = 'public'
          and tablename = target_table
          and indexname in (
            'planner20_time_logs_shift_revision_unique',
            'planner20_time_logs_shift_history'
          )
      )::integer as required_indexes
  )
  select jsonb_build_object(
    'ready', required_columns = 6 and required_constraints = 2 and required_indexes = 2,
    'required_columns', required_columns,
    'required_constraints', required_constraints,
    'required_indexes', required_indexes
  )
  from contract;
$function$;

revoke all on function public.planner20_verify_hours_submission_schema(text) from public, anon, authenticated;
grant execute on function public.planner20_verify_hours_submission_schema(text) to service_role;
