-- ============================================================
-- DeNotenman Planner — Database Migraties
-- Uitvoeren in Supabase SQL Editor (eenmalig)
-- Datum: 2026-04-24
-- ============================================================

-- AM-004: Pauzeminuten per shift (default 0 = geen pauze; 60 = -1 uur pauze)
ALTER TABLE planner20_shifts
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;

-- AM-002: Admin-only opmerking per shift (nooit teruggestuurd naar medewerkers)
ALTER TABLE planner20_shifts
  ADD COLUMN IF NOT EXISTS admin_note text;

-- AM-001: Declaratietabel (nieuw)
CREATE TABLE IF NOT EXISTS planner20_expense_claims (
  id              serial        PRIMARY KEY,
  employee_id     integer       NOT NULL REFERENCES planner20_employees(id) ON DELETE CASCADE,
  employee_name   text          NOT NULL DEFAULT '',
  claim_type      text          NOT NULL,          -- 'reiskosten' | 'overuren' | 'overig'
  amount          numeric(10,2) NOT NULL,
  description     text          NOT NULL DEFAULT '',
  claim_date      date          NOT NULL,
  reference_date  date,                            -- datum waarop gewerkt/gereden is
  shift_id        integer       REFERENCES planner20_shifts(id) ON DELETE SET NULL,
  status          text          NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_note     text,
  submitted_by    text          NOT NULL DEFAULT '',
  created_at      timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planner20_expense_claims_employee
  ON planner20_expense_claims (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS planner20_expense_claims_status
  ON planner20_expense_claims (status, created_at DESC);

-- Verificatie queries (optioneel, uitvoeren na migratie)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'planner20_shifts' ORDER BY ordinal_position;
-- SELECT COUNT(*) FROM planner20_expense_claims;

-- ============================================================
-- AM-FIX: Gebruikersaccounts naar Supabase (serverless-fix)
-- Vervangt config/users.json volledig.
-- ============================================================

CREATE TABLE IF NOT EXISTS planner20_users (
  username      text PRIMARY KEY,
  password_hash text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'employee',  -- 'admin' | 'manager' | 'employee'
  employee_id   integer REFERENCES planner20_employees(id) ON DELETE SET NULL,
  display_name  text NOT NULL DEFAULT ''
);

-- ⚠️ VERPLICHT: Seed bestaande accounts vanuit users.json
-- Voer voor elke gebruiker de volgende INSERT uit (pas waarden aan):
--
-- INSERT INTO planner20_users (username, password_hash, role, employee_id, display_name)
-- VALUES ('admin', '<hash_uit_users_json>', 'admin', NULL, 'Administrator')
-- ON CONFLICT (username) DO NOTHING;
--
-- ALTERNATIEF: Als je de hash niet weet, gebruik dan een tijdelijk wachtwoord:
-- (De hash hieronder is voor wachtwoord 'admin123')
INSERT INTO planner20_users (username, password_hash, role, employee_id, display_name)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin',
  NULL,
  'Administrator'
)
ON CONFLICT (username) DO NOTHING;

-- Verificatie
-- SELECT username, role, display_name FROM planner20_users;

