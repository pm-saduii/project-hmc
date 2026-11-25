-- ============================================================================
-- Project HMC — database schema REFERENCE (not a runnable migration)
-- Source: information_schema of the live Supabase database, 2026-11-26.
-- Shows columns, types, nullability and defaults. Foreign keys and most
-- constraints are not listed; see migrations/ for the exact definitions.
-- Apply changes with new files in migrations/, never by editing this file.
-- ============================================================================

-- Access model (RLS, after migrations/2026-11-26-secure-core-tables-rls.sql):
--  * anon: no table access.
--  * read project data  : can_read_project(project_id)  -> admin, 'all' scope, or project member
--  * write project data : can_access_project_screen(project_id, <screen>, 'write')
--  * checklist / lessons: can_access_project_checklist / can_access_project_lessons
--  * masters_code, task templates, checklist topics: read = signed in, write = admin
--  * notes, email_reminder_logs: admin only;  timesheet_entries: owner only
--  * profiles: read own (admin all); privileged columns admin/service role only

CREATE TABLE public.activities (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id                     uuid NOT NULL,
  activity_date                  date NOT NULL,
  activity_type                  text NOT NULL,
  channel                        text NOT NULL,
  title                          text NOT NULL,
  description                    text DEFAULT ''::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.change_requests (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  cr_id                          text NOT NULL DEFAULT ''::text,
  title                          text NOT NULL DEFAULT ''::text,
  requested_by                   text NOT NULL DEFAULT ''::text,
  request_date                   text NOT NULL DEFAULT ''::text,
  approved_by                    text NOT NULL DEFAULT ''::text,
  approval_date                  text NOT NULL DEFAULT ''::text,
  total_manday                   numeric NOT NULL DEFAULT 0,
  discount                       numeric NOT NULL DEFAULT 0,
  status                         text NOT NULL DEFAULT 'Draft'::text,
  notes                          text NOT NULL DEFAULT ''::text,
  created_at                     timestamptz NOT NULL DEFAULT now()
);
-- request_date / approval_date are TEXT.

CREATE TABLE public.cr_items (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  cr_id                          uuid NOT NULL,
  detail                         text NOT NULL DEFAULT ''::text,
  manday                         numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.effort_monthly (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  effort_id                      uuid NOT NULL,
  month                          text NOT NULL DEFAULT ''::text,
  manday                         numeric NOT NULL DEFAULT 0
);
-- month is 'YYYY-MM'; unique (effort_id, month) used by upsert.

CREATE TABLE public.efforts (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  module                         text NOT NULL DEFAULT ''::text,
  budget_amount                  numeric NOT NULL DEFAULT 0,
  budget_manday                  numeric NOT NULL DEFAULT 0,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  phase                          text NOT NULL DEFAULT ''::text
);

CREATE TABLE public.email_reminder_logs (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id                     uuid,
  project_name                   text,
  project_code                   text,
  type                           text NOT NULL,
  scheduled_time                 text,
  sent_at                        timestamptz,
  status                         text NOT NULL,
  recipient                      text,
  tasks_count                    integer DEFAULT 0,
  error_message                  text,
  created_at                     timestamptz DEFAULT now()
);

CREATE TABLE public.issues (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  issue_date                     text NOT NULL DEFAULT ''::text,
  title                          text NOT NULL DEFAULT ''::text,
  description                    text NOT NULL DEFAULT ''::text,
  reported_by                    text NOT NULL DEFAULT ''::text,
  assigned_to                    text NOT NULL DEFAULT ''::text,
  status                         text NOT NULL DEFAULT 'Open'::text,
  resolved_date                  text NOT NULL DEFAULT ''::text,
  notes                          text NOT NULL DEFAULT ''::text,
  created_at                     timestamptz NOT NULL DEFAULT now()
);
-- issue_date / resolved_date are TEXT. status: Open | In Progress | Resolved | Blocked.

CREATE TABLE public.masters_code (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  code_type                      text NOT NULL,
  code_key                       text NOT NULL,
  code_value                     text NOT NULL,
  label                          text NOT NULL,
  sort_order                     integer NOT NULL DEFAULT 100,
  active                         boolean NOT NULL DEFAULT true,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  text_color                     text NOT NULL DEFAULT '#0F172A'::text,
  bg_color                       text NOT NULL DEFAULT '#EEF2FF'::text
);

CREATE TABLE public.members (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  name                           text NOT NULL DEFAULT ''::text,
  nickname                       text NOT NULL DEFAULT ''::text,
  role                           text NOT NULL DEFAULT ''::text,
  position                       text NOT NULL DEFAULT ''::text,
  email                          text NOT NULL DEFAULT ''::text,
  tel                            text NOT NULL DEFAULT ''::text,
  type                           text NOT NULL DEFAULT 'internal'::text,
  notes                          text NOT NULL DEFAULT ''::text,
  user_id                        uuid,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  ext                            text NOT NULL DEFAULT ''::text,
  thai_name                      text NOT NULL DEFAULT ''::text
);

CREATE TABLE public.milestones (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  phase                          text NOT NULL DEFAULT ''::text,
  name                           text NOT NULL DEFAULT ''::text,
  percent                        numeric NOT NULL DEFAULT 0,
  amount                         numeric NOT NULL DEFAULT 0,
  due_date                       text NOT NULL DEFAULT ''::text,
  billing_date                   text NOT NULL DEFAULT ''::text,
  notes                          text NOT NULL DEFAULT ''::text,
  status                         text NOT NULL DEFAULT 'pending'::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  phase_amount                   numeric NOT NULL DEFAULT 0
);
-- due_date / billing_date are TEXT. status: pending | billed | paid.

CREATE TABLE public.notes (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  title                          text NOT NULL,
  details                        text NOT NULL DEFAULT ''::text,
  start_date                     date,
  end_date                       date,
  status                         text NOT NULL DEFAULT 'active'::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id                             uuid NOT NULL,
  email                          text,
  full_name                      text,
  avatar_url                     text,
  role                           text NOT NULL DEFAULT 'member'::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  is_active                      boolean NOT NULL DEFAULT true,
  screen_permissions             jsonb,
  project_access_scope           text NOT NULL DEFAULT 'member'::text
);
-- id = auth.users.id. role: admin | pm | member | client.
-- screen_permissions: {screenId: hidden|read|full} (legacy: array of screen ids).
-- role / is_active / screen_permissions / project_access_scope are guarded by trg_guard_profile_privileges.

CREATE TABLE public.project_checklist_progress (
  project_id                     uuid NOT NULL,
  topic_id                       uuid NOT NULL,
  done                           boolean NOT NULL DEFAULT false,
  completion_date                date,
  completed_by                   text NOT NULL DEFAULT ''::text,
  jira_id                        text NOT NULL DEFAULT ''::text,
  notes                          text NOT NULL DEFAULT ''::text,
  updated_by                     uuid,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  not_required                   boolean NOT NULL DEFAULT false,
  uat_customer                   numeric,
  uat_hmc                        numeric,
  production_customer            numeric,
  production_hmc                 numeric
);
-- PRIMARY KEY (project_id, topic_id); topic delete cascades.

CREATE TABLE public.project_checklist_topics (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  category                       text NOT NULL,
  work_system                    text NOT NULL DEFAULT ''::text,
  stage                          text NOT NULL DEFAULT ''::text,
  order_no                       integer NOT NULL DEFAULT 10,
  title                          text NOT NULL,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_environments (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id                     uuid NOT NULL,
  environment                    text NOT NULL,
  url                            text NOT NULL DEFAULT ''::text,
  username                       text NOT NULL DEFAULT ''::text,
  password                       text NOT NULL DEFAULT ''::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);
-- Stores customer system credentials in plain text (see security notes).

CREATE TABLE public.project_lessons_learned (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id                     uuid NOT NULL,
  title                          text NOT NULL,
  category                       text NOT NULL,
  phase                          text NOT NULL DEFAULT 'Planning'::text,
  occurred_at                    date NOT NULL DEFAULT CURRENT_DATE,
  context                        text NOT NULL DEFAULT ''::text,
  impact                         text NOT NULL DEFAULT ''::text,
  root_cause                     text NOT NULL DEFAULT ''::text,
  lesson                         text NOT NULL DEFAULT ''::text,
  recommendation                 text NOT NULL DEFAULT ''::text,
  follow_up                      text NOT NULL DEFAULT ''::text,
  owner                          text NOT NULL DEFAULT ''::text,
  due_date                       date,
  status                         text NOT NULL DEFAULT 'Open'::text,
  reference_url                  text NOT NULL DEFAULT ''::text,
  created_by                     uuid,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_members (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  user_id                        uuid NOT NULL,
  created_at                     timestamptz NOT NULL DEFAULT now()
);
-- Links auth users to projects; written only by the server API (service role).

CREATE TABLE public.project_progress_snapshots (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id                     uuid NOT NULL,
  snapshot_date                  date NOT NULL,
  baseline_percent               integer NOT NULL DEFAULT 0,
  actual_percent                 integer NOT NULL DEFAULT 0,
  note                           text NOT NULL DEFAULT ''::text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  name                           text NOT NULL,
  code                           text NOT NULL DEFAULT ''::text,
  client                         text NOT NULL DEFAULT ''::text,
  status                         text NOT NULL DEFAULT 'Planning'::text,
  start_date                     text NOT NULL DEFAULT ''::text,
  end_date                       text NOT NULL DEFAULT ''::text,
  description                    text NOT NULL DEFAULT ''::text,
  color                          text NOT NULL DEFAULT '#4F46E5'::text,
  created_by                     uuid,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  software_version               text NOT NULL DEFAULT ''::text,
  email_notification_enabled     boolean NOT NULL DEFAULT false,
  email_notification_mode        text NOT NULL DEFAULT 'task'::text,
  email_notification_recipients  text NOT NULL DEFAULT ''::text,
  email_notification_time        time NOT NULL DEFAULT '08:00:00'::time without time zone,
  email_notification_last_sent_at timestamptz,
  customer_abbreviation          text NOT NULL DEFAULT ''::text,
  customer_id                    text NOT NULL DEFAULT ''::text
);
-- start_date / end_date are TEXT 'YYYY-MM-DD' or ''. Status values come from masters_code (project_status).

CREATE TABLE public.risks (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  risk_date                      text NOT NULL DEFAULT ''::text,
  title                          text NOT NULL DEFAULT ''::text,
  description                    text NOT NULL DEFAULT ''::text,
  probability                    text NOT NULL DEFAULT 'Medium'::text,
  impact                         text NOT NULL DEFAULT 'Medium'::text,
  mitigation                     text NOT NULL DEFAULT ''::text,
  owner                          text NOT NULL DEFAULT ''::text,
  status                         text NOT NULL DEFAULT 'Monitoring'::text,
  created_at                     timestamptz NOT NULL DEFAULT now()
);
-- risk_date is TEXT. status: Monitoring | Mitigating | Closed.

CREATE TABLE public.task_template_items (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id                    uuid NOT NULL,
  wbs                            text NOT NULL,
  parent_wbs                     text NOT NULL DEFAULT ''::text,
  level                          integer NOT NULL DEFAULT 0,
  sort_order                     numeric NOT NULL DEFAULT 0,
  task_name                      text NOT NULL,
  duration                       integer NOT NULL DEFAULT 0,
  effort_manday                  numeric NOT NULL DEFAULT 0,
  created_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_templates (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  template_no                    bigint NOT NULL,
  name                           text NOT NULL,
  created_by                     uuid,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id                             uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id                     uuid NOT NULL,
  wbs                            text NOT NULL DEFAULT ''::text,
  task_name                      text NOT NULL DEFAULT ''::text,
  start_date                     text DEFAULT ''::text,
  end_date                       text DEFAULT ''::text,
  actual_finish                  text DEFAULT ''::text,
  duration                       integer NOT NULL DEFAULT 0,
  percent_complete               integer NOT NULL DEFAULT 0,
  resource                       text NOT NULL DEFAULT ''::text,
  related_task                   text NOT NULL DEFAULT ''::text,
  parent_id                      text NOT NULL DEFAULT ''::text,
  level                          integer NOT NULL DEFAULT 0,
  "order"                        integer NOT NULL DEFAULT 0,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  phase                          varchar DEFAULT ''::character varying,
  status                         varchar NOT NULL DEFAULT 'Todo'::character varying,
  effort_manday                  numeric NOT NULL DEFAULT 0,
  sort_order                     numeric NOT NULL DEFAULT 0,
  related_task_type              text NOT NULL DEFAULT 'FS'::text,
  related_task_lag_days          integer NOT NULL DEFAULT 0,
  baseline_start_date            date,
  baseline_end_date              date
);
-- parent_id / related_task are TEXT holding a task id or '' (no FK).
-- start_date / end_date / actual_finish are TEXT 'YYYY-MM-DD' or ''.
-- status CHECK (Todo | In Progress | Block/Delay | Done); synced by trg_tasks_sync_status.
-- related_task_type CHECK (FS | SS | FF | SF). Legacy column "order" is kept; ordering uses sort_order.

CREATE TABLE public.timesheet_entries (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid NOT NULL,
  work_date                      date NOT NULL,
  project_key                    text NOT NULL,
  description                    text NOT NULL,
  hours                          numeric NOT NULL,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);
