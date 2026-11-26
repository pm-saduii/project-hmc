-- Customer logo of a project (a small PNG data URL set in Project Settings), shown on reports.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logo text NOT NULL DEFAULT '';
