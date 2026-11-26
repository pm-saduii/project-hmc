-- Mark a task as a key milestone (External Status · Key Milestone Tracker, Gantt ◆).
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_milestone boolean NOT NULL DEFAULT false;
