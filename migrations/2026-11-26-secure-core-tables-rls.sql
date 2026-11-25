-- Close the RLS gaps found on 2026-11-26 (pg_policies / relrowsecurity review):
--
--  1. project_environments had RLS DISABLED and anon could SELECT it, so anyone
--     holding the public anon key could read every customer URL/username/password.
--  2. profiles: "Users can update own profile" allowed changing role/is_active/
--     screen_permissions/project_access_scope -> any user could make themselves admin.
--     "Users can view all profiles" (USING true, role public) let anon read all users.
--  3. Core project tables (tasks, members, milestones, efforts, effort_monthly,
--     change_requests, cr_items, issues, risks, projects) only required
--     auth.uid() IS NOT NULL -> every signed-in user could read/modify every project.
--
-- New model (same rules the app already applies on the client):
--  * READ  a project's rows: admin, "all projects" scope, or member of the project.
--  * WRITE a project's rows: as above AND 'full' access to that screen
--    (role default when no per-user screen permissions: pm/member write, client read).
--  * Projects: create = admin; update/delete keep the existing creator-or-admin rule.
--  * Profiles: read own row (admins read all); only admins / the service role /
--    SQL editor may change role, is_active, screen_permissions, project_access_scope.

BEGIN;

-- ── Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active IS DISTINCT FROM false
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;

-- Read access to a project (any screen).
CREATE OR REPLACE FUNCTION public.can_read_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active IS DISTINCT FROM false
      AND (
        p.role = 'admin'
        OR p.project_access_scope = 'all'
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
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_project(uuid) TO authenticated;
-- Write access uses public.can_access_project_screen(project_id, <screen>, 'write')
-- created in 2026-11-25-tighten-rls-activities-snapshots-email-logs.sql.

-- Drop every existing policy on the tables we rewrite, whatever its name.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('tasks', 'members', 'milestones', 'efforts', 'effort_monthly',
                        'change_requests', 'cr_items', 'issues', 'risks', 'projects',
                        'project_environments', 'profiles', 'project_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── Tables with a project_id column ───────────────────────────────────────
DO $$
DECLARE
  cfg record;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('tasks', 'tasks'),
      ('members', 'members'),
      ('milestones', 'ms'),
      ('efforts', 'effort'),
      ('change_requests', 'cr'),
      ('issues', 'issues'),
      ('risks', 'risks'),
      ('project_environments', 'env')
    ) AS t(table_name, screen)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', cfg.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_project(project_id))',
      cfg.table_name || '_project_select', cfg.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_project_screen(project_id, %L, ''write''))',
      cfg.table_name || '_project_insert', cfg.table_name, cfg.screen);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_access_project_screen(project_id, %L, ''write'')) WITH CHECK (public.can_access_project_screen(project_id, %L, ''write''))',
      cfg.table_name || '_project_update', cfg.table_name, cfg.screen, cfg.screen);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_access_project_screen(project_id, %L, ''write''))',
      cfg.table_name || '_project_delete', cfg.table_name, cfg.screen);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', cfg.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', cfg.table_name);
  END LOOP;
END $$;

-- ── Child tables (project comes from the parent row) ──────────────────────
ALTER TABLE public.effort_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY effort_monthly_project_select ON public.effort_monthly FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.efforts e WHERE e.id = effort_monthly.effort_id AND public.can_read_project(e.project_id)));
CREATE POLICY effort_monthly_project_insert ON public.effort_monthly FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.efforts e WHERE e.id = effort_monthly.effort_id AND public.can_access_project_screen(e.project_id, 'effort', 'write')));
CREATE POLICY effort_monthly_project_update ON public.effort_monthly FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.efforts e WHERE e.id = effort_monthly.effort_id AND public.can_access_project_screen(e.project_id, 'effort', 'write')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.efforts e WHERE e.id = effort_monthly.effort_id AND public.can_access_project_screen(e.project_id, 'effort', 'write')));
CREATE POLICY effort_monthly_project_delete ON public.effort_monthly FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.efforts e WHERE e.id = effort_monthly.effort_id AND public.can_access_project_screen(e.project_id, 'effort', 'write')));
REVOKE ALL ON public.effort_monthly FROM anon;

ALTER TABLE public.cr_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_items_project_select ON public.cr_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.change_requests c WHERE c.id = cr_items.cr_id AND public.can_read_project(c.project_id)));
CREATE POLICY cr_items_project_insert ON public.cr_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.change_requests c WHERE c.id = cr_items.cr_id AND public.can_access_project_screen(c.project_id, 'cr', 'write')));
CREATE POLICY cr_items_project_update ON public.cr_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.change_requests c WHERE c.id = cr_items.cr_id AND public.can_access_project_screen(c.project_id, 'cr', 'write')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.change_requests c WHERE c.id = cr_items.cr_id AND public.can_access_project_screen(c.project_id, 'cr', 'write')));
CREATE POLICY cr_items_project_delete ON public.cr_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.change_requests c WHERE c.id = cr_items.cr_id AND public.can_access_project_screen(c.project_id, 'cr', 'write')));
REVOKE ALL ON public.cr_items FROM anon;

-- ── projects ──────────────────────────────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (public.can_read_project(id));
CREATE POLICY projects_insert_admin ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_active_admin());
CREATE POLICY projects_update_creator_or_admin ON public.projects FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_active_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_active_admin());
CREATE POLICY projects_delete_creator_or_admin ON public.projects FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_active_admin());
REVOKE ALL ON public.projects FROM anon;

-- ── project_members (writes come from the API with the service role) ──────
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_members_select_own ON public.project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_active_admin());
REVOKE ALL ON public.project_members FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.project_members FROM authenticated;

-- ── profiles ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_active_admin());
CREATE POLICY profiles_update_own_or_admin ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_active_admin())
  WITH CHECK (id = auth.uid() OR public.is_active_admin());
REVOKE ALL ON public.profiles FROM anon;

-- Guard the privileged columns. Allowed to change them:
--  * an active admin (API request carrying their JWT)
--  * the service role (server API)
--  * a direct database session with no request JWT (SQL editor, migrations),
--    EXCEPT the Auth service itself (supabase_auth_admin), which creates the
--    profile during self sign-up and must not be able to grant admin.
-- To test as a normal user in the SQL editor, set request.jwt.claims first.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  privileged boolean :=
    coalesce(claims ->> 'role', '') = 'service_role'
    OR (claims IS NULL AND session_user <> 'supabase_auth_admin')
    OR public.is_active_admin();
BEGIN
  IF privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Self sign-up (runs as supabase_auth_admin): never trust the requested role.
    IF NEW.role IS NULL OR NEW.role NOT IN ('member', 'client') THEN
      NEW.role := 'member';
    END IF;
    NEW.is_active := true;
    NEW.screen_permissions := NULL;
    NEW.project_access_scope := 'member';
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.screen_permissions IS DISTINCT FROM OLD.screen_permissions
     OR NEW.project_access_scope IS DISTINCT FROM OLD.project_access_scope THEN
    RAISE EXCEPTION 'FORBIDDEN: only an admin can change role or access settings';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ── Anything else anon never needs ─────────────────────────────────────────
REVOKE ALL ON public.masters_code, public.notes, public.task_templates, public.task_template_items,
  public.project_checklist_topics, public.project_checklist_progress, public.project_lessons_learned
  FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
