-- Rule-based notifications (email and Microsoft Teams), sent by /api/notify every morning.
-- Safe to run more than once.

BEGIN;

-- Rules: admins switch them on/off, pick channels and tune the number of days.
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  recipients  text NOT NULL DEFAULT '',
  enabled     boolean NOT NULL DEFAULT true,
  email       boolean NOT NULL DEFAULT true,
  teams       boolean NOT NULL DEFAULT false,
  days        integer,                         -- look-ahead days where the rule uses one
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO public.notification_rules (id, name, description, recipients, days, sort_order) VALUES
  ('R1', 'Tasks due soon', 'Open tasks due within the next N days.', 'Task owner', 3, 10),
  ('R2', 'Overdue tasks', 'Open tasks past their end date.', 'Task owner, copy to the PM', NULL, 20),
  ('R3', 'Milestones due or overdue', 'Unpaid milestones due within N days or already past due.', 'Project manager', 10, 30),
  ('R4', 'Deliverables due or overdue', 'Methodology deliverables not complete, due within N days or past due.', 'Project manager', 7, 40),
  ('R5', 'Blocked issues', 'Issues with status Blocked.', 'Project manager', NULL, 50),
  ('R6', 'Budget Control not submitted', 'Last month''s Budget Control report not submitted after the 5th.', 'Project manager, copy to admins', NULL, 60),
  ('R7', 'Budget Control waiting', 'Reports waiting for review (Account Manager) or approval (Director).', 'Account manager / Director', NULL, 70),
  ('R8', 'Monthly report not published', 'Last month''s One Page report not published after the 3rd.', 'Project manager', NULL, 80),
  ('R9', 'Weekly status reminder', 'Every Friday: prepare and send the External Status Report.', 'Project manager', NULL, 90)
ON CONFLICT (id) DO NOTHING;

-- One row per message sent (or failed / skipped); also stops the same message going out twice a day.
CREATE TABLE IF NOT EXISTS public.notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     text NOT NULL,
  project_id  uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  channel     text NOT NULL CHECK (channel IN ('email', 'teams')),
  recipient   text NOT NULL DEFAULT '',
  subject     text NOT NULL DEFAULT '',
  item_count  integer NOT NULL DEFAULT 0,
  status      text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error       text NOT NULL DEFAULT '',
  trigger     text NOT NULL DEFAULT 'auto' CHECK (trigger IN ('auto', 'manual')),
  sent_on     date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_log_day_idx ON public.notification_log (sent_on, rule_id, channel, recipient);

-- Teams channel of each project (an incoming-webhook / Workflows URL); PMs and admins set it.
CREATE TABLE IF NOT EXISTS public.project_integrations (
  project_id        uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  teams_webhook_url text NOT NULL DEFAULT '',
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Global settings (admins only): fallback Teams webhook, send time note, etc.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_rules, public.notification_log, public.project_integrations, public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules, public.notification_log, public.project_integrations, public.app_settings TO authenticated;

DROP POLICY IF EXISTS notification_rules_read ON public.notification_rules;
CREATE POLICY notification_rules_read ON public.notification_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS notification_rules_admin ON public.notification_rules;
CREATE POLICY notification_rules_admin ON public.notification_rules FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- The log is written by the server (service role); admins read all, PMs their projects.
DROP POLICY IF EXISTS notification_log_read ON public.notification_log;
CREATE POLICY notification_log_read ON public.notification_log FOR SELECT TO authenticated
  USING (public.is_active_admin() OR (project_id IS NOT NULL AND public.can_manage_project(project_id)));

DROP POLICY IF EXISTS project_integrations_rw ON public.project_integrations;
CREATE POLICY project_integrations_rw ON public.project_integrations FOR ALL TO authenticated
  USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id));

DROP POLICY IF EXISTS app_settings_admin ON public.app_settings;
CREATE POLICY app_settings_admin ON public.app_settings FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

COMMIT;
