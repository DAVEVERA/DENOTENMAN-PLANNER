-- ============================================================
-- DeNotenman Planner — USERS MIGRATIE
-- Kopieer en plak dit VOLLEDIG in de Supabase SQL Editor
-- ============================================================

-- Stap 1: Maak de tabel aan
CREATE TABLE IF NOT EXISTS planner20_users (
  username      text PRIMARY KEY,
  password_hash text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'employee',
  employee_id   integer REFERENCES planner20_employees(id) ON DELETE SET NULL,
  display_name  text NOT NULL DEFAULT ''
);

-- Stap 2: accounts worden uitsluitend via de applicatie of een eenmalig,
-- eigenaar-gecontroleerd provisioningproces aangemaakt. Gedeelde hashes of
-- een overschrijvende account-backfill horen niet in een migratie.

-- Stap 3: Verificatie
SELECT username, role, display_name, employee_id FROM planner20_users ORDER BY role DESC, username;
