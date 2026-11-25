-- Tighten RLS that previously allowed anyone holding the public anon key to
-- read/write/delete activities, progress snapshots and email reminder logs.
--
-- * activities                 -> project access + screen 'activities'
-- * project_progress_snapshots -> project access + screen 'summary'
-- * email_reminder_logs        -> admin read/delete only (policies from
--                                 2026-10-04); writes come from the API with the
--                                 service role key, which bypasses RLS.

BEGIN;

-- Generic project/screen access check, same rules as can_access_project_checklist
-- (admin, or active user with project access + screen permission / role default).
CREATE OR REPLACE FUNCTION public.can_access_project_screen(p_project_id uuid, p_screen text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.is_active IS DISTINCT FROM false
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS DISTINCT FROM false
        AND (
          p.project_access_scope = 'all'
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.project_id = p_project_id
              AND (
                m.user_id = auth.uid()
                OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
              )
          )
        )
        AND CASE
          WHEN p.screen_permissions IS NOT NULL AND jsonb_typeof(p.screen_permissions) = 'array' THEN
            p.screen_permissions ? p_screen
          WHEN p.screen_permissions IS NOT NULL AND jsonb_typeof(p.screen_permissions) = 'object' THEN
            CASE p_action
              WHEN 'read' THEN p.screen_permissions ->> p_screen IN ('read', 'full')
              WHEN 'write' THEN p.screen_permissions ->> p_screen = 'full'
              ELSE false
            END
          ELSE
            CASE p_action
              WHEN 'read' THEN p.role IN ('pm', 'member', 'client')
              WHEN 'write' THEN p.role IN ('pm', 'member')
              ELSE false
            END
        END
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_project_screen(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project_screen(uuid, text, text) TO authenticated;

-- ── activities ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS activities_public_select ON public.activities;
DROP POLICY IF EXISTS activities_public_insert ON public.activities;
DROP POLICY IF EXISTS activities_public_update ON public.activities;
DROP POLICY IF EXISTS activities_public_delete ON public.activities;
DROP POLICY IF EXISTS activities_project_select ON public.activities;
DROP POLICY IF EXISTS activities_project_insert ON public.activities;
DROP POLICY IF EXISTS activities_project_update ON public.activities;
DROP POLICY IF EXISTS activities_project_delete ON public.activities;

CREATE POLICY activities_project_select ON public.activities
  FOR SELECT TO authenticated
  USING (public.can_access_project_screen(project_id, 'activities', 'read'));
CREATE POLICY activities_project_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project_screen(project_id, 'activities', 'write'));
CREATE POLICY activities_project_update ON public.activities
  FOR UPDATE TO authenticated
  USING (public.can_access_project_screen(project_id, 'activities', 'write'))
  WITH CHECK (public.can_access_project_screen(project_id, 'activities', 'write'));
CREATE POLICY activities_project_delete ON public.activities
  FOR DELETE TO authenticated
  USING (public.can_access_project_screen(project_id, 'activities', 'write'));

REVOKE ALL ON public.activities FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;

-- ── project_progress_snapshots ────────────────────────────────────────────
DROP POLICY IF EXISTS project_progress_snapshots_public_select ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_public_insert ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_public_update ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_public_delete ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_project_select ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_project_insert ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_project_update ON public.project_progress_snapshots;
DROP POLICY IF EXISTS project_progress_snapshots_project_delete ON public.project_progress_snapshots;

CREATE POLICY project_progress_snapshots_project_select ON public.project_progress_snapshots
  FOR SELECT TO authenticated
  USING (public.can_access_project_screen(project_id, 'summary', 'read'));
CREATE POLICY project_progress_snapshots_project_insert ON public.project_progress_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project_screen(project_id, 'summary', 'write'));
CREATE POLICY project_progress_snapshots_project_update ON public.project_progress_snapshots
  FOR UPDATE TO authenticated
  USING (public.can_access_project_screen(project_id, 'summary', 'write'))
  WITH CHECK (public.can_access_project_screen(project_id, 'summary', 'write'));
CREATE POLICY project_progress_snapshots_project_delete ON public.project_progress_snapshots
  FOR DELETE TO authenticated
  USING (public.can_access_project_screen(project_id, 'summary', 'write'));

REVOKE ALL ON public.project_progress_snapshots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress_snapshots TO authenticated;

-- ── email_reminder_logs ───────────────────────────────────────────────────
-- "service_role_all" had no TO clause, so it applied to anon/authenticated too.
DROP POLICY IF EXISTS "service_role_all" ON public.email_reminder_logs;
REVOKE ALL ON public.email_reminder_logs FROM anon;
-- Admin select/delete policies (email_reminder_logs_admin_select/_delete) remain.

COMMIT;

NOTIFY pgrst, 'reload schema';
