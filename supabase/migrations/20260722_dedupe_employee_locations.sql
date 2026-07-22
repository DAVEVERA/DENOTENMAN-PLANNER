-- Dedupe employees that work both locations (docs/DEBUGFILE_PRIORITY_ONE.md, issue 1)
--
-- Root cause: employees working both locations were entered as two rows
-- (a short-name "base" row and a "Firstname Lastname" markt-only row with the
-- same email) instead of one row with location = 'both', which the app
-- already supports (pages/api/employees/index.ts already queries
-- `location.eq.<loc>,location.eq.both`).
--
-- Verified before writing this migration (see docs/backups/pre-dedupe-snapshot-*.json
-- for the full pre-migration data snapshot):
--   - None of the 13 rows deleted below have ANY linked rows in any
--     referencing table (shifts, time_logs, leave_requests, expense_claims,
--     employee_documents, employee_profiles, push_subscriptions,
--     open_shift_claims, users, patterns, conflicts, meetings). The guard
--     below re-checks this at migration time and aborts if it no longer holds.
--   - contract_hours on surviving rows is left untouched (some are 0 —
--     tracked separately as a manual follow-up, not guessed at here).
--   - The two inactive location='both' rows for "dave" (id 15, 16) are
--     personal/test accounts, not real employee duplicates, and are left
--     untouched.

do $$
declare
  linked_count integer;
begin
  select
    (select count(*) from planner20_shifts where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_shifts where open_invite_emp_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_time_logs where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_leave_requests where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_expense_claims where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_employee_profiles where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_employee_documents where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_push_subscriptions where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_open_shift_claims where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_users where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_patterns where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_conflicts where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  + (select count(*) from planner20_meetings where employee_id in (109,106,103,104,105,110,108,111,107,101,102,2,3))
  into linked_count;

  if linked_count > 0 then
    raise exception 'dedupe guard: % linked row(s) found on employee ids scheduled for deletion; aborting to avoid data loss', linked_count;
  end if;
end $$;

-- Mark cross-location employees as location = 'both' on their canonical row
update planner20_employees set location = 'both'
where id in (10, 11, 9, 12, 203); -- Giel, Troy, Twan, Stijn, Jip

-- Fix trailing-space name on Jip's canonical row (id 203)
update planner20_employees set name = 'Jip' where id = 203 and name = 'Jip ';

-- Sync the same stray trailing-space name on historical shift/leave rows
update planner20_shifts set employee_name = 'Jip' where employee_id = 203 and employee_name = 'Jip ';
update planner20_leave_requests set employee_name = 'Jip' where employee_id = 203 and employee_name = 'Jip ';

-- Remove the orphaned duplicate/legacy rows (zero linked data, confirmed above)
delete from planner20_employees
where id in (109, 106, 103, 104, 105, 110, 108, 111, 107, 101, 102, 2, 3);
