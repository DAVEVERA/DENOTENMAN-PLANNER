-- 005_hour_submissions.sql
-- Add employee self-service hour submission with approval workflow
-- Mirrors the expense_claims approval pattern

ALTER TABLE planner20_time_logs
  ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS reviewed_by      TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note      TEXT;

-- Index for admin review queue (pending submissions)
CREATE INDEX IF NOT EXISTS idx_time_logs_submission_status
  ON planner20_time_logs (submission_status)
  WHERE submission_status = 'pending';
