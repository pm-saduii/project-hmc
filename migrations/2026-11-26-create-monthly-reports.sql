-- Monthly Executive Report (One Page menu).
-- One row per project per month: the PM's summary, decisions needed, status by area,
-- and — once published — a frozen copy of the report's numbers and lists (snapshot),
-- so the report shows the same thing at every later meeting.
--
-- Access:
--  * READ : anyone who can see the project's One Page screen.
--  * WRITE: admins, and users with the PM role who can read the project.

BEGIN;

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period          text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),   -- 'YYYY-MM'
  state           text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published')),
  summary         text NOT NULL DEFAULT '',
  decisions       text NOT NULL DEFAULT '',
  overall_status  text CHECK (overall_status  IN ('on_track', 'at_risk', 'off_track')),
  schedule_status text CHECK (schedule_status IN ('on_track', 'at_risk', 'off_track')),
  budget_status   text CHECK (budget_status   IN ('on_track', 'at_risk', 'off_track')),
  scope_status    text CHECK (scope_status    IN ('on_track', 'at_risk', 'off_track')),
  payment_status  text CHECK (payment_status  IN ('on_track', 'at_risk', 'off_track')),
  snapshot        jsonb,
  published_at    timestamptz,
  published_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT monthly_reports_project_period_key UNIQUE (project_id, period),
  CONSTRAINT monthly_reports_published_has_snapshot CHECK (state = 'draft' OR snapshot IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS monthly_reports_period_idx ON public.monthly_reports (period);

CREATE OR REPLACE FUNCTION public.set_monthly_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_reports_updated_at ON public.monthly_reports;
CREATE TRIGGER trg_monthly_reports_updated_at
  BEFORE INSERT OR UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_monthly_reports_updated_at();

-- Who may write a project's monthly report: admins, or an active PM who can read the project.
CREATE OR REPLACE FUNCTION public.can_edit_monthly_report(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'pm' AND p.is_active IS DISTINCT FROM false
      )
      AND public.can_read_project(p_project_id)
    );
$$;
REVOKE ALL ON FUNCTION public.can_edit_monthly_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_monthly_report(uuid) TO authenticated;

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;

DROP POLICY IF EXISTS monthly_reports_select ON public.monthly_reports;
CREATE POLICY monthly_reports_select ON public.monthly_reports
  FOR SELECT TO authenticated
  USING (public.can_access_project_screen(project_id, 'onepage', 'read'));

DROP POLICY IF EXISTS monthly_reports_insert ON public.monthly_reports;
CREATE POLICY monthly_reports_insert ON public.monthly_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_monthly_report(project_id));

DROP POLICY IF EXISTS monthly_reports_update ON public.monthly_reports;
CREATE POLICY monthly_reports_update ON public.monthly_reports
  FOR UPDATE TO authenticated
  USING (public.can_edit_monthly_report(project_id))
  WITH CHECK (public.can_edit_monthly_report(project_id));

DROP POLICY IF EXISTS monthly_reports_delete ON public.monthly_reports;
CREATE POLICY monthly_reports_delete ON public.monthly_reports
  FOR DELETE TO authenticated
  USING (public.can_edit_monthly_report(project_id));

COMMIT;
