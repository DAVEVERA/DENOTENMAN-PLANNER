-- ============================================================
-- DeNotenman Planner — Database Migraties
-- Uitvoeren in Supabase SQL Editor (eenmalig)
-- Datum: 2026-04-28
-- Probleem: "null value in column 'employee_id' of relation 'planner20_shifts' violates not-null constraint" bij het aanmaken van Open Diensten.
-- ============================================================

-- Maak employee_id optioneel, zodat we open diensten kunnen plannen zonder medewerker
ALTER TABLE planner20_shifts
  ALTER COLUMN employee_id DROP NOT NULL;
