-- Implementation methodology, project deliverables / phase gates, and the monthly
-- Budget Control report with its approval chain (PM → Account Manager → Director).
-- Safe to run more than once.

BEGIN;

-- ── 1. Roles: Director and Account Manager ─────────────────────────────────
-- Both read the projects they can access (role default = read only), like the other roles.
-- The screen-access helpers list the roles allowed to read by default; add the two new ones.
DO $$
DECLARE
  fn text;
  def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.can_access_project_screen(uuid,text,text)',
    'public.can_access_project_checklist(uuid,text)',
    'public.can_access_project_lessons(uuid,text)'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN CONTINUE; END IF;
    def := pg_get_functiondef(to_regprocedure(fn));
    def := replace(def, $q$p.role IN ('pm', 'member', 'client')$q$, $q$p.role IN ('pm', 'member', 'client', 'director', 'am')$q$);
    EXECUTE def;
  END LOOP;
END $$;

-- Role of the signed-in, active user ('' when none).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active IS DISTINCT FROM false), '');
$$;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Admin, or a PM who can read the project.
CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_admin()
    OR (public.current_user_role() = 'pm' AND public.can_read_project(p_project_id));
$$;
REVOKE ALL ON FUNCTION public.can_manage_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid) TO authenticated;

-- ── 2. Methodology (company standard; admins maintain it in Settings) ──────
CREATE TABLE IF NOT EXISTS public.methodology_phases (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  gate        text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.methodology_steps (
  id          text PRIMARY KEY,
  phase_id    text NOT NULL REFERENCES public.methodology_phases(id) ON DELETE CASCADE,
  name        text NOT NULL,
  owner       text NOT NULL DEFAULT 'HMC' CHECK (owner IN ('HMC', 'Client', 'Joint')),
  objective   text NOT NULL DEFAULT '',
  activities  text[] NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.methodology_deliverables (
  id               text PRIMARY KEY,
  phase_id         text NOT NULL REFERENCES public.methodology_phases(id) ON DELETE CASCADE,
  step_id          text REFERENCES public.methodology_steps(id) ON DELETE SET NULL,
  name             text NOT NULL,
  short_name       text NOT NULL DEFAULT '',
  format           text NOT NULL DEFAULT '',
  template_url     text NOT NULL DEFAULT '',
  requires_signoff boolean NOT NULL DEFAULT false,
  internal_only    boolean NOT NULL DEFAULT false,
  owner            text NOT NULL DEFAULT 'HMC' CHECK (owner IN ('HMC', 'Client', 'Joint')),
  sort_order       integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true
);

INSERT INTO public.methodology_phases (id, name, description, gate, sort_order) VALUES
  ('PS', 'Plan & Scope', 'Set the scope, plan, team and man-day budget.', 'Charter approved · Kick-off held and MOM sent · Budget baseline set', 10),
  ('DS', 'Discover', 'Gather requirements and confirm the Business Blueprint.', 'Business Blueprint signed off', 20),
  ('DV', 'Develop', 'Configure, customize and integrate the system.', 'Configuration complete per the BB · Unit tests passed · Interface spec confirmed', 30),
  ('DP', 'Deploy', 'Migrate data, test with users and prepare for go-live.', 'UAT and parallel run signed off · Go/No-Go decision is Go', 40),
  ('DL', 'Deliver', 'Go live, support and hand over.', 'Hypercare closed · Handover and closure signed', 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.methodology_steps (id, phase_id, name, owner, objective, activities, sort_order) VALUES
  ('PS1', 'PS', 'Create Project Plan', 'HMC', 'Define the scope, plan, team and initial man-day budget.', ARRAY['Create the project and its plan', 'Fill in the Charter and the schedule for every stage', 'Set the man-day budget per activity'], 10),
  ('PS2', 'PS', 'Kick-Off', 'Joint', 'Align goals, plan, roles and ways of working.', ARRAY['Prepare the Kick-off deck', 'Hold the Kick-off meeting with the sponsor', 'Send the MOM within 2 working days'], 20),
  ('PS3', 'PS', 'Cloud Preparation', 'HMC', 'Prepare the Test and Production environments.', ARRAY['Request the tenant / environments', 'Set up SSO and the network whitelist'], 30),
  ('DS1', 'DS', 'Gather Requirements', 'Joint', 'Collect all requirements and master data from the customer.', ARRAY['Run workshops per module', 'Send the BB Appendix template to the customer', 'Review the returned appendix'], 10),
  ('DS2', 'DS', 'Gap Analysis', 'Joint', 'Identify fits and gaps and how to close each gap.', ARRAY['Maintain the Fit/Gap log', 'Raise a Change Request for gaps outside the scope'], 20),
  ('DS3', 'DS', 'Confirm Business Blueprint', 'Client', 'Get the Business Blueprint confirmed and signed.', ARRAY['Complete the Business Blueprint', 'Review it with the key users', 'Sign off'], 30),
  ('DV1', 'DV', 'System Configuration', 'HMC', 'Configure the system as described in the BB.', ARRAY['Configure each module', 'Record the configuration workbook'], 10),
  ('DV2', 'DV', 'System Customization', 'HMC', 'Build the approved customizations.', ARRAY['Write the functional spec', 'Develop and test'], 20),
  ('DV3', 'DV', 'System Integration', 'Joint', 'Connect the external systems.', ARRAY['Confirm the interface spec', 'Test the integrations'], 30),
  ('DV4', 'DV', 'Unit Testing', 'HMC', 'Verify the functions before UAT.', ARRAY['Test per the test log', 'Fix defects'], 40),
  ('DP1', 'DP', 'Data Migration', 'Joint', 'Load the data into Test and Production.', ARRAY['Migration template training', 'Customer prepares the data', 'Load Test, then Production'], 10),
  ('DP2', 'DP', 'UAT', 'Joint', 'The customer tests and accepts the system.', ARRAY['Prepare the UAT scenarios', 'Customer testing', 'UAT sign-off'], 20),
  ('DP3', 'DP', 'Train the Trainer', 'Joint', 'HR and ESS users can use the system.', ARRAY['HR / ESS training', 'Record the attendees (HRM-FM-005)'], 30),
  ('DP4', 'DP', 'Payroll Parallel Run', 'Joint', 'Payroll results match before go-live.', ARRAY['Parallel run rounds 1–2', 'Go/No-Go with the steering committee'], 40),
  ('DL1', 'DL', 'Go-Live', 'Joint', 'Start live use as planned in the cut-over.', ARRAY['Cut-over', 'Go-live sign-off'], 10),
  ('DL2', 'DL', 'Post-Support (Hypercare)', 'HMC', 'Support after go-live and hand over.', ARRAY['Hypercare and the Customer Service Sheet', 'Handover and project closure'], 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.methodology_deliverables (id, phase_id, step_id, name, short_name, format, requires_signoff, internal_only, owner, sort_order) VALUES
  ('CHR',  'PS', 'PS1', 'Project Charter', 'Charter', 'Word v1.3', true, false, 'HMC', 10),
  ('PLAN', 'PS', 'PS1', 'Baseline Project Plan / RAID log', 'Plan / RAID', 'Status Tracker (Excel)', false, false, 'HMC', 20),
  ('BUD',  'PS', 'PS1', 'Budget Control – man-day baseline', 'Budget MD', 'Budget Control Report (Excel)', false, true, 'HMC', 30),
  ('KO',   'PS', 'PS2', 'Kick-off Deck', 'Kick-off Deck', 'PowerPoint', false, false, 'HMC', 40),
  ('MOMK', 'PS', 'PS2', 'Kick-off Minutes of Meeting', 'Kick-off MOM', 'MOM v1.4', false, false, 'HMC', 50),
  ('ENV',  'PS', 'PS3', 'Cloud environment ready', 'Environment', 'Checklist', false, false, 'HMC', 60),
  ('REQ',  'DS', 'DS1', 'Requirement & Fit/Gap log', 'Fit/Gap log', 'Excel log', false, false, 'Joint', 10),
  ('APX',  'DS', 'DS1', 'BB Appendix (completed by the customer)', 'BB Appendix', 'BB Appendix template', false, false, 'Client', 20),
  ('BB',   'DS', 'DS3', 'Business Blueprint + sign-off', 'Business Blueprint', 'BB + Sign-off v1.3', true, false, 'Client', 30),
  ('CFG',  'DV', 'DV1', 'Configuration workbook', 'Config workbook', 'Config workbook', false, false, 'HMC', 10),
  ('FS',   'DV', 'DV2', 'Functional design / Interface spec', 'Functional spec', 'Spec document', false, false, 'HMC', 20),
  ('UT',   'DV', 'DV4', 'Unit test result', 'Unit test', 'Test log', false, false, 'HMC', 30),
  ('MIG',  'DP', 'DP1', 'Data migration templates & load result', 'Migration', 'Migration templates', false, false, 'Joint', 10),
  ('UAT',  'DP', 'DP2', 'UAT scenarios + UAT sign-off', 'UAT', 'Sign-off v1.3', true, false, 'Joint', 20),
  ('TRN',  'DP', 'DP3', 'Training attendees + training material', 'Training', 'HRM-FM-005', false, false, 'Joint', 30),
  ('PAR',  'DP', 'DP4', 'Payroll parallel run result', 'Parallel run', 'Sign-off v1.3', true, false, 'Joint', 40),
  ('GNG',  'DP', 'DP4', 'Go / No-Go checklist', 'Go/No-Go', 'Steering committee', false, false, 'Joint', 50),
  ('GL',   'DL', 'DL1', 'Go-live sign-off', 'Go-live', 'Sign-off v1.3', true, false, 'Joint', 10),
  ('CSS',  'DL', 'DL2', 'Customer Service Sheet', 'CSS', 'CSS form', false, false, 'HMC', 20),
  ('CLS',  'DL', 'DL2', 'Hypercare closure / Handover', 'Closure', 'Sign-off v1.3', true, false, 'Joint', 30)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.methodology_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_deliverables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.methodology_phases, public.methodology_steps, public.methodology_deliverables FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.methodology_phases, public.methodology_steps, public.methodology_deliverables TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['methodology_phases', 'methodology_steps', 'methodology_deliverables'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())', t || '_admin_write', t);
  END LOOP;
END $$;

-- ── 3. Deliverables and phase gates per project ────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_deliverables (
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  deliverable_id text NOT NULL REFERENCES public.methodology_deliverables(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned', 'draft', 'client_review', 'signed', 'final', 'not_required')),
  owner          text CHECK (owner IN ('HMC', 'Client', 'Joint')),
  due_date       date,
  completed_date date,
  link           text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, deliverable_id)
);

CREATE TABLE IF NOT EXISTS public.project_phase_gates (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id   text NOT NULL REFERENCES public.methodology_phases(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'passed')),
  passed_at  timestamptz,
  passed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes      text NOT NULL DEFAULT '',
  PRIMARY KEY (project_id, phase_id)
);

CREATE OR REPLACE FUNCTION public.stamp_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_deliverables_updated ON public.project_deliverables;
CREATE TRIGGER trg_project_deliverables_updated BEFORE INSERT OR UPDATE ON public.project_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.stamp_updated();

CREATE OR REPLACE FUNCTION public.stamp_phase_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'passed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'passed') THEN
    NEW.passed_at := now();
    NEW.passed_by := auth.uid();
  ELSIF NEW.status = 'open' THEN
    NEW.passed_at := NULL;
    NEW.passed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_phase_gates_stamp ON public.project_phase_gates;
CREATE TRIGGER trg_project_phase_gates_stamp BEFORE INSERT OR UPDATE ON public.project_phase_gates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_phase_gate();

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phase_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_deliverables, public.project_phase_gates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_deliverables, public.project_phase_gates TO authenticated;

-- Deliverables follow the project's Checklist screen access.
DROP POLICY IF EXISTS project_deliverables_read ON public.project_deliverables;
CREATE POLICY project_deliverables_read ON public.project_deliverables FOR SELECT TO authenticated
  USING (public.can_access_project_screen(project_id, 'checklists', 'read'));
DROP POLICY IF EXISTS project_deliverables_write ON public.project_deliverables;
CREATE POLICY project_deliverables_write ON public.project_deliverables FOR ALL TO authenticated
  USING (public.can_access_project_screen(project_id, 'checklists', 'write'))
  WITH CHECK (public.can_access_project_screen(project_id, 'checklists', 'write'));

-- Passing a phase gate is for the PM (or an admin).
DROP POLICY IF EXISTS project_phase_gates_read ON public.project_phase_gates;
CREATE POLICY project_phase_gates_read ON public.project_phase_gates FOR SELECT TO authenticated
  USING (public.can_read_project(project_id));
DROP POLICY IF EXISTS project_phase_gates_write ON public.project_phase_gates;
CREATE POLICY project_phase_gates_write ON public.project_phase_gates FOR ALL TO authenticated
  USING (public.can_manage_project(project_id))
  WITH CHECK (public.can_manage_project(project_id));

-- ── 4. Monthly Budget Control report ───────────────────────────────────────
-- One row per project per month (the month whose man-days are reported; due by the 5th of the next month).
CREATE TABLE IF NOT EXISTS public.budget_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period        text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'returned')),
  comment       text NOT NULL DEFAULT '',
  return_reason text NOT NULL DEFAULT '',
  snapshot      jsonb,
  -- *_name keep who signed each step (other users cannot read profiles).
  prepared_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_name text NOT NULL DEFAULT '',
  prepared_at   timestamptz,
  reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_name text NOT NULL DEFAULT '',
  reviewed_at   timestamptz,
  approved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_name text NOT NULL DEFAULT '',
  approved_at   timestamptz,
  returned_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  returned_name text NOT NULL DEFAULT '',
  returned_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_reports_project_period_key UNIQUE (project_id, period)
);
CREATE INDEX IF NOT EXISTS budget_reports_period_idx ON public.budget_reports (period);
ALTER TABLE public.budget_reports
  ADD COLUMN IF NOT EXISTS prepared_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS returned_name text NOT NULL DEFAULT '';

-- Who can see budget reports: admin, PM, Account Manager, Director with access to the project.
CREATE OR REPLACE FUNCTION public.can_view_budget(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_admin()
    OR (public.current_user_role() IN ('pm', 'am', 'director') AND public.can_read_project(p_project_id));
$$;
REVOKE ALL ON FUNCTION public.can_view_budget(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_budget(uuid) TO authenticated;

-- The approval chain, enforced in the database:
--   draft / returned → submitted   PM (Prepared By)
--   submitted → reviewed           Account Manager (Reviewed By)
--   reviewed → approved            Director (Approved By)
--   submitted / reviewed → returned  Account Manager or Director, with a reason
--   any → draft                    admin only (reopen)
-- Admins may do every step. Sessions without a signed-in user (SQL editor, service) are not checked.
CREATE OR REPLACE FUNCTION public.guard_budget_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text := public.current_user_role();
  old_status text := CASE WHEN TG_OP = 'INSERT' THEN 'draft' ELSE OLD.status END;
  is_admin boolean := public.is_active_admin();
  me text := coalesce((SELECT nullif(trim(p.full_name), '') FROM public.profiles p WHERE p.id = auth.uid()),
                      (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), '');
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM old_status THEN
    IF NEW.status = 'submitted' THEN
      IF old_status NOT IN ('draft', 'returned') THEN RAISE EXCEPTION 'Only a draft or returned report can be submitted'; END IF;
      IF NOT (is_admin OR r = 'pm') THEN RAISE EXCEPTION 'Only the project manager can submit'; END IF;
      IF NEW.snapshot IS NULL THEN RAISE EXCEPTION 'A submitted report needs its figures'; END IF;
      NEW.prepared_by := auth.uid(); NEW.prepared_name := me; NEW.prepared_at := now();
      NEW.reviewed_by := NULL; NEW.reviewed_name := ''; NEW.reviewed_at := NULL; NEW.approved_by := NULL; NEW.approved_name := ''; NEW.approved_at := NULL;
    ELSIF NEW.status = 'reviewed' THEN
      IF old_status <> 'submitted' THEN RAISE EXCEPTION 'Only a submitted report can be reviewed'; END IF;
      IF NOT (is_admin OR r = 'am') THEN RAISE EXCEPTION 'Only the account manager can review'; END IF;
      NEW.reviewed_by := auth.uid(); NEW.reviewed_name := me; NEW.reviewed_at := now();
    ELSIF NEW.status = 'approved' THEN
      IF old_status <> 'reviewed' THEN RAISE EXCEPTION 'Only a reviewed report can be approved'; END IF;
      IF NOT (is_admin OR r = 'director') THEN RAISE EXCEPTION 'Only a director can approve'; END IF;
      NEW.approved_by := auth.uid(); NEW.approved_name := me; NEW.approved_at := now();
    ELSIF NEW.status = 'returned' THEN
      IF old_status NOT IN ('submitted', 'reviewed') THEN RAISE EXCEPTION 'Only a submitted or reviewed report can be returned'; END IF;
      IF NOT (is_admin OR r IN ('am', 'director')) THEN RAISE EXCEPTION 'Only the account manager or a director can return a report'; END IF;
      IF coalesce(trim(NEW.return_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason for returning the report'; END IF;
      NEW.returned_by := auth.uid(); NEW.returned_name := me; NEW.returned_at := now();
    ELSIF NEW.status = 'draft' THEN
      IF NOT is_admin THEN RAISE EXCEPTION 'Only an admin can reopen a report'; END IF;
      NEW.prepared_by := NULL; NEW.prepared_name := ''; NEW.prepared_at := NULL;
      NEW.reviewed_by := NULL; NEW.reviewed_name := ''; NEW.reviewed_at := NULL;
      NEW.approved_by := NULL; NEW.approved_name := ''; NEW.approved_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND old_status IN ('submitted', 'reviewed', 'approved') AND NOT is_admin THEN
    RAISE EXCEPTION 'This report is locked while it is in review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_budget_report ON public.budget_reports;
CREATE TRIGGER trg_guard_budget_report BEFORE INSERT OR UPDATE ON public.budget_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_budget_report();

ALTER TABLE public.budget_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_reports TO authenticated;

DROP POLICY IF EXISTS budget_reports_read ON public.budget_reports;
CREATE POLICY budget_reports_read ON public.budget_reports FOR SELECT TO authenticated
  USING (public.can_view_budget(project_id));
DROP POLICY IF EXISTS budget_reports_insert ON public.budget_reports;
CREATE POLICY budget_reports_insert ON public.budget_reports FOR INSERT TO authenticated
  WITH CHECK (public.can_view_budget(project_id));
DROP POLICY IF EXISTS budget_reports_update ON public.budget_reports;
CREATE POLICY budget_reports_update ON public.budget_reports FOR UPDATE TO authenticated
  USING (public.can_view_budget(project_id))
  WITH CHECK (public.can_view_budget(project_id));
DROP POLICY IF EXISTS budget_reports_delete ON public.budget_reports;
CREATE POLICY budget_reports_delete ON public.budget_reports FOR DELETE TO authenticated
  USING (public.is_active_admin());

COMMIT;
