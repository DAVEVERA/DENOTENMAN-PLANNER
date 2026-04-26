-- Migration: Create backup_log table for tracking backup/restore operations
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/mhzmithddcdnouvlklev/sql

CREATE TABLE IF NOT EXISTS planner20_backup_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,          -- 'export' | 'import'
  performed_by TEXT NOT NULL,
  record_counts JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow service role full access
ALTER TABLE planner20_backup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on backup_log"
  ON planner20_backup_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
