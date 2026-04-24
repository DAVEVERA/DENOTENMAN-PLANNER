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

-- Stap 2: Seed alle bestaande accounts (exact overgenomen uit users.json)
INSERT INTO planner20_users (username, password_hash, role, employee_id, display_name) VALUES
  ('admin',            '$2a$10$KqGTvYFSmBpK/pdVoVYMzO4dAKeeMpClXqHQLl0AiJ9wncfO1TcPO', 'admin',    NULL, 'Administrator'),
  ('j.smits',          '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 101,  'Jens Smits'),
  ('j.lavrijsen',      '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 102,  'Jip Lavrijsen'),
  ('j.vanhooft',       '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 103,  'John van Hooft'),
  ('s.roosen',         '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 104,  'Suus Roosen'),
  ('t.overbeek',       '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 105,  'Tess Overbeek'),
  ('h.bruggeling',     '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 106,  'Huub Bruggeling'),
  ('m.fransen',        '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 107,  'Mayke Fransen'),
  ('t.vermeer',        '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 108,  'Twan Vermeer'),
  ('g.vanhal',         '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 109,  'Giel van Hal'),
  ('t.blommensteijn',  '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 110,  'Troy Blommensteijn'),
  ('s.wolfs',          '$2a$10$ELOTkvS5AK9Zef8OBXNtMO.lG9g6u4SDOODjb1pWDbJbv7v7103Na', 'employee', 111,  'Stijn Wolfs')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role          = EXCLUDED.role,
  employee_id   = EXCLUDED.employee_id,
  display_name  = EXCLUDED.display_name;

-- Stap 3: Verificatie
SELECT username, role, display_name, employee_id FROM planner20_users ORDER BY role DESC, username;
