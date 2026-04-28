-- ============================================================
-- D'n Dave — Chat & Workflow tabellen
-- Uitvoeren in Supabase SQL Editor (eenmalig)
-- Datum: 2026-04-28
-- ============================================================

-- ── Chat berichten ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planner20_chat_messages (
  id           serial        PRIMARY KEY,
  session_id   text          NOT NULL,          -- iron-session user_id
  role         text          NOT NULL,          -- 'user' | 'assistant' | 'tool'
  content      text          NOT NULL DEFAULT '',
  tool_name    text,                             -- naam van uitgevoerd tool (als role='tool')
  tool_input   jsonb,                            -- input die naar het tool gestuurd werd
  tool_result  jsonb,                            -- wat het tool teruggaf
  created_at   timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planner20_chat_messages_session
  ON planner20_chat_messages (session_id, created_at DESC);

-- ── Opgeslagen workflows ────────────────────────────────────
CREATE TABLE IF NOT EXISTS planner20_chat_workflows (
  id           serial        PRIMARY KEY,
  name         text          NOT NULL,
  description  text          NOT NULL DEFAULT '',
  steps        jsonb         NOT NULL DEFAULT '[]', -- array van tool-aanroepen
  created_by   text          NOT NULL DEFAULT '',
  is_active    integer       NOT NULL DEFAULT 1,
  created_at   timestamptz   NOT NULL DEFAULT NOW(),
  updated_at   timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planner20_chat_workflows_active
  ON planner20_chat_workflows (is_active, created_at DESC);
