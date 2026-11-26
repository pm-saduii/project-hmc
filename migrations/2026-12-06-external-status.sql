-- External Status Report (semi-monthly, for the customer) – data it needs.
-- Safe to run more than once.

-- Issues: due date, impact (S Scope · T Time · C Cost · Q Quality), next action, who may see it,
-- and whether it goes to the Steering Committee (Decision / Acknowledge) with the ask.
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS due_date     date;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS impact_area  text NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS next_action  text NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS visibility   text NOT NULL DEFAULT 'External';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS steering     text NOT NULL DEFAULT '';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS steering_ask text NOT NULL DEFAULT '';

ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS due_date     date;
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS impact_area  text NOT NULL DEFAULT '';
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS visibility   text NOT NULL DEFAULT 'External';
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS steering     text NOT NULL DEFAULT '';
ALTER TABLE public.risks ADD COLUMN IF NOT EXISTS steering_ask text NOT NULL DEFAULT '';

-- Milestones: the task whose progress the milestone follows (Key Milestone Tracker).
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- One row per project per half-month ('2026-11-1' = 1–15 Nov, '2026-11-2' = 16–30 Nov).
CREATE TABLE IF NOT EXISTS public.status_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period           text NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])-[12]$'),
  report_date      date,
  overall_status   text NOT NULL DEFAULT '' CHECK (overall_status IN ('', 'Completed', 'On Track', 'At Risk', 'Delayed', 'Not Started')),
  rationale        text NOT NULL DEFAULT '',
  accomplishments  text NOT NULL DEFAULT '',
  next_steps       text NOT NULL DEFAULT '',
  sent_at          timestamptz,
  sent_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_to          text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (project_id, period)
);

CREATE OR REPLACE FUNCTION public.set_status_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_status_reports_updated_at ON public.status_reports;
CREATE TRIGGER trg_status_reports_updated_at
  BEFORE INSERT OR UPDATE ON public.status_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_status_reports_updated_at();

ALTER TABLE public.status_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_reports TO authenticated;

-- Same people as the monthly One Page report: readers of the One Page screen; written by admins and PMs of the project.
DROP POLICY IF EXISTS status_reports_select ON public.status_reports;
CREATE POLICY status_reports_select ON public.status_reports
  FOR SELECT TO authenticated
  USING (public.can_access_project_screen(project_id, 'onepage', 'read'));

DROP POLICY IF EXISTS status_reports_insert ON public.status_reports;
CREATE POLICY status_reports_insert ON public.status_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_monthly_report(project_id));

DROP POLICY IF EXISTS status_reports_update ON public.status_reports;
CREATE POLICY status_reports_update ON public.status_reports
  FOR UPDATE TO authenticated
  USING (public.can_edit_monthly_report(project_id))
  WITH CHECK (public.can_edit_monthly_report(project_id));

DROP POLICY IF EXISTS status_reports_delete ON public.status_reports;
CREATE POLICY status_reports_delete ON public.status_reports
  FOR DELETE TO authenticated
  USING (public.can_edit_monthly_report(project_id));
